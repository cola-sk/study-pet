-- Before applying: back up data and deploy the server with service-role access.
-- This enables RLS and revokes direct client access to the listed app tables.
-- Old browser-direct Supabase reads/writes will stop until migrated to APIs.
BEGIN;
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS parents_auth_user_id_unique ON public.parents(auth_user_id) WHERE auth_user_id IS NOT NULL;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS api_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS devices_api_token_hash_unique ON public.devices(api_token_hash) WHERE api_token_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.parent_pairing_codes (
  parent_id UUID PRIMARY KEY REFERENCES public.parents(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parent_pairing_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parent_pairing_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.parent_pairing_codes TO service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_parent_family(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE family UUID; parent UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN RAISE EXCEPTION 'Unknown user'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT id, family_id INTO parent, family FROM public.parents WHERE auth_user_id = p_user_id;
  IF parent IS NULL THEN
    INSERT INTO public.families(name) VALUES ('我的家庭') RETURNING id INTO family;
    INSERT INTO public.parents(family_id, auth_user_id) VALUES (family, p_user_id) RETURNING id INTO parent;
  ELSIF family IS NULL THEN
    RAISE EXCEPTION 'Parent has no family';
  END IF;
  RETURN jsonb_build_object('familyId', family);
END $$;

CREATE OR REPLACE FUNCTION public.pair_device_to_family(p_code_hash TEXT, p_token_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE family UUID; existing public.devices%ROWTYPE;
BEGIN
  IF p_code_hash !~ '^[0-9a-f]{64}$' OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('success', false); END IF;
  SELECT pc.family_id INTO family FROM public.parent_pairing_codes pc
    JOIN public.parents p ON p.id = pc.parent_id AND p.family_id = pc.family_id
    WHERE pc.code_hash = p_code_hash;
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

CREATE OR REPLACE FUNCTION public.assign_device_child(p_family_id UUID, p_device_id UUID, p_child_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.children WHERE id = p_child_id AND family_id = p_family_id) THEN RETURN jsonb_build_object('success', false); END IF;
  UPDATE public.devices SET child_id = p_child_id, status = 'paired', updated_at = now()
    WHERE id = p_device_id AND family_id = p_family_id AND api_token_hash IS NOT NULL;
  RETURN jsonb_build_object('success', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.bootstrap_parent_family(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pair_device_to_family(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_device_child(UUID,UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_parent_family(UUID), public.pair_device_to_family(TEXT,TEXT), public.assign_device_child(UUID,UUID,UUID) TO service_role;

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.families, public.parents, public.children, public.devices, public.task_templates, public.task_instances, public.wallet_transactions, public.shop_items, public.pet_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.families, public.parents, public.children, public.devices, public.task_templates, public.task_instances, public.wallet_transactions, public.shop_items, public.pet_states TO service_role;
REVOKE ALL ON FUNCTION public.approve_task_and_reward(UUID,TEXT), public.reject_task(UUID,TEXT) FROM PUBLIC, anon, authenticated;
COMMIT;
