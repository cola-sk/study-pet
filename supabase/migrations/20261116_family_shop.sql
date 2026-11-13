-- Family catalog: 2 built-ins + up to 8 custom items. No changes to legacy shop_items.
BEGIN;
CREATE TABLE IF NOT EXISTS public.family_shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 12 AND name = btrim(name)),
  price INT NOT NULL CHECK (price BETWEEN 1 AND 10000),
  action TEXT NOT NULL CHECK (action IN ('eat','drink','pet','happy')),
  builtin_key TEXT CHECK (builtin_key IN ('water','food')),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id,builtin_key),
  CHECK (builtin_key IS NULL OR (NOT archived AND
    ((builtin_key = 'water' AND name = 'Water' AND action = 'drink') OR
     (builtin_key = 'food' AND name = 'Food' AND action = 'eat'))))
);
CREATE UNIQUE INDEX IF NOT EXISTS family_shop_item_name_unique ON public.family_shop_items(family_id,lower(name)) WHERE NOT archived;
ALTER TABLE public.family_shop_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_shop_items FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.family_shop_items TO service_role;
CREATE OR REPLACE FUNCTION public.limit_family_shop_items() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog,public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := clock_timestamp(); END IF;
  IF TG_OP = 'UPDATE' AND (NEW.family_id <> OLD.family_id OR NEW.builtin_key IS DISTINCT FROM OLD.builtin_key) THEN
    RAISE EXCEPTION 'Cannot move shop item' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.family_id::text,16));
  IF NOT NEW.archived AND (SELECT count(*) FROM public.family_shop_items WHERE family_id=NEW.family_id AND NOT archived AND id<>NEW.id) >= 10 THEN
    RAISE EXCEPTION 'Maximum 10 items' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS family_shop_limit ON public.family_shop_items;
CREATE TRIGGER family_shop_limit BEFORE INSERT OR UPDATE ON public.family_shop_items FOR EACH ROW EXECUTE FUNCTION public.limit_family_shop_items();
CREATE OR REPLACE FUNCTION public.seed_family_shop() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
BEGIN
  INSERT INTO public.family_shop_items(family_id,name,price,action,builtin_key) VALUES
    (NEW.id,'Water',1,'drink','water'), (NEW.id,'Food',2,'eat','food') ON CONFLICT(family_id,builtin_key) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS family_shop_defaults ON public.families;
CREATE TRIGGER family_shop_defaults AFTER INSERT ON public.families FOR EACH ROW EXECUTE FUNCTION public.seed_family_shop();
INSERT INTO public.family_shop_items(family_id,name,price,action,builtin_key)
 SELECT f.id,v.name,v.price,v.action,v.key FROM public.families f CROSS JOIN
 (VALUES ('Water',1,'drink','water'),('Food',2,'eat','food')) v(name,price,action,key)
 WHERE NOT EXISTS (SELECT 1 FROM public.family_shop_items s WHERE s.family_id=f.id AND s.builtin_key=v.key)
 ON CONFLICT(family_id,builtin_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.device_shop_purchases (
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.family_shop_items(id),
  expected_price INT NOT NULL,
  expected_version TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  transaction_id UUID NOT NULL REFERENCES public.wallet_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(device_id,request_id)
);
ALTER TABLE public.device_shop_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_shop_purchases FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.device_shop_purchases TO service_role;

CREATE OR REPLACE FUNCTION public.purchase_family_shop_item(p_device_id UUID,p_item_id UUID,p_request_id UUID,p_expected_price INT,p_expected_version TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE d public.devices%ROWTYPE; item public.family_shop_items%ROWTYPE; previous public.device_shop_purchases%ROWTYPE;
  balance INT; tx UUID;
BEGIN
  IF p_request_id IS NULL OR p_expected_price IS NULL OR p_expected_version IS NULL THEN RAISE EXCEPTION 'Invalid purchase' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_id::text || ':' || p_request_id::text,17));
  SELECT * INTO d FROM public.devices WHERE id=p_device_id FOR SHARE;
  IF NOT FOUND OR d.status<>'paired' OR d.family_id IS NULL OR d.child_id IS NULL THEN RAISE EXCEPTION 'Device unavailable' USING ERRCODE='42501'; END IF;
  SELECT coins_balance INTO balance FROM public.children WHERE id=d.child_id AND family_id=d.family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Child unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO previous FROM public.device_shop_purchases WHERE device_id=d.id AND request_id=p_request_id;
  IF FOUND THEN
    IF previous.item_id<>p_item_id OR previous.child_id<>d.child_id OR previous.family_id<>d.family_id OR previous.expected_price<>p_expected_price OR previous.expected_version<>p_expected_version THEN
      RAISE EXCEPTION 'Request already used' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('credits',balance,'action',previous.action,'replayed',true);
  END IF;
  SELECT * INTO item FROM public.family_shop_items WHERE id=p_item_id AND family_id=d.family_id AND NOT archived FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item unavailable' USING ERRCODE='P0002'; END IF;
  IF item.price<>p_expected_price OR item.updated_at<>p_expected_version THEN RAISE EXCEPTION 'Item changed' USING ERRCODE='40001'; END IF;
  IF balance<item.price THEN RAISE EXCEPTION 'Not enough credits' USING ERRCODE='P0001'; END IF;
  UPDATE public.children SET coins_balance=coins_balance-item.price,updated_at=now() WHERE id=d.child_id RETURNING coins_balance INTO balance;
  INSERT INTO public.wallet_transactions(family_id,child_id,amount,balance_after,type,description,reference_id)
    VALUES(d.family_id,d.child_id,-item.price,balance,'shop_purchase','兑换：'||item.name,p_request_id::text) RETURNING id INTO tx;
  INSERT INTO public.pet_states(family_id,child_id,food_count,water_count)
    VALUES(d.family_id,d.child_id,CASE WHEN item.action='eat' THEN 1 ELSE 0 END,CASE WHEN item.action='drink' THEN 1 ELSE 0 END)
    ON CONFLICT(child_id) DO UPDATE SET food_count=pet_states.food_count+excluded.food_count,water_count=pet_states.water_count+excluded.water_count,updated_at=now();
  INSERT INTO public.device_shop_purchases(device_id,request_id,family_id,child_id,item_id,expected_price,expected_version,action,transaction_id)
    VALUES(d.id,p_request_id,d.family_id,d.child_id,item.id,p_expected_price,p_expected_version,item.action,tx);
  RETURN jsonb_build_object('credits',balance,'action',item.action,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.limit_family_shop_items(),public.seed_family_shop(),public.purchase_family_shop_item(UUID,UUID,UUID,INT,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_family_shop_item(UUID,UUID,UUID,INT,TIMESTAMPTZ) TO service_role;
COMMIT;
