# File Deletion System - Test Plan

This document outlines comprehensive tests to verify the smart file deletion system with ownership checking and reference counting.

## Pre-Test Setup

### 1. Apply Database Migration
Before testing, apply the migration to remove the UNIQUE constraint:

1. Go to your Supabase SQL Editor
2. Copy the contents of `supabase/migrations/20250201_remove_unique_constraint_file_key.sql`
3. Run the migration
4. Verify the index is now non-unique:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'auction_files' AND indexname = 'idx_auction_files_file_key';
   ```

### 2. Prepare Test Environment
- Ensure RAID is online and accessible
- Have some test images ready on your PC
- Have the IronDrive picker accessible with files available

---

## Test Suite 1: IronDrive Picker Files (Should NEVER Delete from RAID)

### Test 1.1: Single Item with Picker File
**Purpose:** Verify picker files are not deleted when the only reference is removed

**Steps:**
1. Create a new inventory item
2. Open IronDrive picker and select ONE file
3. Save the item
4. **Verify in browser console:** File record created with `source_user_id` set
5. Note the `file_key` from console logs
6. Delete the inventory item
7. **Check console logs:** Should say "File from IronDrive picker - deleting database record only"
8. **Verify:** File still accessible at its RAID URL
9. **Verify in database:** No records in `auction_files` for that `file_key`

**Expected Result:** ✅ File physically remains on RAID, only database reference deleted

---

### Test 1.2: Multiple Items Share Same Picker File (THE BIG FIX)
**Purpose:** Verify multiple items can share the same picker file

**Steps:**
1. Create Item A
2. Open IronDrive picker and select a specific file (remember which one!)
3. Save Item A
4. Note the `file_key` from console logs
5. Create Item B
6. Open IronDrive picker and select THE SAME file
7. Save Item B
8. **Verify:** No errors! (Previously would fail with UNIQUE constraint error)
9. **Check database:**
   ```sql
   SELECT item_id, file_key, source_user_id
   FROM auction_files
   WHERE file_key = '<your_file_key>';
   ```
   Should show 2 records with same `file_key` but different `item_id`

10. Delete Item A
11. **Check console:** Should say "Multiple references exist. Deleting only item [A's ID]'s record"
12. **Verify in database:** 1 record remains (Item B's reference)
13. **Verify:** File still accessible via RAID URL

14. Delete Item B
15. **Check console:** Should say "File from IronDrive picker - deleting database record only"
16. **Verify:** File still accessible at RAID URL
17. **Verify in database:** 0 records remain

**Expected Result:** ✅ Both items can share file, file never deleted from RAID

---

### Test 1.3: Remove Picker File from Gallery Before Save
**Purpose:** Verify removing picker file from gallery before saving

**Steps:**
1. Create a new inventory item
2. Open IronDrive picker and select a file
3. Before saving, click the X to remove the file from gallery
4. **Check console:** Should show deletion attempt with item_id
5. Add another file (PC upload or picker)
6. Save the item
7. **Verify:** Only the final file is saved to database

**Expected Result:** ✅ No errors, removed file not saved

---

### Test 1.4: Edit Item - Remove Picker File from Gallery
**Purpose:** Verify removing picker file from existing item

**Steps:**
1. Create an item with ONE picker file
2. Save it
3. Edit the item
4. Click X to remove the picker file from gallery
5. **Check console:** Should call `deleteFile()` with item_id
6. Save the item
7. **Verify in database:** No file records for this item
8. **Verify:** Original file still accessible at RAID URL (not deleted)

**Expected Result:** ✅ Database reference deleted, physical file remains on RAID

---

## Test Suite 2: PC Uploaded Files (Auction FE Owns, Should Delete from RAID)

### Test 2.1: Single Item with PC Upload
**Purpose:** Verify PC uploads are deleted from RAID when item deleted

**Steps:**
1. Create a new inventory item
2. Upload a file from your PC
3. Save the item
4. **Verify in console:** File uploaded to RAID, `source_user_id` should be NULL
5. **Verify in database:**
   ```sql
   SELECT file_key, source_user_id
   FROM auction_files
   WHERE item_id = '<item_id>';
   ```
   Should show `source_user_id` is NULL

6. Note the `file_key` and download URL
7. **Verify:** File accessible at download URL
8. Delete the inventory item
9. **Check console:** Should say "File uploaded by auction FE - deleting from RAID"
10. **Verify:** File NO LONGER accessible at download URL (404 or error)
11. **Verify in database:** No records remain

**Expected Result:** ✅ Physical file deleted from RAID, database reference deleted

---

### Test 2.2: Item with Multiple PC Uploads
**Purpose:** Verify all PC uploads are deleted when item deleted

**Steps:**
1. Create a new inventory item
2. Upload 3 files from your PC
3. Save the item
4. **Verify in database:** 3 records with `source_user_id` = NULL
5. Note all `file_key` values and URLs
6. **Verify:** All 3 files accessible
7. Delete the inventory item
8. **Check console:** Should show cleanup for all 3 files
9. **Verify:** All 3 files NO LONGER accessible (404)
10. **Verify in database:** 0 records remain

**Expected Result:** ✅ All physical files deleted from RAID

---

### Test 2.3: Remove PC Upload from Gallery Before Save
**Purpose:** Verify removing PC upload before save doesn't upload it

**Steps:**
1. Create a new inventory item
2. Upload a file from PC
3. Before saving, click X to remove it
4. **Check console:** No RAID deletion (file only in memory)
5. Upload a different file
6. Save the item
7. **Verify:** Only the second file saved to database

**Expected Result:** ✅ First file never uploaded to RAID

---

### Test 2.4: Edit Item - Remove PC Upload from Gallery
**Purpose:** Verify removing PC upload from existing item deletes from RAID

**Steps:**
1. Create an item with ONE PC uploaded file
2. Save it
3. Note the file URL
4. Edit the item
5. Click X to remove the file
6. **Check console:** Should attempt deletion from RAID
7. Save the item
8. **Verify:** File no longer accessible at URL
9. **Verify in database:** No file records for this item

**Expected Result:** ✅ Physical file deleted from RAID

---

## Test Suite 3: Mixed Files (PC Uploads + Picker Files)

### Test 3.1: Item with Both PC and Picker Files
**Purpose:** Verify mixed file types handled correctly

**Steps:**
1. Create a new inventory item
2. Upload 2 files from PC
3. Open picker and select 2 files
4. Save the item (should have 4 files total)
5. **Verify in database:**
   ```sql
   SELECT file_key, source_user_id
   FROM auction_files
   WHERE item_id = '<item_id>';
   ```
   Should show 2 with NULL (PC) and 2 with user ID (picker)

6. Delete the inventory item
7. **Check console:** Should show:
   - 2 files "from IronDrive picker - skipping RAID deletion"
   - 2 files "Deleting orphaned file" (PC uploads)

8. **Verify:** Picker files still accessible
9. **Verify:** PC upload files NOT accessible
10. **Verify in database:** 0 records remain

**Expected Result:** ✅ Only PC uploads deleted from RAID, picker files remain

---

### Test 3.2: Two Items Share Picker File, Each Has Own PC Upload
**Purpose:** Complex scenario with shared and unique files

**Steps:**
1. Create Item A
   - Upload 1 file from PC
   - Select 1 file from picker
   - Save (2 files total)

2. Create Item B
   - Upload 1 DIFFERENT file from PC
   - Select THE SAME picker file as Item A
   - Save (2 files total)

3. **Verify in database:**
   - Item A: 2 files (1 NULL source, 1 with source_user_id)
   - Item B: 2 files (1 NULL source, 1 with source_user_id)
   - Shared picker file should have 2 references

4. Delete Item A
5. **Check console:**
   - PC upload: "Deleting orphaned file"
   - Picker file: "Multiple references exist"

6. **Verify:**
   - Item A's PC upload NOT accessible
   - Picker file STILL accessible

7. Delete Item B
8. **Check console:**
   - PC upload: "Deleting orphaned file"
   - Picker file: "from IronDrive picker - deleting database record only"

9. **Verify:**
   - Item B's PC upload NOT accessible
   - Picker file STILL accessible

**Expected Result:** ✅ Each PC upload deleted with its item, shared picker file never deleted

---

## Test Suite 4: Edge Cases

### Test 4.1: Delete Item with No Files
**Purpose:** Verify no errors when deleting item with no files

**Steps:**
1. Create an item with only text fields (no images)
2. Save it
3. Delete it
4. **Check console:** Should show "Checking 0 file(s) for cleanup"

**Expected Result:** ✅ No errors

---

### Test 4.2: RAID Offline - Delete Item with PC Uploads
**Purpose:** Verify graceful handling when RAID unavailable

**Steps:**
1. Create an item with PC uploaded files
2. Save it
3. Simulate RAID offline (you may need to disconnect network or wait for timeout)
4. Delete the item
5. **Check console:** Should show RAID errors but continue
6. **Verify:** Item deleted from database despite RAID errors

**Expected Result:** ✅ Item deleted, errors logged but not thrown

---

### Test 4.3: Multiple Browser Tabs - Concurrent Deletion
**Purpose:** Verify reference counting works across concurrent operations

**Steps:**
1. Create 3 items all sharing the same picker file
2. Open 3 browser tabs
3. Load each item in a different tab
4. Simultaneously delete all 3 items (as fast as possible)
5. **Check console in all tabs**
6. **Verify:** Picker file still accessible
7. **Verify in database:** 0 references remain

**Expected Result:** ✅ No race conditions, file never deleted from RAID

---

## Test Suite 5: Database Verification

### Test 5.1: Verify No Orphaned Records
**Purpose:** Check database integrity after all tests

**Steps:**
1. After completing all tests, run:
   ```sql
   SELECT af.id, af.file_key, af.item_id, af.source_user_id
   FROM auction_files af
   LEFT JOIN inventory_items ii ON af.item_id = ii.id
   WHERE ii.id IS NULL;
   ```

**Expected Result:** ✅ Should return 0 rows (no orphaned file records)

---

### Test 5.2: Verify File Key Format
**Purpose:** Ensure all file_key values have correct format

**Steps:**
1. Run:
   ```sql
   SELECT file_key
   FROM auction_files
   WHERE file_key NOT LIKE '%/%';
   ```

**Expected Result:** ✅ Should return 0 rows (all have userId/filename format)

---

### Test 5.3: Check Reference Counting Accuracy
**Purpose:** Manual verification of reference count logic

**Steps:**
1. Create 2 items sharing a picker file
2. Run:
   ```sql
   SELECT file_key, COUNT(*) as ref_count
   FROM auction_files
   GROUP BY file_key
   HAVING COUNT(*) > 1;
   ```
   Should show your shared file with count = 2

3. Delete one item
4. Run query again - should show count = 1
5. Delete second item
6. Run query again - should return 0 rows

**Expected Result:** ✅ Counts match expected values at each step

---

## Success Criteria

All tests should pass with these results:

- ✅ **IronDrive picker files:** NEVER deleted from RAID, only database references removed
- ✅ **PC uploaded files:** Deleted from RAID when last reference removed
- ✅ **Multiple items:** Can share picker files without errors
- ✅ **Reference counting:** Accurate at all times
- ✅ **Database integrity:** No orphaned records
- ✅ **Error handling:** Graceful failures, no crashes
- ✅ **Console logs:** Clear indication of what's happening

---

## Rollback Plan

If tests fail and you need to rollback:

1. **Restore UNIQUE constraint:**
   ```sql
   DROP INDEX IF EXISTS idx_auction_files_file_key;
   CREATE UNIQUE INDEX idx_auction_files_file_key ON auction_files(file_key);
   ```

2. **Revert code changes:**
   - Restore previous version of `ironDriveService.ts`
   - Restore previous version of `inventoryService.ts`
   - Restore previous version of `InventoryItemForm.tsx`

3. **Clear test data:**
   ```sql
   DELETE FROM auction_files WHERE item_id IN (
     SELECT id FROM inventory_items WHERE title LIKE '%TEST%'
   );
   DELETE FROM inventory_items WHERE title LIKE '%TEST%';
   ```

---

## Reporting Issues

If any test fails, report:
1. Test number and name
2. Exact steps taken
3. Expected vs actual result
4. Console logs (RAID messages)
5. Database state (relevant SQL query results)
6. Screenshots if applicable
