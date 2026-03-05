# Complete Deletion System Flow

## Overview
The system has two separate "Recently Removed" lists with **manual deletion only**. Items and files stay in these lists until you explicitly delete them.

---

## Path 1: Removing Individual Files from an Item

### User Action
User clicks "X" on a file thumbnail within an inventory item.

### What Happens Immediately
1. **Database**: `detached_at` timestamp is set on ALL variants (source, thumb, display, video) of that asset group
2. **UI**: File disappears from the item's file list
3. **Item**: Remains active and unchanged
4. **Recently Removed Files Panel**: File appears in the "Recently Removed Files" list

### Database State
```sql
-- auction_files record
item_id: "abc-123"              -- Still linked to original item
detached_at: "2026-03-05..."    -- Marked as detached
cdn_url: "https://..."          -- Still accessible in B2
```

### User Options
- **Restore**: Re-attaches the file to its original item
  - Sets `detached_at` back to `null`
  - File reappears in item's file list
  - **NOTE**: Only works if the original item hasn't been removed

- **Delete Now**: Permanently deletes the file
  - Calls worker API to delete from B2 (all variants)
  - Deletes all database records for that asset group
  - **This is the ONLY way to permanently delete files**

---

## Path 2: Removing Entire Items from Global Inventory

### User Action
User clicks delete button on an item in Global Inventory Management.

### What Happens Immediately
1. **All files detached**: `detached_at` timestamp set on ALL files attached to the item
2. **Item soft-deleted**: `deleted_at` timestamp set on the inventory_items record
3. **UI**:
   - Item disappears from Global Inventory list
   - Item appears in "Recently Removed Items" list
   - All its files appear in "Recently Removed Files" list
4. **Database**: Item and files remain in database with timestamps set

### Database State
```sql
-- inventory_items record
id: "abc-123"
deleted_at: "2026-03-05..."     -- Soft deleted
status: "draft"                 -- Original data intact

-- auction_files records (all variants)
item_id: "abc-123"              -- Still linked
detached_at: "2026-03-05..."    -- Marked as detached
cdn_url: "https://..."          -- Still accessible in B2
```

### User Options
- **Restore Item**: Restores the item to Global Inventory
  - Sets `deleted_at` to `null` on inventory_items
  - Item reappears in Global Inventory
  - **NOTE**: Files that were detached remain detached (they stay in Recently Removed Files)
  - You must restore files separately if needed

- **Delete Now**: Permanently deletes the item and all its files
  - Gets all asset groups from the item
  - Calls worker API to delete each asset group from B2
  - Deletes all `auction_files` records
  - Deletes the `inventory_items` record
  - **This is the ONLY way to permanently delete items**

---

## Key Differences from Auto-Cleanup Systems

### What This System Does NOT Do
- **NO automatic deletion** after X days/minutes
- **NO countdown timers**
- **NO worker cleanup jobs** running in background
- Items and files stay in "Recently Removed" lists **indefinitely**

### What This System DOES
- Provides a safe holding area for removed items/files
- Allows manual restoration at any time
- Requires explicit "Delete Now" action for permanent deletion
- Gives full control over when B2 storage is freed

---

## Understanding the Two Lists

### Recently Removed Items
- Shows **whole inventory items** that were removed from Global Inventory
- Each item shows how many files it still has attached
- Displays thumbnail from first available file
- Restore button brings item back to Global Inventory
- Delete Now button permanently deletes item + all its files from B2

### Recently Removed Files
- Shows **individual files** that were detached from items
- Includes files from removed items (they appear in BOTH lists)
- Shows which item the file came from
- Restore button re-attaches file to original item (if item exists)
- Delete Now button permanently deletes file from B2

---

## Common Scenarios

### Scenario 1: Remove a file, then restore it
1. User removes file from item → File goes to "Recently Removed Files"
2. User realizes mistake
3. User clicks "Restore" → File comes back to the item
4. **Result**: No B2 deletion occurred, file never left B2

### Scenario 2: Remove an item, then restore it
1. User removes item from inventory → Item goes to "Recently Removed Items", all files go to "Recently Removed Files"
2. User clicks "Restore" on the item → Item comes back to Global Inventory
3. Files stay in "Recently Removed Files" (must be restored separately)
4. User restores each file individually
5. **Result**: No B2 deletion occurred

### Scenario 3: Remove an item, delete specific files, restore item
1. User removes item → Item and files go to respective lists
2. User clicks "Delete Now" on 2 files → Those 2 files deleted from B2
3. User clicks "Restore" on item → Item comes back
4. Item now has 2 fewer files (the ones that were permanently deleted)
5. **Result**: Partial B2 deletion

### Scenario 4: Remove a file, remove the item, try to restore file
1. User removes file from item → File goes to "Recently Removed Files"
2. User removes entire item → Item goes to "Recently Removed Items"
3. User tries to restore the file → **ERROR**: Cannot restore because item is removed
4. User must restore the item first, then restore the file
5. **Result**: Proper parent-child relationship maintained

---

## Database Schema Summary

```sql
-- inventory_items
id: uuid
deleted_at: timestamp          -- NULL = active, SET = soft deleted (in Recently Removed Items)

-- auction_files
id: uuid
item_id: uuid                  -- FK with ON DELETE SET NULL
asset_group_id: uuid           -- Groups all variants together
detached_at: timestamp         -- NULL = attached, SET = detached (in Recently Removed Files)
variant: text                  -- 'source', 'thumb', 'display', 'video'

-- Foreign Key
CONSTRAINT auction_files_item_id_fkey
  FOREIGN KEY (item_id)
  REFERENCES inventory_items(id)
  ON DELETE SET NULL
```

---

## B2 Deletion Logic

B2 deletion ONLY happens when:
1. User clicks "Delete Now" on a file in Recently Removed Files
2. User clicks "Delete Now" on an item in Recently Removed Items (deletes item + all its files)

The worker API endpoint `/api/delete-asset-group`:
- Receives `assetGroupId`
- Deletes all variants from B2 (source, thumb, display, video)
- Returns success/error status
- Frontend then deletes database records

---

## Edge Cases Handled

1. **File removed, item removed, file deleted, item restored**:
   - File is gone forever from B2
   - Item comes back with fewer files
   - System handles gracefully

2. **Item removed, try to restore file**:
   - Restore button disabled with message "Cannot restore - item was removed"
   - User must restore item first

3. **Worker URL not configured**:
   - "Delete Now" shows error: "Worker URL not configured"
   - User cannot permanently delete until worker is set up

4. **B2 deletion fails**:
   - Error shown to user
   - Database records NOT deleted (maintains consistency)
   - User can retry "Delete Now"

5. **Restored file count mismatch**:
   - System counts unique asset groups (not individual variant files)
   - Shows accurate count of photos/videos
