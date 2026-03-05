/*
  # Fix Published Status Being Reset on Display Order Update

  ## Problem
  When updating display_order via Supabase client, the published_status is being
  reset from 'published' to 'pending' (the column default). This causes PC-uploaded
  files to not appear in file counts.

  ## Solution
  Create an RPC function that explicitly updates only display_order without
  affecting published_status.

  ## Changes
  1. Create function `update_display_order()`
  2. Function updates display_order for all variants of an asset group
  3. Explicitly preserves all other columns including published_status
*/

CREATE OR REPLACE FUNCTION update_display_order(
  p_item_id uuid,
  p_asset_group_id uuid,
  p_display_order integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE auction_files
  SET display_order = p_display_order,
      updated_at = NOW()
  WHERE item_id = p_item_id
    AND asset_group_id = p_asset_group_id;
$$;

COMMENT ON FUNCTION update_display_order IS 'Updates display_order for all variants of an asset group without affecting other columns';
