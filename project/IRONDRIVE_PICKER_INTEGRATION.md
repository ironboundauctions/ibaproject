# IronDrive Picker Integration — DO NOT DEVIATE

This document defines the **exact** integration rules for the IronDrive file picker. These rules must be followed precisely to maintain compatibility with the IronDrive system.

## 1. Opening the Picker

**Exact implementation required:**

```javascript
window.open(
  'https://irondrive.ibaproject.bid/picker?return_to=' + encodeURIComponent(window.location.origin),
  'irondrivePicker',
  'width=1200,height=800'
)
```

- URL must be exactly `https://irondrive.ibaproject.bid/picker`
- `return_to` parameter must be the encoded origin
- Window name can be any string (e.g., 'irondrivePicker', 'IronDrive File Picker')
- Dimensions are recommended but flexible

## 2. Message Origin Verification

**CRITICAL SECURITY CHECK:**

```javascript
if (event.origin !== 'https://irondrive.ibaproject.bid') return;
```

- Must verify origin **before** processing any message data
- Exact domain match required - no variations allowed
- This prevents malicious sites from injecting fake file selections

## 3. Expected Message Format

The picker sends messages with this exact structure:

```typescript
{
  type: 'irondrive-selection',
  files: [
    {
      userId: string,           // IronDrive user who owns the file
      filename: string,          // Original filename
      raid_url: string,         // Primary URL (RAID storage)
      bolt_url?: string,        // Optional backup URL (Bolt storage)
      size?: number,            // File size in bytes (optional)
      mime_type?: string        // MIME type (optional)
    }
  ]
}
```

**Field usage rules:**
- `type` must equal `'irondrive-selection'` exactly
- `files` is always an array (may be empty)
- `raid_url` is always present and is the **primary** source
- `bolt_url` may be null/undefined - handle gracefully
- `size` and `mime_type` are optional metadata

## 4. Primary vs Backup URL Strategy

**Display and download priority:**

```javascript
// Primary: Always use RAID URL first
<img src={raid_url} onError={(e) => {
  // Fallback: Only switch to Bolt URL on error
  if (bolt_url && e.currentTarget.src !== bolt_url) {
    e.currentTarget.src = bolt_url;
  }
}} />
```

**Rules:**
- RAID URL is the **primary** source for display and downloads
- Bolt URL is **only** used as fallback when RAID fails to load
- Never reverse this priority
- Check that `src !== bolt_url` before switching to prevent infinite loops

## 5. File Key Derivation

**Extract file_key from RAID URL:**

```javascript
function fileKeyFromRaidUrl(raidUrl: string): string {
  try {
    const u = new URL(raidUrl);
    const parts = u.pathname.split('/'); // ["", "download", "<userId>", "<storedFilename>"]
    const userId = parts[2];
    const storedFilename = decodeURIComponent(parts.slice(3).join('/'));
    return `${userId}/${storedFilename}`;
  } catch (err) {
    console.error('Error parsing RAID URL:', err);
    return '';
  }
}
```

**Rules:**
- Parse the RAID URL pathname to extract userId and filename
- Format: `<userId>/<storedFilename>`
- Handle URL encoding properly (decodeURIComponent)
- Support subfolders (use `slice(3).join('/')`)

## 6. Database Schema (auction_files table)

**Required columns and their values:**

```sql
INSERT INTO auction_files (
  storage_provider,        -- ALWAYS 'raid'
  file_key,               -- Derived from RAID URL (userId/filename)
  download_url,           -- Primary URL (RAID)
  download_url_backup,    -- Nullable backup URL (Bolt)
  item_id,                -- Foreign key to inventory_items
  name,                   -- Original filename
  mime_type,              -- File MIME type (nullable)
  size,                   -- File size in bytes (nullable)
  uploaded_by,            -- Current user's ID
  source_user_id          -- IronDrive userId (file owner)
)
```

**Field rules:**
- `storage_provider` must be `'raid'` (literal string)
- `file_key` derived from RAID URL (see section 5)
- `download_url` is the RAID URL (primary)
- `download_url_backup` is the Bolt URL (nullable)
- `source_user_id` tracks which IronDrive user owns the file
- `uploaded_by` is the current authenticated user

## 7. Frontend Restrictions

**DO NOT:**
- Add or modify CORS headers in frontend code (CORS is server-side only)
- Change RAID endpoint URLs or URL structure
- Re-upload files selected from picker (they're already in IronDrive)
- Modify the message origin check
- Change the primary/backup URL logic

**DO:**
- Keep the picker integration code as-is
- Preserve the origin verification
- Maintain the fallback logic for images
- Store both URLs in the database

## 8. Unified Image Management

**All images (PC uploads + IronDrive) use the same UI:**

```typescript
type ImageItem = {
  type: 'file' | 'irondrive',
  file?: File,              // Present if type='file'
  url?: string,            // Present if type='irondrive' (RAID URL)
  backupUrl?: string,      // Present if type='irondrive' (Bolt URL)
  name: string
}
```

**Features available for all images:**
- Drag and drop to reorder
- Click star to set as main image
- Click X to remove
- Click image to view enlarged
- IronDrive images show blue "IronDrive" badge

## 9. Quick Acceptance Checks

Before deploying changes, verify:

1. **Picker opens correctly** with proper URL and parameters
2. **Origin verification** passes for legitimate messages
3. **Thumbnails render** from RAID URLs
4. **Fallback works** - switching to Bolt URL on RAID failure
5. **Database records** have both `download_url` and `download_url_backup`
6. **File key** is correctly formatted as `userId/filename`
7. **Drag/drop/remove/star** controls work for IronDrive images
8. **No uploads** occur for picker selections (references only)

## 10. Common Mistakes to Avoid

❌ **Don't** use Bolt URL as primary
❌ **Don't** skip origin verification
❌ **Don't** try to upload files from picker selection
❌ **Don't** modify RAID or Bolt URL formats
❌ **Don't** add CORS headers in frontend
❌ **Don't** separate IronDrive images into different UI
❌ **Don't** forget to store both URLs in database

✅ **Do** use RAID URL as primary source
✅ **Do** verify message origin strictly
✅ **Do** handle optional fields gracefully
✅ **Do** preserve unified image management
✅ **Do** maintain primary/backup fallback logic
✅ **Do** store proper metadata in auction_files

## 11. Integration Points

**Files to check when making changes:**
- `src/components/InventoryItemForm.tsx` - Main form with picker integration
- `src/services/ironDriveService.ts` - Service layer (uploads only, not picker)
- `supabase/migrations/20250131_add_backup_url_to_auction_files.sql` - Database schema

**Key functions:**
- `handleIronDrivePickerClick()` - Opens the picker
- `handleMessage()` in useEffect - Processes selection messages
- `fileKeyFromRaidUrl()` - Extracts file_key from URL
- Image management handlers - drag/remove/setPrimary work identically for all sources

---

**Last Updated:** 2025-01-31
**Integration Version:** v1.0
**Status:** ✅ Active and Verified
