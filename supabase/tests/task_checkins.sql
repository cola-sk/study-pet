-- Isolated database only, after schema.sql and all migrations. Rolls back fixtures.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE f UUID; f2 UUID; c UUID; c2 UUID; p UUID; d UUID; t UUID; i UUID; i2 UUID; r JSONB; input JSONB;
  today DATE; req UUID:=gen_random_uuid(); original_version TIMESTAMPTZ;
BEGIN
  INSERT INTO families(name,timezone) VALUES('tasks-test','Pacific/Kiritimati') RETURNING id INTO f;
  INSERT INTO families(name) VALUES('other') RETURNING id INTO f2;
  INSERT INTO children(family_id,nickname) VALUES(f,'test') RETURNING id INTO c;
  INSERT INTO children(family_id,nickname) VALUES(f2,'other') RETURNING id INTO c2;
  INSERT INTO parents(family_id) VALUES(f) RETURNING id INTO p;
  INSERT INTO devices(family_id,child_id,status,api_token_hash) VALUES(f,c,'paired',gen_random_uuid()::text) RETURNING id INTO d;
  today:=ensure_today_tasks(f);
  ASSERT today=(now() AT TIME ZONE 'Pacific/Kiritimati')::date;
  input:=jsonb_build_object('title','Read','description','15 minutes','reward_coins',3,'confirm_type','auto_confirm',
    'frequency_type','daily','frequency_config','{}'::jsonb,'target_scope','all','target_child_ids','[]'::jsonb,'is_active',true);
  r:=save_family_task_template(f,NULL,req,input); t:=(r->>'id')::uuid; original_version:=(r->>'updated_at')::timestamptz;
  ASSERT (save_family_task_template(f,NULL,req,input)->>'id')::uuid=t;
  BEGIN
    PERFORM save_family_task_template(f,NULL,req,input||'{"title":"Changed"}');
    RAISE EXCEPTION 'request conflict accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  PERFORM ensure_today_tasks(f); PERFORM ensure_today_tasks(f);
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=t)=1;
  SELECT id INTO i FROM task_instances WHERE template_id=t;
  r:=save_family_task_template(f,t,NULL,input||'{"title":"New title","reward_coins":9}',original_version);
  ASSERT (SELECT title='Read' AND reward_coins=3 FROM task_instances WHERE id=i);
  BEGIN
    PERFORM save_family_task_template(f,t,NULL,input,original_version);
    RAISE EXCEPTION 'stale edit accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM save_family_task_template(f,NULL,gen_random_uuid(),input||jsonb_build_object('target_scope','specific','target_child_ids',jsonb_build_array(c2)));
    RAISE EXCEPTION 'cross-family target accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ASSERT archive_family_task_template(f2,t)=false;
  r:=device_submit_task(d,i,'auto-request-00000001');
  ASSERT (r->>'success')::bool AND r->>'status'='completed' AND (r->>'credits')::int=3;
  r:=device_submit_task(d,i,'auto-request-00000001');
  ASSERT (r->>'replayed')::bool AND (r->>'credits')::int=3;
  r:=device_submit_task(d,i,'auto-request-00000002');
  ASSERT (r->>'credits')::int=3;
  ASSERT (SELECT count(*) FROM wallet_transactions WHERE child_id=c)=1;
  ASSERT (review_family_task(f,p,i,'approve')->>'coinsAwarded')::int=0;
  -- Parent confirmation, rejected retry and old request replay.
  r:=save_family_task_template(f,NULL,gen_random_uuid(),input||'{"confirm_type":"parent_confirm"}');
  SELECT id INTO i2 FROM task_instances WHERE template_id=(r->>'id')::uuid;
  ASSERT device_submit_task(d,i2,'auto-request-00000001')->>'code'='request_conflict';
  r:=device_submit_task(d,i2,'parent-request-000001');
  ASSERT r->>'status'='submitted' AND (r->>'credits')::int=3;
  ASSERT (review_family_task(f2,p,i2,'approve')->>'success')::bool=false;
  ASSERT (review_family_task(f,p,i2,'reject','Try again')->>'success')::bool;
  ASSERT device_submit_task(d,i2,'parent-request-000001')->>'status'='rejected';
  ASSERT device_submit_task(d,i2,'parent-request-000002')->>'status'='submitted';
  ASSERT (review_family_task(f,p,i2,'approve')->>'coinsAwarded')::int=3;
  ASSERT (review_family_task(f,p,i2,'approve')->>'coinsAwarded')::int=0;
  ASSERT (SELECT coins_balance FROM children WHERE id=c)=6;
  ASSERT (SELECT count(*) FROM wallet_transactions WHERE child_id=c)=2;
  -- Reboots/retries after midnight return the prior result; fresh yesterday requests fail.
  UPDATE task_instances SET target_date=today-1 WHERE id=i;
  ASSERT device_submit_task(d,i,'auto-request-00000001')->>'status'='completed';
  UPDATE task_instances SET target_date=today-1,status='pending',reward_granted=false WHERE id=i2;
  ASSERT device_submit_task(d,i2,'yesterday-request-001')->>'code'='not_today';
  UPDATE devices SET child_id=c2 WHERE id=d;
  ASSERT device_submit_task(d,i,'auto-request-00000001')->>'code'='task_unavailable';
  UPDATE devices SET child_id=c WHERE id=d;
  ASSERT archive_family_task_template(f,t);
  PERFORM ensure_today_tasks(f);
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=t)=1;
  -- Match/miss weekly and interval rules, inactive and future/expired templates.
  input:=input||jsonb_build_object('frequency_type','weekly_days','frequency_config',jsonb_build_object('days',jsonb_build_array(extract(isodow FROM today)::int)));
  r:=save_family_task_template(f,NULL,gen_random_uuid(),input);
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=(r->>'id')::uuid)=1;
  r:=save_family_task_template(f,NULL,gen_random_uuid(),input||jsonb_build_object('frequency_config',jsonb_build_object('days',jsonb_build_array(mod(extract(isodow FROM today)::int,7)+1))));
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=(r->>'id')::uuid)=0;
  input:=input||jsonb_build_object('frequency_type','interval_days','frequency_config',jsonb_build_object('interval',3,'base_date',(today-6)::text));
  r:=save_family_task_template(f,NULL,gen_random_uuid(),input);
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=(r->>'id')::uuid)=1;
  r:=save_family_task_template(f,NULL,gen_random_uuid(),input||jsonb_build_object('frequency_config',jsonb_build_object('interval',3,'base_date',(today-5)::text)));
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=(r->>'id')::uuid)=0;
  input:=input||'{"frequency_type":"daily","frequency_config":{}}';
  r:=save_family_task_template(f,NULL,gen_random_uuid(),input||'{"is_active":false}');
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=(r->>'id')::uuid)=0;
  r:=save_family_task_template(f,NULL,gen_random_uuid(),input||jsonb_build_object('start_date',(today+1)::text));
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=(r->>'id')::uuid)=0;
  r:=save_family_task_template(f,NULL,gen_random_uuid(),input||jsonb_build_object('start_date',(today-5)::text,'end_date',(today-1)::text));
  ASSERT (SELECT count(*) FROM task_instances WHERE template_id=(r->>'id')::uuid)=0;
  ASSERT NOT has_function_privilege('anon','public.ensure_today_tasks(uuid)','EXECUTE');
  ASSERT NOT has_function_privilege('authenticated','public.device_submit_task(uuid,uuid,text)','EXECUTE');
  ASSERT NOT has_function_privilege('authenticated','public.review_family_task(uuid,uuid,uuid,text,text)','EXECUTE');
  ASSERT NOT has_table_privilege('authenticated','public.device_task_submissions','SELECT');
  ASSERT has_function_privilege('service_role','public.ensure_today_tasks(uuid)','EXECUTE');
END $$;
ROLLBACK;
