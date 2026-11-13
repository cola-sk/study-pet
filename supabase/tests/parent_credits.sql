-- Run in an isolated test database after schema.sql and all migrations.
BEGIN;
DO $$
DECLARE
  family UUID; other_family UUID; parent UUID; child UUID; other_child UUID;
  request UUID := gen_random_uuid(); result JSONB; starting_balance INT;
BEGIN
  INSERT INTO public.families(name) VALUES ('reward-test') RETURNING id INTO family;
  INSERT INTO public.families(name) VALUES ('other-test') RETURNING id INTO other_family;
  INSERT INTO public.parents(family_id) VALUES (family) RETURNING id INTO parent;
  INSERT INTO public.children(family_id,nickname) VALUES (family,'test') RETURNING id INTO child;
  INSERT INTO public.children(family_id,nickname) VALUES (other_family,'other') RETURNING id INTO other_child;
  result := public.grant_parent_credits(family,parent,child,20,request,'test reward');
  ASSERT (result->>'credits')::int = 20 AND NOT (result->>'replayed')::boolean;
  result := public.grant_parent_credits(family,parent,child,20,request,'test reward');
  ASSERT (result->>'credits')::int = 20 AND (result->>'replayed')::boolean;
  ASSERT (SELECT count(*) FROM public.wallet_transactions WHERE child_id = child) = 1;
  ASSERT (SELECT created_by_parent_id FROM public.wallet_transactions WHERE child_id = child) = parent;
  BEGIN
    PERFORM public.grant_parent_credits(family,parent,child,30,request,'test reward');
    RAISE EXCEPTION 'conflicting retry was accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    PERFORM public.grant_parent_credits(family,parent,other_child,10,gen_random_uuid(),'');
    RAISE EXCEPTION 'cross-family child was accepted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    PERFORM public.grant_parent_credits(other_family,parent,other_child,10,gen_random_uuid(),'');
    RAISE EXCEPTION 'cross-family parent was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  FOREACH starting_balance IN ARRAY ARRAY[0,-1,10001] LOOP
    BEGIN
      PERFORM public.grant_parent_credits(family,parent,child,starting_balance,gen_random_uuid(),'');
      RAISE EXCEPTION 'invalid amount was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  END LOOP;
  UPDATE public.children SET coins_balance = 2147483640 WHERE id = child;
  BEGIN
    PERFORM public.grant_parent_credits(family,parent,child,20,gen_random_uuid(),'');
    RAISE EXCEPTION 'overflow was accepted';
  EXCEPTION WHEN numeric_value_out_of_range THEN NULL; END;
  ASSERT (SELECT count(*) FROM public.wallet_transactions WHERE child_id = child) = 1;
  ASSERT NOT has_function_privilege('anon','public.grant_parent_credits(uuid,uuid,uuid,integer,uuid,text)','EXECUTE');
  ASSERT NOT has_function_privilege('authenticated','public.grant_parent_credits(uuid,uuid,uuid,integer,uuid,text)','EXECUTE');
  ASSERT has_function_privilege('service_role','public.grant_parent_credits(uuid,uuid,uuid,integer,uuid,text)','EXECUTE');
END $$;
ROLLBACK;
