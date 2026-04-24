-- Clean up duplicate inventory items T126185 and T126186
-- This will soft-delete the items and their associated files

-- Soft delete the inventory items
UPDATE inventory_items
SET deleted_at = NOW()
WHERE inventory_number IN ('T126185', 'T126186')
AND deleted_at IS NULL;

-- Verify the deletion
SELECT
  inventory_number,
  id,
  created_at,
  deleted_at,
  barcode_asset_group_id
FROM inventory_items
WHERE inventory_number IN ('T126185', 'T126186', 'T126187')
ORDER BY inventory_number;

-- Check associated files (they should still exist but unlinked)
SELECT
  af.id,
  af.asset_group_id,
  af.variant,
  af.item_id,
  ii.inventory_number
FROM auction_files af
LEFT JOIN inventory_items ii ON af.item_id = ii.id
WHERE ii.inventory_number IN ('T126185', 'T126186', 'T126187')
ORDER BY ii.inventory_number, af.asset_group_id, af.variant;
