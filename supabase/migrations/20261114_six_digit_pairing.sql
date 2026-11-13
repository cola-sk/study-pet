-- Run after 20261112_device_api.sql and 20261113_account_pairing.sql.
-- Existing 20-character pairing codes are replaced on the next authenticated
-- code lookup. Already-paired devices keep their independent credentials.
BEGIN;
ALTER TABLE public.parent_pairing_codes ADD COLUMN IF NOT EXISTS nonce INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.parent_pairing_codes ADD COLUMN IF NOT EXISTS format_version SMALLINT NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS public.pair_attempt_limits (
  scope TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL
);
ALTER TABLE public.pair_attempt_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pair_attempt_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pair_attempt_limits TO service_role;
CREATE INDEX IF NOT EXISTS pair_attempt_limits_window_idx ON public.pair_attempt_limits(window_start);

DROP FUNCTION IF EXISTS public.pair_device_to_family(TEXT,TEXT);
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
    IF existing.family_id IS DISTINCT FROM family THEN RETURN jsonb_build_object('success', false); END IF;
    RETURN jsonb_build_object('success', true, 'child_assigned', existing.child_id IS NOT NULL);
  END IF;
  INSERT INTO public.devices(family_id, child_id, status, api_token_hash, alias)
    VALUES (family, NULL, 'unassigned', p_token_hash, '桌面宠物');
  RETURN jsonb_build_object('success', true, 'child_assigned', false);
END $$;
REVOKE ALL ON FUNCTION public.pair_device_to_family(TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pair_device_to_family(TEXT,TEXT,TEXT) TO service_role;
COMMIT;
