/*
  # Fix update_display_order (3-arg overload) Search Path

  ## Summary
  A second overload of update_display_order(p_item_id, p_asset_group_id, p_display_order)
  was missing SET search_path = public. This adds it to eliminate the mutable
  search_path security warning.

  ## Changes
  - Recreate the 3-argument overload of update_display_order with SET search_path = public
  - Body is identical — only the search_path config is added
*/

CREATE OR REPLACE FUNCTION public.update_display_order(
  p_item_id uuid,
  p_asset_group_id uuid,
  p_display_order integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
UPDATE auction_files
SET display_order = p_display_order,
    updated_at = NOW()
WHERE item_id = p_item_id
  AND asset_group_id = p_asset_group_id;
$$;
