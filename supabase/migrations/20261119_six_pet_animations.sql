-- Add four purchasable animations; existing items and purchase history stay intact.
BEGIN;
ALTER TABLE public.family_shop_items DROP CONSTRAINT IF EXISTS family_shop_items_action_check;
ALTER TABLE public.family_shop_items ADD CONSTRAINT family_shop_items_action_check
  CHECK (action IN ('eat','drink','pet','happy','play','bath','treat','dress'));
COMMIT;
