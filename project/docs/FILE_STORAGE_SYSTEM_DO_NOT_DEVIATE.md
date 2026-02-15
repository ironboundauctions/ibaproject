# File Storage System - DO NOT DEVIATE

**Last Updated:** 2026-02-15 (Reviewed and corrected by Planner Team)
**Status:** ACTIVE - This is the single source of truth

---

## Critical Rules

1. **NEVER modify the database schema without updating this document first**
2. **NEVER deviate from the flows described here**
3. **ALL file operations MUST follow one of the two paths below**
4. **If something doesn't work, FIX the code to match this doc, DON'T change the doc**
5. **PUBLIC SITE MUST NEVER serve RAID files directly - always use CDN URLs**
6. **Detached files are retained for 30 days then permanently deleted**
7. **Worker processing MUST be idempotent - retries must overwrite, not duplicate**

---

## Current Database Schema

### `auction_files` Table (ACTUAL CURRENT SCHEMA)

```sql
CREATE TABLE auction_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid,                              -- FK to inventory/lot (NOT inventory_item_id, NOT lot_id separately)
  asset_group_id uuid NOT NULL,              -- Groups variants of same source file
  variant text NOT NULL,                     -- 'source', 'thumb', 'display', 'video'
  source_key text,                           -- RAID path (userId/filename) - NULL for PC uploads
  b2_key text,                               -- B2 storage path - NULL for unpublished
  cdn_url text,                              -- Full CDN URL - NULL for unpublished
  original_name text NOT NULL,               -- Original filename
  bytes bigint,                              -- File size in bytes
  mime_type text,                            -- 'image/jpeg', 'video/mp4', etc.
  width integer,                             -- Image/video width in pixels
  height integer,                            -- Image/video height in pixels
  duration_seconds numeric,                  -- Video duration (NULL for images)
  published_status text NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'published', 'failed'
  detached_at timestamptz,                   -- Soft delete timestamp
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Key Points:**
- Use `item_id` NOT `inventory_item_id` or `lot_id`
- Use `published_status` NOT `publish_status`
- Use `cdn_url` NOT `url` or `thumb_url`/`display_url`
- `asset_group_id` groups all variants of the same original file

---

## Two File Upload Paths

### Path 1: IronDrive Picker (Files Already on RAID)

**When to use:** User selecting files that already exist in IronDrive/RAID storage

**Flow:**
```
1. User clicks "Pick from IronDrive" button
   ↓
2. Opens IronDrive picker (irondrive.ibaproject.bid/picker)
   ↓
3. User selects existing files from RAID
   ↓
4. Picker returns selection via postMessage:
   {
     type: 'irondrive-selection',
     files: [{
       source_key: 'userId/filename.jpg',
       filename: 'photo.jpg',
       mime_type: 'image/jpeg',
       size: 2500000
     }]
   }
   ↓
5. Frontend creates auction_files record with source_key
   ↓
6. Database trigger creates publish_job
   ↓
7. Worker polls publish_jobs table
   ↓
8. Worker downloads from RAID using source_key
   ↓
9. Worker processes (resize, optimize, convert to WebP)
   ↓
10. Worker uploads variants to B2
   ↓
11. Worker updates auction_files with b2_key and cdn_url
   ↓
12. Frontend displays from CDN
```

**Frontend Code:**
```typescript
// When picker returns selection
const ironDriveFiles = event.data.files.map(file => ({
  type: 'irondrive',
  sourceKey: file.source_key, // "userId/filename.jpg"
  name: file.filename,
  isVideo: file.mime_type?.startsWith('video/')
}));

// On form submit, create database records
for (const file of ironDriveFiles) {
  await supabase.from('auction_files').insert({
    item_id: savedItemId,
    asset_group_id: generateUniqueId(),
    variant: 'source',
    source_key: file.sourceKey,
    original_name: file.name,
    mime_type: file.mime_type,
    published_status: 'pending'
  });
}
// Worker will poll and process automatically
```

**Critical:**
- DO set `source_key` to the RAID path
- DO set `published_status` to 'pending'
- DO NOT set `b2_key` or `cdn_url` (worker sets these)
- DO NOT upload anything (file already exists on RAID)

---

### Path 2: PC File Upload (Direct from Browser)

**When to use:** User uploading files directly from their computer

**Flow:**
```
1. User selects files via <input type="file">
   ↓
2. Frontend creates preview using URL.createObjectURL()
   ↓
3. On form submit, frontend uploads to worker
   POST http://worker-url/api/upload-and-process
   ↓
4. Worker receives file via multipart/form-data
   ↓
5. Worker processes immediately:
   - Creates thumb variant (400x400 WebP)
   - Creates display variant (1600x1600 WebP)
   ↓
6. Worker uploads both variants to B2
   ↓
7. Worker creates auction_files records (one per variant)
   ↓
8. Worker returns success with CDN URLs
   ↓
9. Frontend displays from CDN
```

**Frontend Code:**
```typescript
// Show preview immediately
const newFiles = mediaFiles.map(file => ({
  id: `temp-${Date.now()}-${Math.random()}`,
  type: 'pc',
  file: file,
  url: URL.createObjectURL(file),  // For preview
  name: file.name,
  isVideo: file.type.startsWith('video/')
}));

// On form submit, upload to worker
const results = await FileUploadService.uploadMultiplePCFilesToWorker(
  pcFiles.map(f => f.file),
  undefined,
  savedItemId
);
```

**Worker Code:**
```typescript
// Worker receives and processes
const assetGroupId = crypto.randomUUID();
const variants = await imageProcessor.processImage(fileBuffer);

for (const variant of ['thumb', 'display']) {
  const b2Key = `assets/${assetGroupId}/${variant}.webp`;
  const cdnUrl = `https://cdn.ibaproject.bid/file/IBA-Lot-Media/${b2Key}`;
  await storage.uploadFile(b2Key, variants[variant].buffer, 'image/webp');

  await database.query(`
    INSERT INTO auction_files (
      item_id, asset_group_id, variant, b2_key, cdn_url,
      original_name, bytes, mime_type, width, height, published_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    itemId, assetGroupId, variant, b2Key, cdnUrl,
    originalName, bytes, 'image/webp', width, height, 'published'
  ]);
}
```

**Critical:**
- DO NOT set `source_key` (no RAID backup for PC uploads)
- DO set `b2_key` to the B2 storage path
- DO set `cdn_url` to full CDN URL
- DO set `published_status` to 'published' (already processed)
- DO NOT create publish_job (processing happens immediately)

---

## Worker Idempotency (CRITICAL)

**Worker processing MUST be idempotent to handle retries safely.**

### The Rule

If a worker re-processes the same `asset_group_id`:
- ✅ **OVERWRITE** existing B2 files with the same key
- ✅ **UPSERT** database records (update if exists, insert if not)
- ❌ **NEVER** create duplicate database records
- ❌ **NEVER** create orphaned B2 files

### Why This Matters

Workers can be interrupted and retried:
- Network failures during upload
- Worker crashes mid-processing
- Job queue retries after timeout
- Manual re-processing requests

Without idempotency:
- Multiple database records for same asset
- Orphaned files in B2 storage
- Inconsistent state between DB and storage
- Storage cost increases from duplicates

### Implementation Pattern

```typescript
// For each variant being processed
const b2Key = `assets/${assetGroupId}/${variant}.webp`;
const cdnUrl = `https://cdn.ibaproject.bid/file/IBA-Lot-Media/${b2Key}`;

// 1. Upload to B2 (overwrites if exists)
await storage.uploadFile(b2Key, buffer, 'image/webp');

// 2. Upsert to database (not plain INSERT)
await database.query(`
  INSERT INTO auction_files (
    item_id, asset_group_id, variant, b2_key, cdn_url,
    original_name, bytes, mime_type, width, height, published_status
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT (asset_group_id, variant) DO UPDATE SET
    b2_key = EXCLUDED.b2_key,
    cdn_url = EXCLUDED.cdn_url,
    bytes = EXCLUDED.bytes,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    published_status = EXCLUDED.published_status,
    updated_at = NOW()
`, [
  itemId, assetGroupId, variant, b2Key, cdnUrl,
  originalName, bytes, 'image/webp', width, height, 'published'
]);
```

### Required Database Constraint

```sql
-- Must have unique constraint for idempotency to work
ALTER TABLE auction_files
ADD CONSTRAINT auction_files_asset_variant_unique
UNIQUE (asset_group_id, variant);
```

### Testing Idempotency

```typescript
// Test: Process same asset_group_id twice
const assetGroupId = 'test-123';

// First run
await worker.processAsset(assetGroupId, sourceFile);

// Verify: 2 records created (thumb, display)
const files1 = await db.query('SELECT * FROM auction_files WHERE asset_group_id = $1', [assetGroupId]);
expect(files1.rows.length).toBe(2);

// Second run (simulate retry)
await worker.processAsset(assetGroupId, sourceFile);

// Verify: Still 2 records (not 4)
const files2 = await db.query('SELECT * FROM auction_files WHERE asset_group_id = $1', [assetGroupId]);
expect(files2.rows.length).toBe(2);

// Verify: Records were updated, not duplicated
expect(files2.rows[0].updated_at).toBeGreaterThan(files1.rows[0].updated_at);
```

**Status:** Good practice for future implementation. Not required immediately but should be implemented before production.

---

## Variant Types

### For Images

1. **source** (IronDrive only)
   - Original file on RAID
   - Not processed yet
   - `published_status: 'pending'`
   - No B2 key or CDN URL (uses RAID `source_key`)

2. **thumb**
   - 400x400px max (maintains aspect ratio)
   - WebP format, 80% quality
   - Used for: grid views, thumbnails
   - Both PC and IronDrive uploads have this
   - B2 key: `assets/{asset_group_id}/thumb.webp`
   - CDN URL: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/thumb.webp`

3. **display**
   - 1600x1600px max (maintains aspect ratio)
   - WebP format, 80% quality
   - Used for: detail views, lightboxes, galleries
   - Both PC and IronDrive uploads have this
   - B2 key: `assets/{asset_group_id}/display.webp`
   - CDN URL: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/display.webp`

### For Videos

1. **source** (IronDrive only)
   - Original video on RAID
   - Not transcoded yet
   - No B2 key or CDN URL

2. **video**
   - Transcoded/optimized video
   - Uploaded to B2/CDN
   - B2 key: `assets/{asset_group_id}/video.mp4` (or .webm, .mov depending on format)
   - CDN URL: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/video.mp4`

### Example Asset Group

For a single uploaded image with `asset_group_id = "abc-123"`:

```
Database records:
┌─────────────────┬─────────┬──────────────────────────────┬─────────────────────────────────────────────────────┐
│ asset_group_id  │ variant │ b2_key                       │ cdn_url                                              │
├─────────────────┼─────────┼──────────────────────────────┼─────────────────────────────────────────────────────┤
│ abc-123         │ thumb   │ assets/abc-123/thumb.webp    │ https://cdn.ibaproject.bid/file/.../thumb.webp      │
│ abc-123         │ display │ assets/abc-123/display.webp  │ https://cdn.ibaproject.bid/file/.../display.webp    │
└─────────────────┴─────────┴──────────────────────────────┴─────────────────────────────────────────────────────┘

B2 storage structure:
IBA-Lot-Media/
  └── assets/
      └── abc-123/
          ├── thumb.webp    (400x400 max)
          └── display.webp  (1600x1600 max)
```

---

## Public Site vs Admin Access

### CRITICAL: Public Site Must Use CDN Only

**Public-facing pages (auction listings, galleries, item details) MUST ONLY serve files from CDN.**

❌ **NEVER on public site:**
```typescript
// DON'T: Using RAID URL on public page
<img src={`https://raid.ibaproject.bid/pub/download/${file.source_key}`} />
```

✅ **ALWAYS on public site:**
```typescript
// DO: Using CDN URL on public page
<img src={file.cdn_url} />

// If file not yet published, show placeholder
{file.published_status === 'published' ? (
  <img src={file.cdn_url} />
) : (
  <div>Processing...</div>
)}
```

### Admin Preview Exception

Admin tools MAY use RAID URLs for preview purposes only:

```typescript
// Admin panel only: can preview unpublished files
if (isAdminContext && file.source_key && !file.cdn_url) {
  const previewUrl = `https://raid.ibaproject.bid/pub/download/${file.source_key}`;
  <img src={previewUrl} />
}
```

**Why This Rule Exists:**
- CDN provides optimized, cached, fast delivery
- B2/CDN handles traffic scaling automatically
- RAID is internal infrastructure, not public-facing
- CDN URLs are permanent; RAID paths may change
- Security: RAID access requires authentication

---

## Reading Files from Database

### Get all media for an item

```typescript
const { data: files } = await supabase
  .from('auction_files')
  .select('*')
  .eq('item_id', itemId)
  .eq('variant', 'display')  // Or 'thumb' for thumbnails
  .is('detached_at', null)
  .order('created_at', { ascending: true });

// Use the files
files.forEach(file => {
  console.log(file.cdn_url);        // Full CDN URL
  console.log(file.mime_type);      // 'image/webp' or 'video/mp4'
  console.log(file.published_status); // 'published', 'pending', etc.
});
```

### Display in UI

```typescript
// Check if video or image
const isVideo = file.mime_type?.startsWith('video/');

if (file.published_status === 'published' && file.cdn_url) {
  // Show from CDN (ALWAYS use CDN on public site)
  if (isVideo) {
    <video src={file.cdn_url} />
  } else {
    <img src={file.cdn_url} />
  }
} else if (file.source_key) {
  // Admin preview only: Show from RAID /pub/download endpoint
  // NEVER use this on public-facing pages
  const raidUrl = `https://raid.ibaproject.bid/pub/download/${file.source_key}`;
  <img src={raidUrl} />
} else {
  // Still processing or failed
  <div>Processing...</div>
}
```

---

## Soft Deletion

**NEVER hard-delete files. Always use soft delete.**

```typescript
// Mark file as detached (soft delete)
await supabase
  .from('auction_files')
  .update({ detached_at: new Date().toISOString() })
  .eq('asset_group_id', assetGroupId);

// Files with detached_at should NOT appear in queries
const { data } = await supabase
  .from('auction_files')
  .select('*')
  .is('detached_at', null);  // Only get active files
```

---

## Cleanup Policy (30-Day Retention)

**Detached files are retained for 30 days before permanent deletion.**

### How It Works

1. When a file is removed from an item, `detached_at` is set to current timestamp
2. File remains in database and B2 storage for 30 days
3. After 30 days, worker cleanup job:
   - Deletes physical files from B2 storage
   - Deletes database records
4. This allows for accidental deletion recovery within the 30-day window

### Worker Cleanup Query

```typescript
// Find files ready for cleanup (detached > 30 days ago)
const { data: filesToClean } = await db.query(`
  SELECT * FROM auction_files
  WHERE detached_at IS NOT NULL
    AND detached_at < NOW() - INTERVAL '30 days'
  LIMIT 100
`);

// For each file:
// 1. Delete from B2 using b2_key
// 2. Delete database record
// 3. Log cleanup action
```

### Recovery Process (Within 30 Days)

```typescript
// Un-detach a file (restore it)
await supabase
  .from('auction_files')
  .update({ detached_at: null })
  .eq('id', fileId);
```

**Critical:**
- Cleanup runs automatically via worker
- No manual intervention needed
- Files deleted from B2 cannot be recovered
- Always verify before permanent deletion

---

## Environment Variables

### Frontend (.env)
```env
VITE_WORKER_URL=http://localhost:3000
VITE_CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media
VITE_IRONDRIVE_API=https://irondrive.ibaproject.bid/api
```

### Worker (.env)
```env
DATABASE_URL=postgresql://...
B2_KEY_ID=...
B2_APP_KEY=...
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download
RAID_PUBLISHER_SECRET=...
PORT=3000
```

---

## Common Mistakes to Avoid

❌ **Using `inventory_item_id` or `lot_id`**
✅ Use `item_id`

❌ **Using `publish_status`**
✅ Use `published_status`

❌ **Using `url` or `file_url`**
✅ Use `cdn_url`

❌ **Checking `is_video` column**
✅ Check `mime_type?.startsWith('video/')`

❌ **Uploading PC files to RAID first**
✅ Upload directly to worker HTTP endpoint

❌ **Creating publish_job for PC uploads**
✅ Worker processes immediately, no job needed

❌ **Setting source_key for PC uploads**
✅ Leave null (no RAID backup)

❌ **Hard-deleting files**
✅ Set `detached_at` timestamp

❌ **Using wrong B2 key structure like `processed/{variant}_{uuid}.webp`**
✅ Use `assets/{asset_group_id}/{variant}.webp`

❌ **Serving RAID URLs on public site**
✅ Only use `cdn_url` on public pages

❌ **Using `/download` endpoint for RAID fallback**
✅ Use `/pub/download` endpoint

❌ **Picker returning `raid_url` field**
✅ Picker returns `source_key` only

❌ **Extracting source_key from URL in frontend**
✅ Use `source_key` directly from picker

❌ **Using `cdn.irondrive.ibaproject.bid`**
✅ Use `cdn.ibaproject.bid/file/IBA-Lot-Media`

❌ **Using plain INSERT for worker uploads (creates duplicates on retry)**
✅ Use INSERT ... ON CONFLICT DO UPDATE (upsert pattern)

---

## Troubleshooting

### Issue: "Column does not exist" errors

**Cause:** Code using old column names
**Fix:** Update queries to use correct column names from schema above

### Issue: PC uploads not showing

**Cause:** Worker not creating `cdn_url`
**Fix:** Ensure worker sets `cdn_url` when creating auction_files record

### Issue: IronDrive picks not processing

**Cause:** No publish_job created or worker not running
**Fix:** Check database trigger and worker logs

### Issue: Images show as generic fallback

**Cause:** `cdn_url` is null or `published_status` is not 'published'
**Fix:** Check worker processed the file successfully

---

## Testing Checklist

### PC Upload Path
- [ ] PC upload shows preview immediately
- [ ] PC upload creates files with `published_status: 'published'`
- [ ] PC upload sets `cdn_url` to `cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{id}/{variant}.webp`
- [ ] PC upload leaves `source_key` as null
- [ ] PC upload creates both `thumb` and `display` variants
- [ ] B2 keys use format: `assets/{asset_group_id}/{variant}.webp`

### IronDrive Picker Path
- [ ] Picker returns `source_key` field (NOT `raid_url`)
- [ ] Frontend uses `source_key` directly without parsing URLs
- [ ] IronDrive pick creates files with `published_status: 'pending'`
- [ ] IronDrive pick sets `source_key` correctly
- [ ] IronDrive pick gets processed by worker within 30 seconds
- [ ] Worker creates `thumb` and `display` variants with correct B2 keys
- [ ] Worker updates `published_status` to 'published'

### Display & Queries
- [ ] Public pages NEVER show RAID URLs
- [ ] Public pages only display files with `published_status: 'published'`
- [ ] Gallery uses `display` variant (not `thumb`)
- [ ] Grid thumbnails use `thumb` variant
- [ ] All queries filter by `is('detached_at', null)`
- [ ] CDN URLs load successfully in browser

### Deletion & Cleanup
- [ ] Soft delete sets `detached_at` timestamp
- [ ] Detached files don't appear in queries
- [ ] Worker cleanup job runs for files > 30 days detached
- [ ] Cleanup deletes from both B2 and database

### RAID Fallback (Admin Only)
- [ ] Admin preview can show RAID URLs for unpublished files
- [ ] RAID URLs use `/pub/download` endpoint (NOT `/download`)
- [ ] RAID fallback NEVER appears on public pages

### Worker Idempotency (Future)
- [ ] Database has unique constraint on (asset_group_id, variant)
- [ ] Worker uses UPSERT pattern (INSERT ... ON CONFLICT DO UPDATE)
- [ ] Re-processing same asset_group_id doesn't create duplicates
- [ ] B2 files are overwritten, not duplicated on retry
- [ ] Database records are updated with new timestamps on retry

---

**REMEMBER: If something doesn't match this document, fix the code, not the document!**
