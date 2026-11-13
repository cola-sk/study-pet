-- Isolated database only. Run after schema and all migrations; test data rolls back.
BEGIN;
DO $$
DECLARE f UUID; other UUID; c UUID; d UUID; d2 UUID; water UUID; food UUID; custom UUID; req UUID:=gen_random_uuid(); v TIMESTAMPTZ; result JSONB; i INT;
BEGIN
  INSERT INTO families(name) VALUES('shop-test') RETURNING id INTO f;
  INSERT INTO families(name) VALUES('other-shop') RETURNING id INTO other;
  ASSERT (SELECT count(*) FROM family_shop_items WHERE family_id=f)=2;
  SELECT id,updated_at INTO water,v FROM family_shop_items WHERE family_id=f AND builtin_key='water';
  SELECT id INTO food FROM family_shop_items WHERE family_id=f AND builtin_key='food';
  ASSERT (SELECT price FROM family_shop_items WHERE id=water)=1;
  ASSERT (SELECT price FROM family_shop_items WHERE id=food)=2;
  INSERT INTO children(family_id,nickname,coins_balance) VALUES(f,'test',20) RETURNING id INTO c;
  INSERT INTO devices(family_id,child_id,status) VALUES(f,c,'paired') RETURNING id INTO d;
  INSERT INTO devices(family_id,status) VALUES(f,'unassigned') RETURNING id INTO d2;
  result:=purchase_family_shop_item(d,water,req,1,v);
  ASSERT (result->>'credits')::int=19 AND result->>'action'='drink';
  result:=purchase_family_shop_item(d,water,req,1,v);
  ASSERT (result->>'credits')::int=19 AND (result->>'replayed')::boolean;
  ASSERT (SELECT water_count FROM pet_states WHERE child_id=c)=1;
  ASSERT (SELECT count(*) FROM wallet_transactions WHERE child_id=c)=1;
  BEGIN
    PERFORM purchase_family_shop_item(d2,water,gen_random_uuid(),1,v);
    RAISE EXCEPTION 'unassigned device was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM purchase_family_shop_item(d,(SELECT id FROM family_shop_items WHERE family_id=other LIMIT 1),gen_random_uuid(),1,v);
    RAISE EXCEPTION 'cross-family item was accepted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  UPDATE family_shop_items SET price=3 WHERE id=water;
  BEGIN
    PERFORM purchase_family_shop_item(d,water,gen_random_uuid(),1,v);
    RAISE EXCEPTION 'stale price was accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  result:=purchase_family_shop_item(d,water,req,1,v);
  ASSERT (result->>'credits')::int=19; -- replay after price change still uses the original purchase
  BEGIN
    PERFORM purchase_family_shop_item(d,food,req,2,v);
    RAISE EXCEPTION 'conflicting request was accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    UPDATE family_shop_items SET archived=true WHERE id=water;
    RAISE EXCEPTION 'builtin deletion accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  FOR i IN 1..8 LOOP INSERT INTO family_shop_items(family_id,name,price,action) VALUES(f,'creative '||i,2,'happy'); END LOOP;
  ASSERT (SELECT count(*) FROM family_shop_items WHERE family_id=f AND NOT archived)=10;
  BEGIN
    INSERT INTO family_shop_items(family_id,name,price,action) VALUES(f,'overflow',2,'pet');
    RAISE EXCEPTION 'eleventh item was accepted';
  EXCEPTION WHEN program_limit_exceeded THEN NULL; END;
  SELECT id INTO custom FROM family_shop_items WHERE family_id=f AND builtin_key IS NULL LIMIT 1;
  UPDATE family_shop_items SET archived=true WHERE id=custom;
  INSERT INTO family_shop_items(family_id,name,price,action) VALUES(f,'月亮饼干',2,'eat') RETURNING id,updated_at INTO custom,v;
  result:=purchase_family_shop_item(d,custom,gen_random_uuid(),2,v);
  ASSERT (result->>'credits')::int=17 AND result->>'action'='eat';
  ASSERT (SELECT food_count FROM pet_states WHERE child_id=c)=1;
  UPDATE children SET coins_balance=0 WHERE id=c;
  BEGIN
    PERFORM purchase_family_shop_item(d,custom,gen_random_uuid(),2,v);
    RAISE EXCEPTION 'insufficient funds were accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Not enough credits' THEN RAISE; END IF; END;
  ASSERT (SELECT count(*) FROM wallet_transactions WHERE child_id=c)=2;
  ASSERT (SELECT coins_balance FROM children WHERE id=c)=0;
  UPDATE family_shop_items SET archived=true WHERE id=custom;
  BEGIN
    PERFORM purchase_family_shop_item(d,custom,gen_random_uuid(),2,v);
    RAISE EXCEPTION 'archived item accepted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  ASSERT NOT has_function_privilege('authenticated','public.purchase_family_shop_item(uuid,uuid,uuid,integer,timestamptz)','EXECUTE');
  ASSERT NOT has_function_privilege('anon','public.purchase_family_shop_item(uuid,uuid,uuid,integer,timestamptz)','EXECUTE');
END $$;
ROLLBACK;
