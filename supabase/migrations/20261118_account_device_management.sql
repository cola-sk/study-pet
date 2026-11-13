-- Incremental: preserves children, wallets, task and purchase history.
BEGIN;
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS pet_name VARCHAR(50) NOT NULL DEFAULT '小二哈';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS binding_version UUID NOT NULL DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.manage_family_device(
  p_family_id UUID,p_device_id UUID,p_action TEXT,p_expected_version TIMESTAMPTZ,
  p_child_id UUID DEFAULT NULL,p_alias TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d public.devices%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.devices WHERE id=p_device_id AND family_id=p_family_id
    AND status IN ('paired','unassigned') AND api_token_hash IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Device not found' USING ERRCODE='P0002'; END IF;
  IF p_expected_version IS NULL OR d.updated_at<>p_expected_version THEN RAISE EXCEPTION 'Device changed; refresh' USING ERRCODE='40001'; END IF;
  IF p_action='rename' THEN
    IF p_alias IS NULL OR length(btrim(p_alias)) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid name' USING ERRCODE='22023'; END IF;
    UPDATE public.devices SET alias=btrim(p_alias),updated_at=clock_timestamp() WHERE id=d.id;
  ELSIF p_action='assign' THEN
    IF NOT EXISTS(SELECT 1 FROM public.children WHERE id=p_child_id AND family_id=p_family_id) THEN RAISE EXCEPTION 'Child not found' USING ERRCODE='P0002'; END IF;
    IF d.child_id IS DISTINCT FROM p_child_id THEN
      UPDATE public.devices SET child_id=p_child_id,status='paired',binding_version=gen_random_uuid(),updated_at=clock_timestamp() WHERE id=d.id;
    END IF;
  ELSIF p_action='unlink' THEN
    -- Keep the old credential as a revoked tombstone and retain its history.
    UPDATE public.devices SET child_id=NULL,status='revoked',binding_version=gen_random_uuid(),updated_at=clock_timestamp() WHERE id=d.id;
  ELSE RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('success',true);
END $$;

-- The legacy assignment entry point may complete initial pairing only.
-- Reassignment must use the versioned management function above.
CREATE OR REPLACE FUNCTION public.assign_device_child(p_family_id UUID,p_device_id UUID,p_child_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d public.devices%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.devices WHERE id=p_device_id AND family_id=p_family_id
    AND status IN ('paired','unassigned') AND api_token_hash IS NOT NULL FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.children WHERE id=p_child_id AND family_id=p_family_id) THEN RETURN jsonb_build_object('success',false); END IF;
  IF d.child_id IS NOT NULL AND d.child_id<>p_child_id THEN RAISE EXCEPTION 'Use device management to reassign' USING ERRCODE='40001'; END IF;
  IF d.child_id IS NULL THEN
    UPDATE public.devices SET child_id=p_child_id,status='paired',binding_version=gen_random_uuid(),updated_at=clock_timestamp() WHERE id=d.id;
  END IF;
  RETURN jsonb_build_object('success',true);
END $$;

-- Lock the binding until the purchase transaction finishes. An old menu or
-- offline retry cannot debit a different child after device reassignment.
CREATE OR REPLACE FUNCTION public.purchase_family_shop_item_scoped(
  p_device_id UUID,p_item_id UUID,p_request_id UUID,p_expected_price INT,
  p_expected_version TIMESTAMPTZ,p_expected_binding UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d public.devices%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.devices WHERE id=p_device_id AND status='paired' FOR SHARE;
  IF NOT FOUND OR d.child_id IS NULL THEN RAISE EXCEPTION 'Device unavailable' USING ERRCODE='42501'; END IF;
  IF p_expected_binding IS NULL THEN
    -- Upgrading old firmware: allow an already committed request to be
    -- confirmed, but never initiate an unscoped debit.
    IF NOT EXISTS(SELECT 1 FROM public.device_shop_purchases WHERE device_id=d.id AND request_id=p_request_id
      AND child_id=d.child_id AND family_id=d.family_id) THEN
      RAISE EXCEPTION 'Refresh shop first' USING ERRCODE='40001';
    END IF;
  ELSIF d.binding_version<>p_expected_binding THEN
    RAISE EXCEPTION 'Device assignment changed' USING ERRCODE='40001';
  END IF;
  RETURN public.purchase_family_shop_item(p_device_id,p_item_id,p_request_id,p_expected_price,p_expected_version);
END $$;
REVOKE ALL ON FUNCTION public.manage_family_device(UUID,UUID,TEXT,TIMESTAMPTZ,UUID,TEXT),
  public.purchase_family_shop_item_scoped(UUID,UUID,UUID,INT,TIMESTAMPTZ,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_family_device(UUID,UUID,TEXT,TIMESTAMPTZ,UUID,TEXT),
  public.purchase_family_shop_item_scoped(UUID,UUID,UUID,INT,TIMESTAMPTZ,UUID) TO service_role;

-- A revoked credential cannot be reused even with a valid family code.
CREATE OR REPLACE FUNCTION public.pair_device_to_family(p_code_hash TEXT, p_token_hash TEXT, p_source_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE family UUID; existing public.devices%ROWTYPE; counter INTEGER; moment TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_code_hash !~ '^[0-9a-f]{64}$' OR p_token_hash !~ '^[0-9a-f]{64}$' OR p_source_hash !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('success', false); END IF;
  -- Shared across all application instances and all source addresses: no more
  -- than 20 attempts per 15 minutes, including successful and invalid codes.
  INSERT INTO public.pair_attempt_limits(scope,window_start,attempts) VALUES ('global',moment,1)
  ON CONFLICT(scope) DO UPDATE SET
    window_start = CASE WHEN public.pair_attempt_limits.window_start <= moment - interval '15 minutes' THEN moment ELSE public.pair_attempt_limits.window_start END,
    attempts = CASE WHEN public.pair_attempt_limits.window_start <= moment - interval '15 minutes' THEN 1 ELSE public.pair_attempt_limits.attempts + 1 END
  RETURNING attempts INTO counter;
  IF counter > 20 THEN RETURN jsonb_build_object('success', false); END IF;
  INSERT INTO public.pair_attempt_limits(scope,window_start,attempts) VALUES ('source:' || p_source_hash,moment,1)
  ON CONFLICT(scope) DO UPDATE SET
    window_start = CASE WHEN public.pair_attempt_limits.window_start <= moment - interval '15 minutes' THEN moment ELSE public.pair_attempt_limits.window_start END,
    attempts = CASE WHEN public.pair_attempt_limits.window_start <= moment - interval '15 minutes' THEN 1 ELSE public.pair_attempt_limits.attempts + 1 END
  RETURNING attempts INTO counter;
  IF counter > 5 THEN RETURN jsonb_build_object('success', false); END IF;
  SELECT pc.family_id INTO family FROM public.parent_pairing_codes pc
    JOIN public.parents p ON p.id = pc.parent_id AND p.family_id = pc.family_id
    WHERE pc.code_hash = p_code_hash AND pc.format_version = 2;
  IF family IS NULL THEN RETURN jsonb_build_object('success', false); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_token_hash, 1));
  SELECT * INTO existing FROM public.devices WHERE api_token_hash = p_token_hash FOR UPDATE;
  IF FOUND THEN
    IF existing.status NOT IN ('paired','unassigned') OR existing.family_id IS DISTINCT FROM family THEN RETURN jsonb_build_object('success', false); END IF;
    RETURN jsonb_build_object('success', true, 'child_assigned', existing.child_id IS NOT NULL);
  END IF;
  INSERT INTO public.devices(family_id, child_id, status, api_token_hash, alias)
    VALUES (family, NULL, 'unassigned', p_token_hash, '桌面宠物');
  RETURN jsonb_build_object('success', true, 'child_assigned', false);
END $$;
COMMIT;
