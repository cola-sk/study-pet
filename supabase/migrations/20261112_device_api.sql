-- Additive migration. Before running, back up the database. Does not assign a
-- parent or pair a device. Existing anon access is NOT removed by this script.
BEGIN;
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS parents_auth_user_id_unique ON public.parents(auth_user_id) WHERE auth_user_id IS NOT NULL;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS api_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS devices_api_token_hash_unique ON public.devices(api_token_hash) WHERE api_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.device_submit_task(p_device_id UUID, p_task_id UUID, p_request_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE d public.devices%ROWTYPE; t public.task_instances%ROWTYPE; tz TEXT; new_balance INT;
BEGIN
  IF p_request_id IS NULL OR length(p_request_id) < 16 OR length(p_request_id) > 80 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid request ID');
  END IF;
  SELECT * INTO d FROM public.devices WHERE id = p_device_id AND status = 'paired';
  IF NOT FOUND OR d.family_id IS NULL OR d.child_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Device not paired');
  END IF;
  SELECT * INTO t FROM public.task_instances WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR t.family_id <> d.family_id OR t.child_id <> d.child_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Task not available');
  END IF;
  IF t.client_request_id = p_request_id AND t.status IN ('submitted', 'completed', 'rejected') THEN
    RETURN jsonb_build_object('success', true, 'status', t.status, 'alreadyProcessed', true);
  END IF;
  SELECT timezone INTO tz FROM public.families WHERE id = d.family_id;
  IF tz IS NULL OR t.reward_granted OR t.target_date <> (now() AT TIME ZONE tz)::date OR t.status NOT IN ('pending', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Task is not available today');
  END IF;
  IF t.confirm_type = 'auto_confirm' THEN
    UPDATE public.children SET coins_balance = coins_balance + t.reward_coins, updated_at = now()
      WHERE id = d.child_id AND family_id = d.family_id RETURNING coins_balance INTO new_balance;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task child does not belong to family'; END IF;
    UPDATE public.task_instances SET status = 'completed', submitted_at = now(), reviewed_at = now(),
      reward_granted = true, client_request_id = p_request_id, device_id = d.id, updated_at = now() WHERE id = t.id;
    INSERT INTO public.wallet_transactions(family_id, child_id, amount, balance_after, type, description, reference_id)
      VALUES (d.family_id, d.child_id, t.reward_coins, new_balance, 'task_reward', 'Task completion', t.id::text);
    RETURN jsonb_build_object('success', true, 'status', 'completed', 'credits', new_balance);
  ELSIF t.confirm_type = 'parent_confirm' THEN
    UPDATE public.task_instances SET status = 'submitted', submitted_at = now(),
      client_request_id = p_request_id, device_id = d.id, updated_at = now() WHERE id = t.id;
    RETURN jsonb_build_object('success', true, 'status', 'submitted');
  END IF;
  RETURN jsonb_build_object('success', false, 'message', 'Invalid confirmation mode');
END;
$$;
REVOKE ALL ON FUNCTION public.device_submit_task(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.device_submit_task(UUID, UUID, TEXT) TO service_role;
COMMIT;
