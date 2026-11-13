-- Run in an isolated database after all migrations; no data is retained.
BEGIN;
DO $$
DECLARE f UUID; c UUID; d UUID; item UUID; binding UUID; item_version TIMESTAMPTZ; r JSONB; kind TEXT;
BEGIN
  INSERT INTO families(name) VALUES ('six-animations-test') RETURNING id INTO f;
  INSERT INTO children(family_id,nickname,coins_balance) VALUES (f,'test',20) RETURNING id INTO c;
  INSERT INTO devices(family_id,child_id,status,api_token_hash) VALUES (f,c,'paired',repeat('1',64)) RETURNING id,binding_version INTO d,binding;
  FOREACH kind IN ARRAY ARRAY['play','bath','treat','dress'] LOOP
    INSERT INTO family_shop_items(family_id,name,price,action) VALUES(f,'test '||kind,1,kind) RETURNING id,updated_at INTO item,item_version;
    r:=purchase_family_shop_item_scoped(d,item,gen_random_uuid(),1,item_version,binding);
    ASSERT r->>'action'=kind;
  END LOOP;
  ASSERT (SELECT coins_balance FROM children WHERE id=c)=16;
  ASSERT (SELECT count(*) FROM wallet_transactions WHERE child_id=c)=4;
  ASSERT (SELECT count(*) FROM family_shop_items WHERE family_id=f AND builtin_key IN ('water','food'))=2;
  BEGIN
    INSERT INTO family_shop_items(family_id,name,price,action) VALUES(f,'invalid',1,'unknown');
    RAISE EXCEPTION 'invalid animation was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
