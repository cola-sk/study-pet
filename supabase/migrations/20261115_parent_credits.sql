-- Run after the account/pairing migrations. Adds parent rewards without changing existing balances.
BEGIN;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS created_by_parent_id UUID REFERENCES public.parents(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_parent_grant_request_unique
  ON public.wallet_transactions(family_id, reference_id) WHERE type = 'parent_grant';

CREATE OR REPLACE FUNCTION public.grant_parent_credits(
  p_family_id UUID, p_parent_id UUID, p_child_id UUID, p_amount INT,
  p_request_id UUID, p_note TEXT DEFAULT ''
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_balance INT;
  v_existing public.wallet_transactions%ROWTYPE;
  v_transaction public.wallet_transactions%ROWTYPE;
  v_description TEXT := coalesce(nullif(btrim(p_note), ''), '家长奖励');
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 10000 OR p_request_id IS NULL OR length(v_description) > 200 THEN
    RAISE EXCEPTION 'Invalid reward' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parents WHERE id = p_parent_id AND family_id = p_family_id) THEN
    RAISE EXCEPTION 'Family unavailable' USING ERRCODE = '42501';
  END IF;
  -- Serialize retries even when the same request ID is submitted for different children.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_family_id::text || ':' || p_request_id::text, 15));
  SELECT coins_balance INTO v_balance FROM public.children
    WHERE id = p_child_id AND family_id = p_family_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Child unavailable' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_existing FROM public.wallet_transactions
    WHERE family_id = p_family_id AND type = 'parent_grant' AND reference_id = p_request_id::text;
  IF FOUND THEN
    IF v_existing.child_id <> p_child_id OR v_existing.amount <> p_amount
       OR v_existing.description <> v_description OR v_existing.created_by_parent_id IS DISTINCT FROM p_parent_id THEN
      RAISE EXCEPTION 'Request ID already used' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('credits', v_balance, 'transaction', to_jsonb(v_existing), 'replayed', true);
  END IF;
  IF v_balance > 2147483647 - p_amount THEN RAISE EXCEPTION 'Balance limit reached' USING ERRCODE = '22003'; END IF;
  UPDATE public.children SET coins_balance = coins_balance + p_amount, updated_at = now()
    WHERE id = p_child_id RETURNING coins_balance INTO v_balance;
  INSERT INTO public.wallet_transactions(family_id, child_id, amount, balance_after, type, description, reference_id, created_by_parent_id)
    VALUES (p_family_id, p_child_id, p_amount, v_balance, 'parent_grant', v_description, p_request_id::text, p_parent_id)
    RETURNING * INTO v_transaction;
  RETURN jsonb_build_object('credits', v_balance, 'transaction', to_jsonb(v_transaction), 'replayed', false);
END $$;
REVOKE ALL ON FUNCTION public.grant_parent_credits(UUID,UUID,UUID,INT,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_parent_credits(UUID,UUID,UUID,INT,UUID,TEXT) TO service_role;
COMMIT;
