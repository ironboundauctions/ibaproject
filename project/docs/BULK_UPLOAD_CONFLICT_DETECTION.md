# Bulk Upload Conflict Detection

## Overview
Enhanced the bulk upload system to detect and clearly communicate when inventory items already exist, including those in the "Recently Removed" section (soft-deleted items).

## Workflow

```
1. Select Images
   ↓
2. Browser Optimization (image reduction)
   ↓
3. Analysis Worker Scans Barcodes
   ↓
4. Files Grouped by Inventory Number
   ↓
5. 🔍 CONFLICT DETECTION HAPPENS HERE 🔍
   ↓
6. Confirmation Screen Shows:
   - Groups to create
   - Any conflicts (with action buttons)
   - Disabled button if conflicts exist
   ↓
7. User Resolves Conflicts:
   - Remove conflicting groups from batch, OR
   - Go to Recently Removed to restore/delete, OR
   - Cancel and fix manually
   ↓
8. Upload to B2 (only non-conflicting files)
   ↓
9. Create Inventory Items
```

## What Changed

### 1. Post-Analysis Validation (At Confirmation Stage)
After barcode scanning and grouping is complete, but BEFORE uploading any files, the system checks if inventory numbers already exist in the database, including soft-deleted items:

```typescript
// Checks both active and soft-deleted items right after analysis
const { data: existingItems } = await supabase
  .from('inventory_items')
  .select('inventory_number, deleted_at')
  .in('inventory_number', inventoryNumbers);
```

**Timing:** This happens immediately after the analysis worker scans barcodes and groups files, at the confirmation screen where you review the detected inventory numbers.

### 2. Detailed Error Information
When conflicts are detected, users see:
- **Which inventory numbers** have conflicts
- **Why** they failed (already exists vs. in Recently Removed)
- **What action to take** (restore or permanently delete)

### 3. Visual Error Display
The error UI now shows:
- A summary message at the top
- Individual cards for each conflicting item
- For items in Recently Removed:
  - "Permanently Delete from DB" button - deletes the item from database immediately (with confirmation)
- "Remove from This Batch" button - completely removes the group and all its files from the current batch
- Clear distinction between different types of conflicts
- Disabled "Create Items" button until conflicts are resolved
- Helper text explaining resolution options

### 4. Improved Error Messages

**Before:**
```
Inventory number already exists
```

**After:**
```
Item exists in Recently Removed - restore or permanently delete it first
```

With a button to navigate to the Recently Removed section.

## User Experience

### Scenario 1: Uploading with Recently Removed Conflicts
1. User uploads images and clicks "Analyze"
2. Browser optimizes images
3. Analysis worker scans barcodes and groups files
4. User sees confirmation screen with 3 groups (T126185, T126186, T126187)
5. System immediately checks for conflicts and finds T126185 and T126186 in Recently Removed
6. Screen shows:
   - Red alert banner: "2 item(s) exist in Recently Removed section. Please restore or permanently delete them first."
   - Individual cards for T126185 and T126186 showing the conflict
   - "Go to Recently Removed" button on each conflicting card
   - "Remove from Batch" button to exclude the conflicting items
   - "Create Items" button is disabled with text "Fix Conflicts First"
7. User has 3 options:
   - **Option A:** Click "Permanently Delete from DB" → confirms deletion → conflict disappears → proceed with all items
   - **Option B:** Click "Remove from This Batch" on conflicting items → they're excluded → proceed with only T126187
   - **Option C:** Cancel and handle conflicts later

### Scenario 2: Uploading with Active Item Conflicts
1. User uploads images for T126187 which already exists as an active item
2. After analysis completes, system detects the conflict
3. System shows:
   - "1 inventory number(s) already exist."
   - Card showing T126187 with clear error message
   - "Remove from This Batch" button
   - "Create Items" button is disabled
4. User clicks "Remove from This Batch"
5. T126187 group and all its images are removed from the batch
6. If other groups exist, user can proceed with them

### Scenario 3: Mixed Conflicts
1. User uploads 5 items: T100, T200, T300, T400, T500
2. T100 is in Recently Removed, T200 is active, T300/T400/T500 are new
3. System shows all conflicts clearly
4. User clicks "Remove from Batch" on T100 and T200
5. Conflicts disappear, "Create Items" button enables
6. User proceeds to create T300, T400, and T500 successfully

## Technical Details

### Files Modified
1. `src/services/bulkUploadService.ts`
   - Added `isInRecentlyRemoved` flag to error objects
   - Enhanced duplicate detection to check `deleted_at` column

2. `src/components/BulkUploadModal.tsx`
   - Added pre-upload validation
   - Enhanced error display UI
   - Added "Go to Recently Removed" action button
   - Added `validationErrors` state to track detailed error info

### Error Object Structure
```typescript
{
  inv_number: string;
  error: string;
  isInRecentlyRemoved?: boolean;
}
```

## Benefits

1. **Perfect Timing**: Detects conflicts at the confirmation stage, after analysis but before upload
2. **No Wasted Uploads**: Prevents uploading files that can't be used
3. **Clear Communication**: Users see exactly which inventory numbers conflict and why
4. **Multiple Resolution Paths**: Users can remove conflicts, fix them, or cancel
5. **Visual Feedback**: Disabled button prevents accidental submission
6. **Flexible Workflow**: Can proceed with non-conflicting items while handling conflicts separately
7. **No Silent Failures**: Every conflict is clearly shown with actionable options

## Testing

### Test Case 1: Recently Removed Conflict - Delete from DB
1. Create an inventory item with barcode T12345
2. Soft-delete it (moves to Recently Removed)
3. Upload new images with barcode T12345
4. Click "Analyze" and wait for barcode scanning
5. At the confirmation screen, verify:
   - Red alert banner appears
   - T12345 card shows "Item exists in Recently Removed..."
   - "Permanently Delete from DB" button is present
   - "Remove from This Batch" button is present
   - "Create Items" button is disabled showing "Fix Conflicts First"
6. Click "Permanently Delete from DB"
7. Confirm the deletion
8. Verify:
   - Conflict card disappears
   - Success message appears briefly
   - "Create Items" button enables
   - Can now proceed to create the item

### Test Case 2: Recently Removed Conflict - Remove from Batch
1. Same setup as Test Case 1
2. At confirmation screen, click "Remove from This Batch"
3. Verify:
   - T12345 group completely disappears (not moved to ungrouped)
   - If other groups exist, can proceed with them
   - If it was the only group, batch is empty

### Test Case 3: Active Item Conflict
1. Create an active inventory item T98765
2. Upload images with barcode T98765
3. After analysis, verify conflict is detected
4. Verify "Remove from This Batch" button is present (no "Permanently Delete" for active items)
5. Click "Remove from This Batch"
6. Verify group is completely removed and can proceed with remaining items

### Test Case 4: Mixed Batch with Different Resolutions
1. Upload 5 items: T100 (in Recently Removed), T200 (active), T300, T400, T500 (new)
2. System shows conflicts for T100 and T200
3. Click "Permanently Delete from DB" on T100
4. Click "Remove from This Batch" on T200
5. Verify:
   - Both conflicts resolved
   - Only T300, T400, T500 remain in batch
   - "Create Items" button enables
   - Can successfully create the 3 remaining items
