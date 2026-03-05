# Display Order Fix - All Uploads Go to End of Gallery

## Problem
New files uploaded via PC or IronDrive were appearing at position 0 or 1 in the gallery instead of at the end.

## Root Cause
When creating new auction_files records, the `display_order` column was not being set, so it defaulted to 0, placing new uploads at the beginning of the gallery.

## Solution

### PC Uploads (via Worker)
**Files Modified:**
- `worker/src/services/database.ts`
  - Added `getNextDisplayOrder(itemId)` function to calculate the next available position
  - Updated `upsertVariant()` to accept and set `display_order` parameter

- `worker/src/services/uploadHandler.ts`
  - Now calls `getNextDisplayOrder()` before processing uploads
  - Passes `displayOrder` to all variant creation calls

**How it works:**
1. Before creating files, query for MAX(display_order) for the item
2. Set new files to (max + 1), or 0 if no files exist yet
3. All variants (source, display, thumb) get the same display_order

**Deployment Required:**
The worker needs to be redeployed to Railway. See `worker/REDEPLOY_INSTRUCTIONS.md` for details.

### IronDrive Uploads (Frontend)

**Files Modified:**
- `src/components/InventoryItemForm.tsx` (old form, used in event-specific inventory)
  - Fixed schema to use current columns (source_key, variant, published_status)
  - Added query to get next display_order before inserting files
  - Each file gets incremented display_order (max+1, max+2, max+3, etc.)

- `src/components/InventoryItemFormNew.tsx` (new form, used in global inventory)
  - Already correctly setting display_order based on selectedFiles array index
  - No changes needed

**How it works:**
1. Query for MAX(display_order) for the item
2. Insert each IronDrive file with incremented display_order
3. Worker processes these files and publishes variants (maintaining the same display_order)

## Testing

### PC Uploads
1. Open an existing inventory item with 3+ images
2. Note the current order and count
3. Upload a new image via PC upload
4. Verify it appears at the END of the gallery
5. Save and reload - order should be preserved

### IronDrive Uploads
1. Open an existing inventory item with 3+ images
2. Open IronDrive picker and select files
3. Selected files should appear at the end of the gallery preview
4. Save the item
5. Reload and verify the order is preserved

## Status
- ✅ Frontend changes deployed (both forms fixed)
- ⏳ Worker changes need Railway deployment for PC uploads
- ✅ IronDrive uploads fixed immediately (no worker dependency)

After worker deployment, all upload methods will correctly append new files to the end of the gallery.
