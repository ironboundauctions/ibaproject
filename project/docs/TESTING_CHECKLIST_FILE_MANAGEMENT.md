# File Management Testing Checklist

## Test Environment Setup
- [ ] Clear browser cache and console
- [ ] Have test images (2-3 JPG/PNG files) ready on PC
- [ ] Have test video (1 MP4 file) ready on PC
- [ ] Note current RAID server file count before testing
- [ ] Open browser console to monitor logs

---

## Test 1: PC Upload - New Item Creation

### Steps:
1. [ ] Admin Panel → Inventory → Add New Item
2. [ ] Fill required fields (inventory number, title, etc.)
3. [ ] Upload 3 images from PC (drag & drop or file picker)
4. [ ] Upload 1 video from PC
5. [ ] Set main image (star icon on 2nd image)
6. [ ] Click Save

### Expected Results:
- [ ] All 4 files appear in form preview
- [ ] Files upload to RAID (check console for upload logs)
- [ ] Item saves successfully
- [ ] Form closes and returns to inventory list
- [ ] Counter updates immediately

### Verify in Database:
```sql
-- Check auction_files table
SELECT file_key, name, mime_type, source_user_id, item_id
FROM auction_files
WHERE item_id = '<new_item_id>'
ORDER BY created_at;
```
- [ ] Should have 4 records (3 images + 1 video)
- [ ] All should have `source_user_id = NULL`
- [ ] All file_keys should start with SERVICE_USER_ID

---

## Test 2: PC Upload - Edit Existing Item

### Steps:
1. [ ] Open item created in Test 1 for editing
2. [ ] Verify 3 images + 1 video load correctly
3. [ ] Add 2 more images from PC
4. [ ] Click X to remove 1 existing image
5. [ ] Click Save

### Expected Results:
- [ ] New images upload successfully
- [ ] Removed image disappears from UI
- [ ] **Files NOT deleted until Save is clicked**
- [ ] After save, removed file deleted from RAID
- [ ] Item has 4 images + 1 video total

### Verify Logs:
```
[FILES] Deleted removed file record: <file_key>
[FILES] Deleted PC upload from RAID: <file_key>
[FILES] Inserting file records for PC uploads: 5
[FILES] Saved 5 file records
```

### Verify in RAID:
- [ ] Removed file no longer exists on server
- [ ] New files exist on server

---

## Test 3: IronDrive Picker - New Item

### Steps:
1. [ ] Create new item
2. [ ] Click "Select from IronDrive" button
3. [ ] IronDrive picker window opens
4. [ ] Select 2 images and 1 video from picker
5. [ ] Files appear in form
6. [ ] Click Save

### Expected Results:
- [ ] Files from picker have different userId in file_key
- [ ] Records created immediately when picker closes
- [ ] Save completes successfully

### Verify in Database:
```sql
SELECT file_key, source_user_id
FROM auction_files
WHERE item_id = '<item_id>';
```
- [ ] All should have `source_user_id != NULL`
- [ ] file_key should NOT start with SERVICE_USER_ID

---

## Test 4: IronDrive Picker - Edit with Removal

### Steps:
1. [ ] Open item from Test 3
2. [ ] Click X on 1 picker image
3. [ ] Click X on 1 picker video
4. [ ] Click Save

### Expected Results:
- [ ] Removed files disappear from UI
- [ ] Database records deleted
- [ ] **Physical files NOT deleted from RAID** (picker owns them)

### Verify Logs:
```
[FILES] Deleted removed file record: <file_key>
(Should NOT see "Deleted PC upload from RAID" for picker files)
```

### Verify in RAID:
- [ ] Picker files still exist on server (check via IronDrive interface)

---

## Test 5: Mixed Upload - PC + Picker

### Steps:
1. [ ] Create new item
2. [ ] Upload 2 images from PC
3. [ ] Select 2 images from IronDrive picker
4. [ ] Upload 1 video from PC
5. [ ] Select 1 video from picker
6. [ ] Click Save

### Expected Results:
- [ ] 6 files total saved
- [ ] Mix of NULL and non-NULL source_user_id

### Verify in Database:
```sql
SELECT file_key, source_user_id, name
FROM auction_files
WHERE item_id = '<item_id>'
ORDER BY source_user_id NULLS FIRST;
```
- [ ] 3 records with NULL (PC uploads)
- [ ] 3 records with user ID (picker)

---

## Test 6: Delete Entire Item with PC Uploads

### Steps:
1. [ ] Create item with 3 images from PC
2. [ ] Note the file_keys from database
3. [ ] Save item
4. [ ] Delete the entire item from inventory list
5. [ ] Confirm deletion

### Expected Results:
- [ ] Item deleted from database
- [ ] All `auction_files` records deleted (CASCADE)
- [ ] Physical files deleted from RAID

### Verify in RAID:
- [ ] Files no longer exist on server
- [ ] Check RAID activity monitor for DELETE operations

### Verify Logs:
```
[INVENTORY] Checking 3 file(s) for cleanup after item deletion
[INVENTORY] Deleting orphaned file: <file_key>
```

---

## Test 7: Delete Item with Picker Files

### Steps:
1. [ ] Create item with 3 files from IronDrive picker
2. [ ] Save item
3. [ ] Delete entire item

### Expected Results:
- [ ] Database records deleted
- [ ] **Physical files NOT deleted from RAID**

### Verify Logs:
```
[INVENTORY] File <file_key> from IronDrive picker - skipping RAID deletion
```

---

## Test 8: Inventory Counter Updates

### Steps:
1. [ ] Note current inventory count
2. [ ] Create new item with images
3. [ ] Verify counter increments immediately
4. [ ] Edit item, add/remove files
5. [ ] Save
6. [ ] Verify counter updates

### Expected Results:
- [ ] Counter updates after create
- [ ] Counter updates after edit
- [ ] No page refresh needed

---

## Test 9: Video Persistence

### Steps:
1. [ ] Create item with video from PC
2. [ ] Click Save
3. [ ] Reopen item for editing
4. [ ] Verify video loads and displays

### Expected Results:
- [ ] Video appears in gallery
- [ ] Video plays when clicked
- [ ] Video saved to database

### Verify:
```sql
SELECT * FROM auction_files
WHERE item_id = '<item_id>'
AND mime_type LIKE 'video/%';
```
- [ ] Record exists with correct metadata

---

## Test 10: Cancel Edit Without Saving

### Steps:
1. [ ] Open existing item for edit
2. [ ] Add 2 new images from PC
3. [ ] Remove 1 existing image
4. [ ] Click Cancel (don't save)
5. [ ] Reopen same item

### Expected Results:
- [ ] Changes reverted
- [ ] New uploads not saved to RAID
- [ ] Removed image still exists
- [ ] No orphaned files created

---

## Test 11: Multi-Reference File Sharing

### Setup:
1. [ ] Upload image to IronDrive picker (save file_key)
2. [ ] Create Item A, add that image via picker
3. [ ] Create Item B, add same image via picker
4. [ ] Delete Item A

### Expected Results:
- [ ] Item A's record deleted
- [ ] Item B's record still exists
- [ ] Physical file NOT deleted (Item B still references it)

### Verify:
```sql
SELECT item_id, file_key FROM auction_files WHERE file_key = '<shared_file_key>';
```
- [ ] Should show only Item B now

---

## Test 12: Error Handling - RAID Unavailable

### Steps:
1. [ ] Stop RAID server (or disconnect network)
2. [ ] Try to upload files from PC
3. [ ] Verify error handling

### Expected Results:
- [ ] Clear error message shown
- [ ] Form doesn't break
- [ ] Option to retry or save without images
- [ ] No orphaned records created

---

## Logs to Monitor

### Successful PC Upload:
```
[RAID] Uploading 3 images in 3 batches for inventory <inv_number>
[RAID] Batch 1/3 succeeded
[FILES] Inserting file records for PC uploads: 3
[FILES] Saved 3 file records
```

### File Deletion on Edit:
```
[FILES] Deleted removed file record: <file_key>
[FILES] Deleted PC upload from RAID: <file_key>
```

### Item Deletion Cleanup:
```
[INVENTORY] Checking 3 file(s) for cleanup after item deletion
[INVENTORY] Deleting orphaned file: <file_key>
```

### Picker File Skipped:
```
[INVENTORY] File <file_key> from IronDrive picker - skipping RAID deletion
```

---

## Database Queries for Verification

### Check all files for an item:
```sql
SELECT
  file_key,
  name,
  mime_type,
  source_user_id,
  CASE
    WHEN source_user_id IS NULL THEN 'PC Upload'
    ELSE 'Picker File'
  END as upload_type
FROM auction_files
WHERE item_id = '<item_id>';
```

### Find orphaned records (no item):
```sql
SELECT af.*
FROM auction_files af
LEFT JOIN inventory_items ii ON af.item_id = ii.id
WHERE ii.id IS NULL;
```

### Count files by type:
```sql
SELECT
  CASE WHEN source_user_id IS NULL THEN 'PC' ELSE 'Picker' END as type,
  COUNT(*)
FROM auction_files
GROUP BY type;
```

---

## Success Criteria

✅ All tests pass without errors
✅ No orphaned files in RAID
✅ No orphaned database records
✅ Picker files never deleted from RAID
✅ PC uploads properly tracked and cleaned up
✅ Counter updates reflect reality
✅ Videos persist after save
✅ Edit operations are atomic (all or nothing)
