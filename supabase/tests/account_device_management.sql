-- Run only in an isolated database after schema and all migrations.
BEGIN;
DO $$
DECLARE f UUID; other UUID; c UUID; c2 UUID; foreign_child UUID; d UUID; water UUID;
  v TIMESTAMPTZ; item_v TIMESTAMPTZ; binding UUID; req UUID:=gen_random_uuid(); r JSONB;
  parent_user UUID:=gen_random_uuid(); parent_id UUID; code TEXT:=repeat('a',64); old_token TEXT:=repeat('b',64); new_token TEXT:=repeat('c',64);
BEGIN
  INSERT INTO families(name) VALUES('management-test') RETURNING id INTO f;
  INSERT INTO families(name) VALUES('management-other') RETURNING id INTO other;
  INSERT INTO children(family_id,nickname,coins_balance) VALUES(f,'first',20) RETURNING id INTO c;
  INSERT INTO children(family_id,nickname,coins_balance) VALUES(f,'second',30) RETURNING id INTO c2;
  INSERT INTO children(family_id,nickname) VALUES(other,'foreign') RETURNING id INTO foreign_child;
  ASSERT (SELECT pet_name FROM children WHERE id=c)='小二哈';
  UPDATE children SET nickname='new child',pet_name='new pet' WHERE id=c;
  ASSERT (SELECT coins_balance FROM children WHERE id=c)=20;
  INSERT INTO devices(family_id,status,api_token_hash) VALUES(f,'unassigned',old_token) RETURNING id,updated_at,binding_version INTO d,v,binding;
  BEGIN
    PERFORM manage_family_device(other,d,'rename',v,NULL,'intruder');
    RAISE EXCEPTION 'cross-family management accepted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  PERFORM manage_family_device(f,d,'rename',v,NULL,'my device');
  ASSERT (SELECT alias FROM devices WHERE id=d)='my device';
  ASSERT (SELECT binding_version FROM devices WHERE id=d)=binding;
  BEGIN
    PERFORM manage_family_device(f,d,'unlink',v);
    RAISE EXCEPTION 'stale write accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  SELECT updated_at INTO v FROM devices WHERE id=d;
  BEGIN
    PERFORM manage_family_device(f,d,'assign',v,foreign_child);
    RAISE EXCEPTION 'cross-family child accepted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  r:=assign_device_child(f,d,c); ASSERT (r->>'success')::boolean;
  ASSERT (SELECT binding_version FROM devices WHERE id=d)<>binding;
  SELECT updated_at,binding_version INTO v,binding FROM devices WHERE id=d;
  PERFORM assign_device_child(f,d,c);
  ASSERT (SELECT binding_version FROM devices WHERE id=d)=binding;
  BEGIN
    PERFORM assign_device_child(f,d,c2);
    RAISE EXCEPTION 'legacy reassignment accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  SELECT id,updated_at INTO water,item_v FROM family_shop_items WHERE family_id=f AND builtin_key='water';
  BEGIN
    PERFORM purchase_family_shop_item_scoped(d,water,req,1,item_v,NULL);
    RAISE EXCEPTION 'unscoped debit accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  r:=purchase_family_shop_item_scoped(d,water,req,1,item_v,binding);
  ASSERT (r->>'credits')::int=19;
  r:=purchase_family_shop_item_scoped(d,water,req,1,item_v,NULL);
  ASSERT (r->>'replayed')::boolean AND (SELECT coins_balance FROM children WHERE id=c)=19;
  PERFORM manage_family_device(f,d,'assign',v,c2);
  ASSERT (SELECT binding_version FROM devices WHERE id=d)<>binding;
  BEGIN
    PERFORM purchase_family_shop_item_scoped(d,water,gen_random_uuid(),1,item_v,binding);
    RAISE EXCEPTION 'old menu charged new child';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  BEGIN
    PERFORM purchase_family_shop_item_scoped(d,water,req,1,item_v,NULL);
    RAISE EXCEPTION 'old purchase replay accepted on new child';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  ASSERT (SELECT coins_balance FROM children WHERE id=c2)=30;
  SELECT updated_at,binding_version INTO v,binding FROM devices WHERE id=d;
  r:=purchase_family_shop_item_scoped(d,water,gen_random_uuid(),1,item_v,binding);
  ASSERT (r->>'credits')::int=29;
  PERFORM manage_family_device(f,d,'unlink',v);
  ASSERT (SELECT status='revoked' AND child_id IS NULL AND family_id=f AND api_token_hash=old_token FROM devices WHERE id=d);
  ASSERT (SELECT count(*) FROM device_shop_purchases WHERE device_id=d)=2;
  ASSERT (SELECT count(*) FROM wallet_transactions WHERE child_id IN(c,c2))=2;
  BEGIN
    PERFORM purchase_family_shop_item_scoped(d,water,gen_random_uuid(),1,item_v,binding);
    RAISE EXCEPTION 'revoked purchase accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO auth.users(id,email) VALUES(parent_user,'isolated-management@example.invalid');
  INSERT INTO parents(auth_user_id,family_id,nickname) VALUES(parent_user,f,'test') RETURNING id INTO parent_id;
  INSERT INTO parent_pairing_codes(parent_id,family_id,code_hash,format_version) VALUES(parent_id,f,code,2);
  r:=pair_device_to_family(code,old_token,repeat('d',64)); ASSERT NOT (r->>'success')::boolean;
  r:=pair_device_to_family(code,new_token,repeat('e',64)); ASSERT (r->>'success')::boolean;
  ASSERT (SELECT count(*) FROM devices WHERE family_id=f AND status='unassigned' AND api_token_hash=new_token)=1;
  ASSERT NOT has_function_privilege('authenticated','public.manage_family_device(uuid,uuid,text,timestamptz,uuid,text)','EXECUTE');
  ASSERT NOT has_function_privilege('anon','public.purchase_family_shop_item_scoped(uuid,uuid,uuid,integer,timestamptz,uuid)','EXECUTE');
END $$;
ROLLBACK;
