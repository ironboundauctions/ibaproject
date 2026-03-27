# Bulk Upload System - Testing Worksheet

**Test Date:** ________________
**Tester Name:** ________________
**System Version:** 1.0
**Environment:** Development

---

## Pre-Test Setup Checklist

### ✅ Services Running
- [ ] Main webapp running (Vite dev server)
- [ ] Processing Worker deployed and running on Railway
- [ ] Analysis Worker deployed and running on Railway
- [ ] All environment variables configured

### ✅ Database Ready
- [ ] Supabase database accessible
- [ ] User account created and logged in
- [ ] `batch_analysis_jobs` table exists
- [ ] `auction_files` table exists
- [ ] `inventory_items` table exists

### ✅ Test Data Preparation
Prepare 3 sets of test images:

**Set 1: Small Batch (5 images)**
- 3 images with QR codes containing inventory numbers (e.g., "INV-001", "INV-002", "INV-003")
- 2 images without QR codes

**Set 2: Medium Batch (20 images)**
- 10 images with QR codes (5 pairs - 2 images per inventory number)
- 5 images without QR codes
- 5 video files (to test skipping)

**Set 3: Edge Cases**
- 1 very large image (>10MB)
- 1 corrupt/invalid image file
- 1 image with unreadable QR code
- 1 duplicate inventory number (already exists in database)

---

## Test 1: Basic Small Batch Flow (HAPPY PATH)

**Objective:** Verify end-to-end flow with 5 images

### Steps:

**1. Open Bulk Upload Modal**
- [ ] Navigate to inventory management page
- [ ] Click "Bulk Upload" button
- [ ] Modal opens with file selection interface
- **Expected:** Clean modal with file input visible
- **Result:** PASS / FAIL
- **Notes:** _______________

**2. Select Files**
- [ ] Click file input and select 5 test images
- [ ] Files appear in selection list
- **Expected:** All 5 files listed, showing filenames
- **Record:** Total files shown: _____
- **Result:** PASS / FAIL
- **Notes:** _______________

**3. Upload & Analysis**
- [ ] Click "Upload and Analyze" button
- [ ] Progress message shows "Uploading..."
- [ ] Progress changes to "Analyzing barcodes..."
- **Expected:** Smooth transition, no errors
- **Time taken:** Upload: ___s, Analysis: ___s
- **Result:** PASS / FAIL
- **Notes:** _______________

**4. Review Analysis Results**
- [ ] Confirmation modal appears
- [ ] Check **Grouped Items** section
- [ ] Check **Ungrouped Files** section
- [ ] Verify counts match uploaded files
- **Expected:** 3 files grouped by inventory number, 2 ungrouped
- **Record:** Grouped: ___, Ungrouped: ___, Errors: ___
- **Result:** PASS / FAIL
- **Notes:** _______________

**5. Verify Grouped Items**
- [ ] Expand first grouped item card
- [ ] Inventory number displayed correctly
- [ ] File count shown
- [ ] Can see file names
- **Expected:** Clear display of inventory number and associated files
- **Record:** Inventory numbers detected: _______________
- **Result:** PASS / FAIL
- **Notes:** _______________

**6. Confirm and Create Items**
- [ ] Click "Confirm and Create Items" button
- [ ] Processing message appears
- [ ] Success message shows items created
- **Expected:** Success message with count
- **Record:** Items created: ___
- **Result:** PASS / FAIL
- **Notes:** _______________

**7. Verify in Database**
- [ ] Go to inventory list page
- [ ] Search for created inventory numbers
- [ ] Open each item detail page
- [ ] Verify images are displayed
- **Expected:** All grouped items created, images linked correctly
- **Result:** PASS / FAIL
- **Issues found:** _______________

### ✅ Test 1 Overall Result: PASS / FAIL
**Summary Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Test 2: Manual Grouping of Ungrouped Files

**Objective:** Test manually assigning inventory numbers to ungrouped files

### Steps:

**1. Upload Files Without Barcodes**
- [ ] Upload 3 images with NO QR codes
- [ ] Wait for analysis to complete
- **Expected:** All 3 files in "Ungrouped Files" section
- **Result:** PASS / FAIL
- **Notes:** _______________

**2. Select Files to Group**
- [ ] Click checkbox on first ungrouped file
- [ ] Click checkbox on second ungrouped file
- [ ] "Create Group" button appears
- **Expected:** 2 files selected, button enabled
- **Record:** Selected count shown: ___
- **Result:** PASS / FAIL
- **Notes:** _______________

**3. Create New Group**
- [ ] Click "Create Group from Selected" button
- [ ] Input dialog appears
- [ ] Enter inventory number: "MANUAL-001"
- [ ] Click confirm
- **Expected:** New group created in "Grouped Items" section
- **Result:** PASS / FAIL
- **Notes:** _______________

**4. Verify Group Created**
- [ ] Find "MANUAL-001" in grouped items
- [ ] Expand the group
- [ ] Verify 2 files are listed
- **Expected:** Group shows correct inventory number and file count
- **Record:** Group created successfully: YES / NO
- **Result:** PASS / FAIL
- **Notes:** _______________

**5. Move File Between Groups**
- [ ] Select a file from "MANUAL-001" group
- [ ] Click "Remove from Group" button
- [ ] File appears back in ungrouped section
- **Expected:** File removed from group, back in ungrouped
- **Result:** PASS / FAIL
- **Notes:** _______________

**6. Assign to Existing Group**
- [ ] Select the removed file
- [ ] Click existing group "MANUAL-001"
- [ ] Click "Add to This Group"
- **Expected:** File added back to group
- **Result:** PASS / FAIL
- **Notes:** _______________

### ✅ Test 2 Overall Result: PASS / FAIL
**Summary Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Test 3: Deletion and Cleanup

**Objective:** Test file deletion before confirmation

### Steps:

**1. Upload Mixed Files**
- [ ] Upload 10 images (5 with barcodes, 5 without)
- [ ] Wait for analysis
- **Expected:** Mixed grouped/ungrouped results
- **Result:** PASS / FAIL
- **Notes:** _______________

**2. Delete Individual File from Group**
- [ ] Expand a grouped item with multiple files
- [ ] Click delete icon on one file
- [ ] Confirmation prompt appears (if implemented)
- [ ] Confirm deletion
- **Expected:** File removed from group, count decreases
- **Result:** PASS / FAIL
- **Notes:** _______________

**3. Delete Entire Group**
- [ ] Click "Delete Group" button on a group
- [ ] Confirm deletion
- [ ] Group disappears from list
- **Expected:** All files in that group moved to ungrouped or deleted
- **Record:** Files moved to ungrouped? YES / NO
- **Result:** PASS / FAIL
- **Notes:** _______________

**4. Delete Ungrouped Files**
- [ ] Select 2 ungrouped files
- [ ] Click delete button
- [ ] Files removed from list
- **Expected:** Files removed, count updated
- **Result:** PASS / FAIL
- **Notes:** _______________

**5. Cancel Upload (Test Cleanup)**
- [ ] Upload 5 new files
- [ ] Wait for analysis
- [ ] Click "Cancel" button
- [ ] Modal closes
- **Expected:** Modal closes, no items created
- **Result:** PASS / FAIL
- **Notes:** _______________

**6. Verify Cleanup Happened**
- [ ] Wait 5 minutes (cleanup runs every 2 minutes)
- [ ] Check batch_analysis_jobs table in Supabase
- [ ] Find the cancelled batch
- **Expected:** Batch marked as 'cancelled', files will be cleaned up after expiration

**SQL Query to run in Supabase SQL Editor:**
```sql
SELECT id, status, cancelled_at, expires_at
FROM batch_analysis_jobs
ORDER BY created_at DESC
LIMIT 5;
```

- **Record result:** _______________
- **Result:** PASS / FAIL
- **Notes:** _______________

### ✅ Test 3 Overall Result: PASS / FAIL
**Summary Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Test 4: Duplicate Inventory Number Handling

**Objective:** Test system behavior with duplicate inventory numbers

### Steps:

**1. Create Existing Inventory Item**
- [ ] Go to regular inventory creation
- [ ] Create item with inventory number: "DUP-001"
- [ ] Save successfully
- **Expected:** Item created in database
- **Result:** PASS / FAIL
- **Notes:** _______________

**2. Upload Image with Same Inventory Number**
- [ ] Open bulk upload
- [ ] Upload 1 image with QR code containing "DUP-001"
- [ ] Wait for analysis
- **Expected:** File grouped under "DUP-001"
- **Result:** PASS / FAIL
- **Notes:** _______________

**3. Attempt to Create**
- [ ] Click "Confirm and Create Items"
- [ ] Wait for processing
- **Expected:** Error message about duplicate inventory number
- **Record error message:** _______________
- **Result:** PASS / FAIL
- **Notes:** _______________

**4. Verify No Duplicate Created**
- [ ] Go to inventory list
- [ ] Search for "DUP-001"
- [ ] Only 1 item should exist
- **Expected:** Original item still exists, no duplicate
- **Result:** PASS / FAIL
- **Notes:** _______________

### ✅ Test 4 Overall Result: PASS / FAIL
**Summary Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Test 5: Large Batch Performance

**Objective:** Test system with 50+ files

### Steps:

**1. Prepare Large Batch**
- [ ] Select 50-100 images
- **Note:** If you don't have this many test images, we'll adjust
- **Actual file count:** ___
- **Notes:** _______________

**2. Upload Large Batch**
- [ ] Open bulk upload modal
- [ ] Select all prepared files
- [ ] Click "Upload and Analyze"
- [ ] Monitor browser performance
- **Expected:** No browser freeze, smooth operation
- **Record:** Upload time: ___s, Analysis time: ___s
- **Browser issues:** _______________
- **Result:** PASS / FAIL

**3. Review Performance**
- [ ] Check if modal is responsive
- [ ] Try scrolling through file lists
- [ ] Try expanding/collapsing groups
- **Expected:** Smooth interaction, no lag
- **Performance issues noted:** _______________
- **Result:** PASS / FAIL

**4. Confirm Creation**
- [ ] Click confirm
- [ ] Monitor processing time
- **Expected:** All items created successfully
- **Record:** Processing time: ___s, Success count: ___
- **Result:** PASS / FAIL

### ✅ Test 5 Overall Result: PASS / FAIL
**Summary Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Test 6: Error Handling

**Objective:** Test system resilience to errors

### Steps:

**1. Upload Invalid File**
- [ ] Try to upload a .txt file or .pdf
- **Expected:** File rejected with error message
- **Result:** PASS / FAIL
- **Notes:** _______________

**2. Upload Corrupt Image**
- [ ] Upload a renamed .txt file as .jpg
- [ ] Click upload
- **Expected:** Error during processing, clear error message
- **Error shown:** _______________
- **Result:** PASS / FAIL

**3. Network Interruption Simulation**
- [ ] Open browser DevTools → Network tab
- [ ] Start upload
- [ ] Throttle to "Offline" mid-upload
- **Expected:** Error message about network failure
- **Actual behavior:** _______________
- **Result:** PASS / FAIL

**4. Verify Partial Upload Handling**
- [ ] Check if any files were partially uploaded
- [ ] Check batch_analysis_jobs table
- **Expected:** Batch in error state or cancelled
- **Result:** _______________

### ✅ Test 6 Overall Result: PASS / FAIL
**Summary Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Test 7: Video File Handling

**Objective:** Verify video files are skipped during barcode analysis

### Steps:

**1. Upload Mixed Media**
- [ ] Upload 3 images (with barcodes)
- [ ] Upload 2 video files (.mp4, .mov)
- **Expected:** All files accepted
- **Result:** PASS / FAIL
- **Notes:** _______________

**2. Check Analysis Results**
- [ ] Review confirmation modal
- [ ] Videos should be in "Ungrouped" section
- [ ] Videos should NOT show barcode detection errors
- **Expected:** Videos handled gracefully, not scanned for barcodes
- **Result:** PASS / FAIL
- **Notes:** _______________

**3. Create Items with Videos**
- [ ] Manually group a video with an image
- [ ] Confirm creation
- **Expected:** Inventory item created with both image and video
- **Result:** PASS / FAIL
- **Notes:** _______________

### ✅ Test 7 Overall Result: PASS / FAIL
**Summary Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Post-Test Verification

### Database Integrity Check

Run these SQL queries in Supabase SQL Editor and record results:

**Query 1: Check batch jobs created**
```sql
SELECT
  id,
  user_id,
  status,
  total_files,
  created_at,
  confirmed_at,
  cancelled_at,
  expires_at
FROM batch_analysis_jobs
ORDER BY created_at DESC
LIMIT 10;
```
**Record count:** ___
**Notes:** _______________

---

**Query 2: Check auction_files without item_id**
```sql
SELECT COUNT(*)
FROM auction_files
WHERE item_id IS NULL
AND created_at > NOW() - INTERVAL '1 hour';
```
**Count (should be 0 or very low):** ___
**Notes:** _______________

---

**Query 3: Check inventory items created**
```sql
SELECT
  inventory_number,
  title,
  category,
  status,
  (SELECT COUNT(*) FROM auction_files WHERE item_id = inventory_items.id) as file_count
FROM inventory_items
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```
**Record items created:** ___
**Notes:** _______________

---

**Query 4: Check for orphaned files**
```sql
SELECT COUNT(*)
FROM auction_files af
LEFT JOIN batch_analysis_jobs baj ON af.asset_group_id::text = ANY(
  SELECT jsonb_array_elements_text(baj.uploaded_files)
)
WHERE af.item_id IS NULL
AND baj.status IN ('cancelled', 'expired');
```
**Orphaned count:** ___
**Notes:** _______________

---

## Final Summary

### Overall Test Results

| Test | Result | Critical Issues |
|------|--------|----------------|
| Test 1: Basic Flow | PASS / FAIL | |
| Test 2: Manual Grouping | PASS / FAIL | |
| Test 3: Deletion & Cleanup | PASS / FAIL | |
| Test 4: Duplicate Handling | PASS / FAIL | |
| Test 5: Large Batch | PASS / FAIL | |
| Test 6: Error Handling | PASS / FAIL | |
| Test 7: Video Files | PASS / FAIL | |

**Tests Passed:** ___ / 7

---

### Critical Issues Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
4. _______________________________________________

---

### Minor Issues Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
4. _______________________________________________

---

### Features Working Well
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
4. _______________________________________________

---

### Priority Fixes Needed
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
4. _______________________________________________

---

### Performance Observations
**Upload Speed:** _______________
**Analysis Speed:** _______________
**Processing Speed:** _______________
**Browser Performance:** _______________

---

### User Experience Notes
**Ease of Use (1-10):** ___
**Clarity of Instructions:** _______________
**Error Messages Quality:** _______________
**Overall Satisfaction:** _______________

---

## Recommendations

### Must-Have Improvements
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Nice-to-Have Enhancements
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Next Steps

- [ ] Review test results with development team
- [ ] Prioritize bug fixes
- [ ] Schedule fixes implementation
- [ ] Plan retest after fixes
- [ ] Document known limitations
- [ ] Update user documentation

---

**Test Completion Date:** ________________
**Sign-off:** ________________

---

**END OF TEST WORKSHEET**
