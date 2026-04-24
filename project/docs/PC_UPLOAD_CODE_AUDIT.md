# PC Upload Code Path Audit

## Current Situation
- User says: Files ARE uploading and working correctly
- User says: RAID monitor shows NO activity during PC uploads
- User says: Counter shows different counts for PC vs Picker files

## Code Path Analysis

### 1. PC Upload Trigger
**File:** `src/components/InventoryItemForm.tsx:151`
```typescript
const uploadResult = await IronDriveService.uploadInventoryImages(
  filesToUpload,
  formData.inventory_number,
  mainFileIndex,
  (progress) => { setUploadProgress(progress); }
);
```

### 2. Upload Function
**File:** `src/services/ironDriveService.ts:185-287`
```typescript
static async uploadInventoryImages(...) {
  // Uploads to: `${IRONDRIVE_API}/upload`
  // Where IRONDRIVE_API = import.meta.env.VITE_IRONDRIVE_API || ''
  // Returns: source_key format (e.g., "e9478d39.../filename.jpg")
}
```

**Environment:** `.env:5`
```
VITE_IRONDRIVE_API=https://raid.ibaproject.bid
```

### 3. What SHOULD Happen (According to Code)
1. Files POST to `https://raid.ibaproject.bid/upload`
2. RAID stores files and returns filenames
3. Function returns `source_key` values
4. Form receives `source_key` values
5. Form creates `auction_files` records with OLD schema (file_key, download_url)

### 4. Database Record Creation
**File:** `src/components/InventoryItemForm.tsx:418-438`
```typescript
filesToSave.push({
  item_id: savedItemId,
  storage_provider: 'raid',          // ← OLD schema
  file_key: fileKey,                 // ← OLD schema
  download_url: imageUrl,            // ← OLD schema
  download_url_backup: null,         // ← OLD schema
  name: fileName,
  mime_type: 'image/jpeg',
  size: 0,
  uploaded_by: currentUser?.id,
  source_user_id: null,
  asset_group_id: crypto.randomUUID()
  // ❌ NO variant field!
  // ❌ NO source_key field!
  // ❌ NO published_status field!
  // ❌ NO b2_key field!
  // ❌ NO cdn_url field!
});
```

### 5. File Counter Query
**File:** `src/components/GlobalInventoryManagement.tsx:58-64`
```typescript
const { data: sourceFiles } = await supabase
  .from('auction_files')
  .select('item_id, cdn_url, mime_type, variant')
  .in('item_id', itemIds)
  .eq('variant', 'source')              // ← Requires NEW schema
  .eq('published_status', 'published')  // ← Requires NEW schema
  .is('detached_at', null);
```

## THE PROBLEM

PC Upload records use OLD schema:
- `file_key` instead of `source_key`
- `download_url` instead of `cdn_url`
- NO `variant` field
- NO `published_status` field

Counter queries for NEW schema:
- Filters by `variant = 'source'`
- Filters by `published_status = 'published'`

**Result:** PC uploaded files are NOT counted because they don't have the required fields!

## Questions to Investigate

1. **Are PC files actually uploading to RAID?**
   - Check browser Network tab for POST to `https://raid.ibaproject.bid/upload`
   - Check RAID monitor during upload
   - If NO activity: RAID upload is failing silently

2. **If not RAID, where ARE the files going?**
   - Check if there's a proxy in production (Netlify/Vercel)
   - Check if there's a service worker caching files
   - Check browser DevTools Network tab

3. **Why does it "work" if uploads fail?**
   - Maybe user is only testing with IronDrive Picker files?
   - Maybe "working" means UI doesn't error, not that files display?

## Required Fixes

### Option A: Make PC Uploads Use Worker (RECOMMENDED)
1. Change `IronDriveService.uploadInventoryImages()` to POST to worker
2. Use worker's `/api/upload-and-process` endpoint
3. Worker directly uploads to B2 and creates proper records
4. No RAID involvement for PC uploads

### Option B: Fix PC Upload to Create Proper Records
1. Keep RAID upload as-is
2. Create records with NEW schema fields:
   - `source_key` (from upload result)
   - `variant = 'source'`
   - `published_status = 'pending'`
   - Trigger publish job creation
3. Worker picks up and publishes to B2

## Recommendation

**Use Option A** - PC uploads should go directly to worker, bypassing RAID entirely:
- Simpler architecture
- Consistent with picker flow post-publishing
- No RAID dependency
- Worker handles everything

Remove the RAID upload code for PC files and replace with direct worker upload.
