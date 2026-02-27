# Fresh Testing Checklist

After cleaning up all test data, follow this checklist to verify IronDrive integration works correctly.

## Pre-Test Setup

1. **Clean Database**
   - Run `CLEANUP_ALL_TEST_DATA.sql` in Supabase SQL Editor
   - Verify all inventory items are deleted
   - Verify all auction_files are soft-deleted or removed

2. **Clean B2 Bucket** (Optional, if you want fully fresh)
   - Go to Backblaze B2 console
   - Delete all files in `IBA-Lot-Media/assets/` folder
   - Or keep them - the system will just create new ones

3. **Verify Worker is Running**
   - Check Railway logs for the worker
   - Worker should be polling for jobs every 10 seconds

## Test 1: Create New Item with IronDrive Images

### Steps:
1. Go to Admin → Global Inventory
2. Click "Add New Item"
3. Fill in basic details (inventory number, title)
4. Click "Pick from IronDrive"
5. Select 2-3 images from IronDrive
6. **Check Form Behavior:**
   - [ ] Images should show as "Ready" with green checkmark
   - [ ] Form should stay open (not close immediately)
7. Click "Create Item"
8. **Check Processing:**
   - [ ] Form should show "Processing X IronDrive files..."
   - [ ] Should see polling messages in console
   - [ ] After ~5-15 seconds, images should appear in form preview
   - [ ] Form should stay open showing the processed images
9. Close the form manually

### Expected Results:
- Item created successfully
- Images visible in form after processing
- Console shows `[POLL] All files processed!`
- Console shows CDN URLs in `[POLL] File ready:`

## Test 2: Verify Inventory Thumbnail

### Steps:
1. Look at the inventory grid/list
2. Find the item you just created
3. **Check Thumbnail:**
   - [ ] Should show actual image (not orange excavator fallback)
   - [ ] Should show image count badge
   - [ ] Hovering should show "Click to view gallery"

### Expected Results:
- Console shows `[INVENTORY] Thumbnails loaded:` with CDN URLs
- Thumbnail displays correctly
- No fallback image needed

## Test 3: Edit Item and View Images

### Steps:
1. Click "Edit" on the item
2. **Check Form:**
   - [ ] Should load with images visible immediately
   - [ ] Images should have CDN URLs (not white boxes)
   - [ ] Console shows `[LOAD] Building file object:` with CDN URLs
3. Try to reorder images by dragging
4. Save changes

### Expected Results:
- Images load immediately in edit mode
- All images visible with thumbnails
- Reordering works
- Save completes successfully

## Test 4: Gallery View

### Steps:
1. Click the thumbnail image in inventory grid
2. **Check Gallery Modal:**
   - [ ] All images should display in gallery
   - [ ] Can navigate between images
   - [ ] Full-size images load from CDN

### Expected Results:
- Gallery opens with all images
- Images display at full quality
- Navigation works smoothly

## Test 5: Upload PC Files (Baseline)

### Steps:
1. Create another new item
2. Use "Upload from PC" instead
3. Select 2-3 images from computer
4. Create item

### Expected Results:
- PC upload works as before
- Images appear immediately (no processing wait)
- Thumbnail shows immediately

## Test 6: Mixed Upload (IronDrive + PC)

### Steps:
1. Create another new item
2. Upload 1-2 images from PC
3. Then pick 1-2 from IronDrive
4. Create item

### Expected Results:
- Both types of images work together
- PC images available immediately
- IronDrive images process and appear after ~5-15 seconds
- All images attached to the item

## Test 7: Delete Item

### Steps:
1. Delete one of the test items
2. Check console logs

### Expected Results:
- Console shows `[INVENTORY] Decision: SKIP (IronDrive file, never delete from RAID)`
- IronDrive files NOT deleted from RAID
- PC-uploaded files DO get deleted
- Item removed from database

## Database Verification Queries

After testing, run these queries to verify data integrity:

```sql
-- Check items were created correctly
SELECT
  ii.id,
  ii.inventory_number,
  ii.title,
  COUNT(af.id) as file_count
FROM inventory_items ii
LEFT JOIN auction_files af ON ii.id = af.item_id AND af.detached_at IS NULL
GROUP BY ii.id
ORDER BY ii.created_at DESC;

-- Check all files have proper variants
SELECT
  item_id,
  asset_group_id,
  array_agg(variant ORDER BY variant) as variants,
  MAX(cdn_url) as has_cdn_url
FROM auction_files
WHERE detached_at IS NULL
GROUP BY item_id, asset_group_id
HAVING array_agg(variant ORDER BY variant) != ARRAY['source']::text[];

-- Check publish jobs completed
SELECT
  status,
  COUNT(*) as count
FROM publish_jobs
GROUP BY status;
```

## Success Criteria

✅ All tests pass without errors
✅ IronDrive images appear after processing (5-15 seconds)
✅ Thumbnails show actual images (no fallbacks)
✅ Edit form loads images immediately
✅ Gallery displays all images correctly
✅ No orphaned files (all variants have item_id)
✅ Worker processes jobs successfully
✅ Console logs show expected behavior

## If Something Fails

1. Check browser console for errors
2. Check Railway worker logs
3. Check Media Jobs tab in admin panel
4. Run diagnostic queries from `DIAGNOSTIC_QUERIES.sql`
5. Verify worker is running and processing jobs
