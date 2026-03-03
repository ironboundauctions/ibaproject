# Orphaned Records Cleanup

## Overview

The **Orphaned Records Cleanup** tool helps you maintain database integrity by identifying and removing database records that no longer have corresponding files in storage.

## When to Use This Tool

Use this tool when you notice:
- Files in the "Recently Removed Files" modal that show no preview
- Database records with `null B` file size
- Database records with no CDN URL
- Leftover test data from previous development/testing

## What Are Orphaned Records?

Orphaned records are database entries in the `auction_files` table that meet ALL of these criteria:
1. Marked as removed (`detached_at` is not null)
2. Missing file data (either `bytes` is null OR `cdn_url` is null)

These records typically occur when:
- Files failed to upload to B2 but database records were created
- Files were deleted from B2 but database cleanup didn't complete
- Testing/development created incomplete records
- Upload process was interrupted mid-flight

## How It Works

### 1. Scan for Orphaned Records

The tool queries the database for records matching the orphaned criteria:

```sql
SELECT * FROM auction_files
WHERE detached_at IS NOT NULL
  AND (bytes IS NULL OR cdn_url IS NULL)
```

### 2. Review Found Records

The tool displays a table showing:
- File name
- Variant (source, thumb, display)
- Size (shows "null B" if missing)
- CDN URL (shows "null" if missing)
- Published status
- When it was detached

### 3. Clean Up

When you click "Delete X Orphaned Records":
- Each record is permanently deleted from the database
- No files are deleted from B2 (since they don't exist or are already gone)
- Results show success/failure for each deletion
- Summary shows total deleted vs. failed

## Safety Features

- **Confirmation Dialog**: Requires explicit confirmation before deletion
- **Detailed Preview**: Shows exactly what will be deleted before you confirm
- **Individual Results**: Shows success/failure for each record
- **No File Deletion**: Only removes database records, never touches B2

## Access

The tool is located in the **Admin Panel** under the **Recently Removed** tab:

```
Admin Panel → Recently Removed → Orphaned Records Cleanup
```

## Important Notes

### What This Tool Does
- ✓ Removes orphaned database records
- ✓ Cleans up incomplete uploads
- ✓ Removes test data leftovers
- ✓ Frees up database space

### What This Tool Does NOT Do
- ✗ Delete files from B2
- ✗ Delete files from RAID/IronDrive
- ✗ Affect active (non-detached) files
- ✗ Touch files that are properly published

### When NOT to Use This Tool

Do NOT use this tool if:
- Files are still processing (check `publish_jobs` table first)
- Files are actively being uploaded
- You're unsure if the records are truly orphaned

## Typical Workflow

1. Go to Admin Panel → Recently Removed tab
2. Scroll down to "Orphaned Records Cleanup"
3. Click "Scan for Orphaned Records"
4. Review the found records in the table
5. Verify these are truly orphaned (no preview, null size/URL)
6. Click "Delete X Orphaned Records"
7. Confirm the deletion
8. Review the cleanup results
9. Optionally scan again to verify they're gone

## After Cleanup

After successful cleanup:
- Database records are permanently removed
- "Recently Removed Files" modal will no longer show these entries
- Database size is reduced
- No functional impact on the application

## Related Tools

- **Recently Removed Files**: Shows files removed in the last 30 days
- **Orphaned Files Checker**: Checks for files in B2 that have no database records
- **Publish Jobs Monitor**: Shows status of media processing jobs

## Technical Details

**Database Table**: `auction_files`

**Deletion Query**:
```sql
DELETE FROM auction_files WHERE id = '<orphaned-record-id>'
```

**Scan Criteria**:
- `detached_at IS NOT NULL` (file was removed)
- AND (`bytes IS NULL` OR `cdn_url IS NULL`) (no file data)

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify database connection
3. Check RLS policies for `auction_files` table
4. Review cleanup results for specific error messages
