-- Additive task/check-in workflow. Run after 20261116_family_shop.sql.
BEGIN;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS creation_request_id UUID;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS creation_payload JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS task_template_creation_request ON public.task_templates(family_id,creation_request_id) WHERE creation_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS task_instances_child_today ON public.task_instances(family_id,child_id,target_date);
CREATE TABLE IF NOT EXISTS public.device_task_submissions (
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{16,80}$'),
  task_id UUID NOT NULL REFERENCES public.task_instances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(device_id,request_id)
);
ALTER TABLE public.device_task_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_task_submissions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.device_task_submissions TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_today_tasks(p_family_id UUID)
RETURNS DATE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE day DATE; tz TEXT;
BEGIN
  SELECT timezone INTO tz FROM public.families WHERE id=p_family_id;
  IF tz IS NULL THEN RAISE EXCEPTION 'Unknown family'; END IF;
  day := (now() AT TIME ZONE tz)::date;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_family_id::text,27));
  INSERT INTO public.task_instances(template_id,family_id,child_id,target_date,title,description,reward_coins,confirm_type)
  SELECT t.id,t.family_id,c.id,day,t.title,t.description,t.reward_coins,t.confirm_type
  FROM public.task_templates t JOIN public.children c ON c.family_id=t.family_id
  WHERE t.family_id=p_family_id AND t.is_active AND NOT t.archived
    AND day>=COALESCE(t.start_date,(t.created_at AT TIME ZONE tz)::date)
    AND (t.end_date IS NULL OR day<=t.end_date)
    AND (t.target_scope='all' OR (t.target_scope='specific' AND t.target_child_ids @> jsonb_build_array(c.id::text)))
    AND CASE t.frequency_type
      WHEN 'daily' THEN true
      WHEN 'weekly_days' THEN COALESCE(t.frequency_config->'days','[]'::jsonb) @> to_jsonb(extract(isodow FROM day)::int)
      WHEN 'interval_days' THEN CASE WHEN COALESCE(t.frequency_config->>'interval','') ~ '^[0-9]{1,3}$'
        AND (t.frequency_config->>'interval')::int BETWEEN 1 AND 365
        THEN (day-COALESCE((t.frequency_config->>'base_date')::date,t.start_date,(t.created_at AT TIME ZONE tz)::date))>=0
          AND mod(day-COALESCE((t.frequency_config->>'base_date')::date,t.start_date,(t.created_at AT TIME ZONE tz)::date),(t.frequency_config->>'interval')::int)=0
        ELSE false END
      ELSE false END
  ON CONFLICT(template_id,child_id,target_date) DO NOTHING;
  RETURN day;
END $$;

CREATE OR REPLACE FUNCTION public.save_family_task_template(p_family_id UUID,p_template_id UUID,p_request_id UUID,p_input JSONB,p_expected_version TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.task_templates%ROWTYPE; today DATE; start_on DATE; end_on DATE; config JSONB; targets JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_family_id::text,27));
  SELECT (now() AT TIME ZONE timezone)::date INTO today FROM public.families WHERE id=p_family_id;
  IF today IS NULL THEN RAISE EXCEPTION 'Unknown family'; END IF;
  IF p_template_id IS NULL THEN
    IF p_request_id IS NULL THEN RAISE EXCEPTION 'Request ID required' USING ERRCODE='23514'; END IF;
    SELECT * INTO t FROM public.task_templates WHERE family_id=p_family_id AND creation_request_id=p_request_id;
    IF FOUND THEN
      IF t.creation_payload IS DISTINCT FROM p_input THEN RAISE EXCEPTION 'Request reused' USING ERRCODE='23505'; END IF;
      RETURN to_jsonb(t);
    END IF;
    IF (SELECT count(*) FROM public.task_templates WHERE family_id=p_family_id AND NOT archived)>=50 THEN RAISE EXCEPTION 'Template limit' USING ERRCODE='54000'; END IF;
  ELSE
    SELECT * INTO t FROM public.task_templates WHERE id=p_template_id AND family_id=p_family_id AND NOT archived FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Template not found' USING ERRCODE='P0002'; END IF;
    IF p_expected_version IS NOT NULL AND t.updated_at<>p_expected_version THEN RAISE EXCEPTION 'Template changed' USING ERRCODE='40001'; END IF;
  END IF;
  start_on := COALESCE((p_input->>'start_date')::date,t.start_date,today);
  end_on := (p_input->>'end_date')::date;
  config := COALESCE(p_input->'frequency_config','{}'::jsonb);
  targets := COALESCE(p_input->'target_child_ids','[]'::jsonb);
  IF length(btrim(p_input->>'title')) NOT BETWEEN 1 AND 40 OR length(COALESCE(p_input->>'description',''))>200
    OR (p_input->>'reward_coins')::int NOT BETWEEN 1 AND 10000
    OR p_input->>'confirm_type' NOT IN ('auto_confirm','parent_confirm')
    OR p_input->>'frequency_type' NOT IN ('daily','weekly_days','interval_days')
    OR p_input->>'target_scope' NOT IN ('all','specific') OR jsonb_typeof(targets)<>'array'
    OR (end_on IS NOT NULL AND end_on<start_on) THEN RAISE EXCEPTION 'Invalid task' USING ERRCODE='23514'; END IF;
  IF p_input->>'target_scope'='specific' THEN
    IF jsonb_array_length(targets)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(targets) x WHERE NOT EXISTS(SELECT 1 FROM public.children c WHERE c.id::text=x AND c.family_id=p_family_id)) THEN RAISE EXCEPTION 'Child outside family' USING ERRCODE='23514'; END IF;
  ELSE targets := '[]'::jsonb; END IF;
  IF p_input->>'frequency_type'='weekly_days' THEN
    IF jsonb_typeof(config->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(config->'days')=0 THEN RAISE EXCEPTION 'Select weekdays' USING ERRCODE='23514'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(config->'days') x WHERE x NOT IN ('1','2','3','4','5','6','7')) THEN RAISE EXCEPTION 'Invalid weekdays' USING ERRCODE='23514'; END IF;
  ELSIF p_input->>'frequency_type'='interval_days' THEN
    IF COALESCE(config->>'interval','') !~ '^[0-9]{1,3}$' OR (config->>'interval')::int NOT BETWEEN 1 AND 365 THEN RAISE EXCEPTION 'Invalid interval' USING ERRCODE='23514'; END IF;
    config := config || jsonb_build_object('base_date',COALESCE(config->>'base_date',t.frequency_config->>'base_date',start_on::text));
    PERFORM (config->>'base_date')::date;
  END IF;
  IF p_template_id IS NULL THEN
    INSERT INTO public.task_templates(family_id,title,description,reward_coins,confirm_type,frequency_type,frequency_config,target_scope,target_child_ids,is_active,start_date,end_date,creation_request_id,creation_payload)
    VALUES(p_family_id,btrim(p_input->>'title'),p_input->>'description',(p_input->>'reward_coins')::int,p_input->>'confirm_type',p_input->>'frequency_type',config,p_input->>'target_scope',targets,COALESCE((p_input->>'is_active')::boolean,true),start_on,end_on,p_request_id,p_input) RETURNING * INTO t;
  ELSE
    UPDATE public.task_templates SET title=btrim(p_input->>'title'),description=p_input->>'description',reward_coins=(p_input->>'reward_coins')::int,confirm_type=p_input->>'confirm_type',frequency_type=p_input->>'frequency_type',frequency_config=config,target_scope=p_input->>'target_scope',target_child_ids=targets,is_active=COALESCE((p_input->>'is_active')::boolean,true),start_date=start_on,end_date=end_on,updated_at=clock_timestamp() WHERE id=p_template_id RETURNING * INTO t;
  END IF;
  PERFORM public.ensure_today_tasks(p_family_id);
  RETURN to_jsonb(t);
END $$;

CREATE OR REPLACE FUNCTION public.archive_family_task_template(p_family_id UUID,p_template_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_family_id::text,27));
  UPDATE public.task_templates SET archived=true,is_active=false,updated_at=clock_timestamp() WHERE id=p_template_id AND family_id=p_family_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.device_submit_task(p_device_id UUID,p_task_id UUID,p_request_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d public.devices%ROWTYPE; t public.task_instances%ROWTYPE; previous UUID; today DATE; balance INT; replay BOOLEAN:=false;
BEGIN
  IF p_request_id IS NULL OR p_request_id !~ '^[A-Za-z0-9_-]{16,80}$' THEN RETURN jsonb_build_object('success',false,'code','invalid_request'); END IF;
  SELECT * INTO d FROM public.devices WHERE id=p_device_id AND status='paired' FOR SHARE;
  IF NOT FOUND OR d.family_id IS NULL OR d.child_id IS NULL THEN RETURN jsonb_build_object('success',false,'code','not_paired'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_id::text||p_request_id,28));
  SELECT task_id INTO previous FROM public.device_task_submissions WHERE device_id=p_device_id AND request_id=p_request_id;
  IF FOUND AND previous<>p_task_id THEN RETURN jsonb_build_object('success',false,'code','request_conflict'); END IF;
  replay := previous IS NOT NULL;
  SELECT * INTO t FROM public.task_instances WHERE id=p_task_id FOR UPDATE;
  IF NOT FOUND OR t.family_id<>d.family_id OR t.child_id<>d.child_id THEN RETURN jsonb_build_object('success',false,'code','task_unavailable'); END IF;
  IF NOT replay AND t.status NOT IN ('submitted','completed') THEN
    SELECT (now() AT TIME ZONE timezone)::date INTO today FROM public.families WHERE id=d.family_id;
    IF t.target_date<>today OR t.reward_granted OR t.status NOT IN ('pending','rejected') THEN RETURN jsonb_build_object('success',false,'code','not_today'); END IF;
    IF t.confirm_type='auto_confirm' THEN
      UPDATE public.children SET coins_balance=coins_balance+t.reward_coins,updated_at=now() WHERE id=d.child_id AND family_id=d.family_id RETURNING coins_balance INTO balance;
      IF NOT FOUND THEN RAISE EXCEPTION 'Child outside family'; END IF;
      INSERT INTO public.wallet_transactions(family_id,child_id,amount,balance_after,type,description,reference_id) VALUES(d.family_id,d.child_id,t.reward_coins,balance,'task_reward','完成任务: '||t.title,t.id::text);
      UPDATE public.task_instances SET status='completed',reward_granted=true,submitted_at=now(),reviewed_at=now(),client_request_id=p_request_id,device_id=d.id,updated_at=now() WHERE id=t.id RETURNING * INTO t;
    ELSIF t.confirm_type='parent_confirm' THEN
      UPDATE public.task_instances SET status='submitted',submitted_at=now(),reject_reason=NULL,client_request_id=p_request_id,device_id=d.id,updated_at=now() WHERE id=t.id RETURNING * INTO t;
    ELSE RETURN jsonb_build_object('success',false,'code','invalid_task'); END IF;
  END IF;
  INSERT INTO public.device_task_submissions(device_id,request_id,task_id) VALUES(d.id,p_request_id,t.id) ON CONFLICT DO NOTHING;
  SELECT coins_balance INTO balance FROM public.children WHERE id=d.child_id AND family_id=d.family_id;
  RETURN jsonb_build_object('success',true,'status',t.status,'credits',balance,'rewardCoins',t.reward_coins,'replayed',replay,'awarded',t.reward_granted);
END $$;

CREATE OR REPLACE FUNCTION public.review_family_task(p_family_id UUID,p_parent_id UUID,p_task_id UUID,p_action TEXT,p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.task_instances%ROWTYPE; balance INT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.parents WHERE id=p_parent_id AND family_id=p_family_id) THEN RETURN jsonb_build_object('success',false,'code','not_allowed'); END IF;
  SELECT * INTO t FROM public.task_instances WHERE id=p_task_id AND family_id=p_family_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'code','task_unavailable'); END IF;
  IF p_action='approve' AND t.status='completed' AND t.reward_granted THEN
    SELECT coins_balance INTO balance FROM public.children WHERE id=t.child_id AND family_id=p_family_id;
    RETURN jsonb_build_object('success',true,'credits',balance,'coinsAwarded',0,'replayed',true);
  END IF;
  IF t.status<>'submitted' THEN RETURN jsonb_build_object('success',false,'code','task_changed'); END IF;
  IF p_action='approve' THEN
    UPDATE public.children SET coins_balance=coins_balance+t.reward_coins,updated_at=now() WHERE id=t.child_id AND family_id=p_family_id RETURNING coins_balance INTO balance;
    IF NOT FOUND THEN RAISE EXCEPTION 'Child outside family'; END IF;
    UPDATE public.task_instances SET status='completed',reward_granted=true,reviewed_at=now(),updated_at=now() WHERE id=t.id;
    INSERT INTO public.wallet_transactions(family_id,child_id,amount,balance_after,type,description,reference_id) VALUES(p_family_id,t.child_id,t.reward_coins,balance,'task_reward','完成任务: '||t.title||' (家长已确认)',t.id::text);
    RETURN jsonb_build_object('success',true,'credits',balance,'coinsAwarded',t.reward_coins);
  ELSIF p_action='reject' AND length(btrim(p_reason)) BETWEEN 1 AND 120 THEN
    UPDATE public.task_instances SET status='rejected',reject_reason=btrim(p_reason),reviewed_at=now(),updated_at=now() WHERE id=t.id;
    RETURN jsonb_build_object('success',true,'coinsAwarded',0);
  END IF;
  RETURN jsonb_build_object('success',false,'code','invalid_review');
END $$;
REVOKE ALL ON FUNCTION public.ensure_today_tasks(UUID),public.save_family_task_template(UUID,UUID,UUID,JSONB,TIMESTAMPTZ),public.archive_family_task_template(UUID,UUID),public.device_submit_task(UUID,UUID,TEXT),public.review_family_task(UUID,UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_today_tasks(UUID),public.save_family_task_template(UUID,UUID,UUID,JSONB,TIMESTAMPTZ),public.archive_family_task_template(UUID,UUID),public.device_submit_task(UUID,UUID,TEXT),public.review_family_task(UUID,UUID,UUID,TEXT,TEXT) TO service_role;
COMMIT;
