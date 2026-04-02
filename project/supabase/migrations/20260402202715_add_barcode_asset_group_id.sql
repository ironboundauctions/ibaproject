/*
  # Add Barcode Asset Group ID to Inventory Items

  1. Changes
    - Add `barcode_asset_group_id` column to `inventory_items` table
    - This tracks the asset group ID for the barcode image in B2 storage
    - Allows proper deletion of barcode images from B2 when item is updated/deleted
  
  2. Purpose
    - Barcode images are now stored in B2 via the worker (not Supabase storage)
    - We need to track the asset_group_id to manage the lifecycle of these images
    - Supports deletion flow: when barcode is removed, we can delete from B2
    - asset_group_id references auction_files.asset_group_id (no FK constraint needed)
*/

-- Add barcode_asset_group_id column
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS barcode_asset_group_id uuid;

-- Add comment for documentation
COMMENT ON COLUMN inventory_items.barcode_asset_group_id IS 'Asset group ID for the barcode image stored in B2 - used for lifecycle management and deletion';
