# B2/CDN Only Migration

## Overview
Removed RAID URL fallback system. The webapp now exclusively uses Backblaze B2 CDN URLs for displaying media.

## Changes Made

### 1. Worker - Fixed CDN URL Generation
**File:** `worker/src/services/storage.ts:33`

**Before:**
```typescript
const url = `${config.cdn.baseUrl}/file/IBA-Lot-Media/${key}`;
```

**After:**
```typescript
const url = `${config.cdn.baseUrl}/${key}`;
```

**Reason:** The `CDN_BASE_URL` already includes `/file/IBA-Lot-Media`, so we don't need to add it again.

### 2. GlobalInventoryManagement - Removed Video Fallback
**File:** `src/components/GlobalInventoryManagement.tsx:220-231`

**Before:**
```typescript
const videoUrl = (video.cdn_url && video.publish_status === 'published')
  ? video.cdn_url
  : video.download_url;
```

**After:**
```typescript
// Only use published CDN URLs - skip videos that aren't published yet
if (video.cdn_url && video.publish_status === 'published') {
  allMedia.push({
    url: video.cdn_url,
    isVideo: true
  });
}
```

**Impact:** Videos without published CDN URLs won't be shown in the gallery. They'll appear once the worker processes them.

### 3. InventoryItemForm - Removed Video Fallback
**File:** `src/components/InventoryItemForm.tsx:85-99`

**Before:**
```typescript
const videoUrl = (video.cdn_url && video.publish_status === 'published')
  ? video.cdn_url
  : video.download_url;
```

**After:**
```typescript
// Only show videos with published CDN URLs
if (video.cdn_url && video.publish_status === 'published') {
  existingImages.push({
    id: `existing-video-${video.id || index}-${Date.now()}`,
    type: 'irondrive',
    url: video.cdn_url,
    name: video.name || `Video ${index + 1}`,
    isVideo: true
  });
}
```

**Impact:** Only published videos are shown. Processing videos are hidden until ready.

### 4. MediaImage Component - Removed RAID Fallback
**File:** `src/components/MediaImage.tsx`

**Before:**
- Component accepted `raidUrl` prop
- Fell back to RAID URL if CDN URL failed
- Used complex error handling to switch between CDN and RAID

**After:**
- Removed `raidUrl` prop entirely
- Only displays CDN URLs when `publish_status === 'published'`
- Shows placeholder with status message when not published

**Impact:** Images show "Processing...", "Processing Failed", or "Image Unavailable" until CDN URLs are available.

## How It Works Now

1. **Upload Flow:**
   - User uploads images/videos → RAID (via IronDrive)
   - Worker detects new files via `publish_jobs` table
   - Worker downloads from RAID, processes, uploads to B2
   - Worker updates `auction_files` with `thumb_url`, `display_url`, `cdn_url`
   - Worker sets `publish_status = 'published'`

2. **Display Flow:**
   - Webapp checks `publish_status === 'published'`
   - If published: shows `thumb_url` or `display_url` from B2/CDN
   - If not published: shows "Processing..." placeholder
   - No fallback to RAID URLs

## Migration Steps

1. ✅ Fixed worker CDN URL generation
2. ✅ Updated webapp to only use CDN URLs
3. ✅ Removed RAID fallback logic
4. ✅ Rebuilt worker deployment package
5. ⏳ **Next:** Redeploy worker to Railway with updated `worker-deployment.tar.gz`

## What's Still Using RAID

- **IronDrive Picker:** Still uploads to RAID (required for workflow)
- **IronDrive Service:** Still needed for file uploads
- **Worker:** Still downloads from RAID to process files
- **Database:** Still stores `download_url` (RAID URL) as source reference

## What's NOT Using RAID Anymore

- **Image Display:** Only uses `thumb_url` and `display_url` (B2/CDN)
- **Video Display:** Only uses `cdn_url` (B2/CDN)
- **Gallery Modal:** Only uses B2/CDN URLs
- **Thumbnails:** Only uses B2/CDN URLs

## Database Fields

The `auction_files` table still has these fields:
- `download_url` - Original RAID URL (kept as source reference, not for display)
- `thumb_url` - B2 CDN URL for thumbnail (used for display)
- `display_url` - B2 CDN URL for display size (used for display)
- `cdn_url` - B2 CDN URL for videos (used for display)
- `publish_status` - 'pending', 'processing', 'published', 'failed'

## Testing Checklist

After redeploying the worker:

- [ ] Upload new image - verify it shows "Processing..." then displays CDN URL
- [ ] Upload new video - verify it shows "Processing..." then displays CDN URL
- [ ] Check worker logs - verify no errors
- [ ] Check Backblaze bucket - verify files are uploading correctly
- [ ] Verify CDN URLs are correctly formatted (no duplicate paths)
- [ ] Check existing items - verify they display correctly

## Rollback Plan

If issues occur:
1. Revert `MediaImage.tsx` to accept `raidUrl` prop
2. Revert `GlobalInventoryManagement.tsx` to use `download_url` fallback
3. Revert `InventoryItemForm.tsx` to use `download_url` fallback
4. Redeploy webapp

The database and RAID storage remain unchanged, so rollback is safe.
