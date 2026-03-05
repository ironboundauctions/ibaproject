# File Handling - PC vs IronDrive Analysis

## Current Issue

The webapp treats PC-uploaded and IronDrive-picker files differently **even after they're published**, which is wrong.

## The Truth

### Before Publishing
Files have different paths:

**PC Upload:**
```
User picks file → FileUploadService → Worker → B2
Creates auction_files with: b2_key, cdn_url (NO source_key)
```

**Picker Upload:**
```
User picks from picker → Creates auction_files with source_key
Trigger creates publish_job → Worker downloads from RAID → B2
Updates auction_files with: source_key, b2_key, cdn_url
```

### After Publishing
**Both types have:**
- `cdn_url` (Cloudflare CDN URL)
- `b2_key` (B2 object path)
- `published_status: 'published'`
- Variants: `display`, `thumb`, `video` (if applicable)

**They are IDENTICAL for display purposes.**

## Current Code Problems

### 1. Unnecessary Type Tracking (InventoryItemFormNew.tsx:318)
```typescript
type: (sourceFile?.source_key ? 'irondrive' : 'pc') as 'pc' | 'irondrive',
```

This sets a `type` field when loading existing files, but:
- ✅ Type is useful during initial upload (to route to correct upload handler)
- ❌ Type is meaningless for published files (they all have cdn_url)
- ❌ Creates false distinction between identical published files

### 2. Type is Only Used During Upload (lines 579-615)
```typescript
const pendingIronDriveFiles = selectedFiles.filter(f => f.type === 'irondrive' && f.uploadStatus === 'pending');
const pendingPCFiles = selectedFiles.filter(f => f.type === 'pc' && f.uploadStatus === 'pending');
```

This is the ONLY place where `type` matters - to determine which upload function to call for **pending** files.

For **published** files (uploadStatus === 'published'), the type is irrelevant.

## The Fix

### Option 1: Remove Type from Published Files
When loading existing files, don't set `type` at all for published files:

```typescript
return {
  id: primaryFile.asset_group_id,
  // Only set type for pending files (shouldn't happen when loading, but defensive)
  type: (primaryFile.published_status === 'pending' && sourceFile?.source_key) ? 'irondrive' : 'pc',
  url: previewUrl,
  // ...
};
```

### Option 2: Make Type Optional
Change the TypeScript interface:

```typescript
interface SelectedFile {
  id: string;
  file?: File;
  url: string;
  name: string;
  isVideo: boolean;
  type?: 'pc' | 'irondrive';  // Only needed for unpublished files
  // ...
}
```

And update the upload filter to be defensive:

```typescript
const pendingIronDriveFiles = selectedFiles.filter(f =>
  f.uploadStatus === 'pending' && f.type === 'irondrive'
);
const pendingPCFiles = selectedFiles.filter(f =>
  f.uploadStatus === 'pending' && (!f.type || f.type === 'pc')
);
```

### Option 3: Use uploadStatus Instead
Since we already track `uploadStatus` ('pending' | 'processing' | 'published'), we could infer:

```typescript
// For pending files, check if they have sourceKey or file
const pendingIronDriveFiles = selectedFiles.filter(f =>
  f.uploadStatus === 'pending' && f.sourceKey
);
const pendingPCFiles = selectedFiles.filter(f =>
  f.uploadStatus === 'pending' && f.file
);
```

This is cleaner because:
- IronDrive files always have `sourceKey` set
- PC files always have `file` object set (until uploaded)
- No need for manual `type` tracking

## Recommendation

**Use Option 3** - it's the cleanest because:
1. No redundant `type` field
2. Self-documenting code (if it has `sourceKey`, it's from picker; if it has `file`, it's from PC)
3. Published files are naturally treated identically (they have neither `sourceKey` nor `file`)
4. Less state to manage

## Display Logic Should Be Identical

After publishing, ALL files should be displayed using:

```typescript
// Get the appropriate variant URL
const previewUrl = isVideo
  ? (videoFile?.cdn_url || thumbFile?.cdn_url)
  : (displayFile?.cdn_url || thumbFile?.cdn_url);

// Display in <img> or <video> tag
<MediaImage src={previewUrl} alt={file.name} />
```

The source (PC vs picker) is irrelevant. Only the variant (display/thumb/video) matters.

## Summary

You're 100% correct - after files get CDN URLs, they should be handled identically. The current `type` tracking is:
- ✅ Useful during upload (to route to correct handler)
- ❌ Useless after publishing
- ❌ Creates false distinction in the code

The fix is to either make `type` optional or infer it from the presence of `sourceKey` vs `file` instead of tracking it explicitly.
