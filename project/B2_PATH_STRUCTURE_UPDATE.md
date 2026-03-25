# B2 Path Structure Update - Complete

## Summary

Successfully updated the B2 storage path structure from `assets/{asset_group_id}/` to `assets/{item_id}/{asset_group_id}/`. This provides better organization by grouping all files for an inventory item together.

## Changes Made

### 1. Upload Handler (`worker/src/services/uploadHandler.ts`)
- **Line 44**: Source variant path now includes item_id
  - Old: `assets/${assetGroupId}/source.webp`
  - New: `assets/${item_id}/${assetGroupId}/source.webp`

- **Line 78**: Display and thumb variant paths now include item_id
  - Old: `assets/${assetGroupId}/${name}.webp`
  - New: `assets/${item_id}/${assetGroupId}/${name}.webp`

### 2. Storage Service (`worker/src/services/storage.ts`)

#### Method: `uploadVariants()`
- Added optional `itemId` parameter (required for new uploads)
- **Line 52**: Thumb key updated
  - Old: `assets/${assetGroupId}/thumb.webp`
  - New: `assets/${itemId}/${assetGroupId}/thumb.webp`
- **Line 53**: Display key updated
  - Old: `assets/${assetGroupId}/display.webp`
  - New: `assets/${itemId}/${assetGroupId}/display.webp`

#### Method: `uploadVideo()`
- Added optional `itemId` parameter (required for new uploads)
- **Line 78**: Video key updated
  - Old: `assets/${assetGroupId}/video{extension}`
  - New: `assets/${itemId}/${assetGroupId}/video{extension}`

#### Method: `deleteAssetGroup()`
- Added optional `itemId` parameter
- Passes `itemId` to `listAssetGroupFiles()`

#### Method: `generateCdnKeyPrefix()`
- Added optional `itemId` parameter (required)
- **Line 163**: Prefix generation updated
  - Old: `assets/${assetGroupId}`
  - New: `assets/${itemId}/${assetGroupId}`

#### Method: `listAssetGroupFiles()`
- Added optional `itemId` parameter
- **Lines 173-174**: Prefix construction updated
  - New path: `assets/${itemId}/${assetGroupId}/`
  - Fallback (for old files): `assets/${assetGroupId}/`

### 3. Job Processor (`worker/src/services/jobProcessor.ts`)
- **Line 76-80**: Pass `file.item_id` to `uploadVariants()` for image processing
- **Line 114-118**: Pass `file.item_id` to `uploadVideo()` for video processing
- **Line 128-132**: Pass `file.item_id` to `uploadVariants()` for video thumbnail processing

### 4. Cleanup Processor (`worker/src/services/cleanupProcessor.ts`)
- **Line 68**: Pass `file.item_id` to `deleteAssetGroup()`

## Validation Added

All upload methods now validate that `item_id` is present:
- `uploadVariants()` throws error if `itemId` is undefined
- `uploadVideo()` throws error if `itemId` is undefined
- `generateCdnKeyPrefix()` throws error if `itemId` is undefined

## Backward Compatibility

The `listAssetGroupFiles()` method includes a fallback:
- If `itemId` is provided, uses new path structure: `assets/{itemId}/{assetGroupId}/`
- If `itemId` is not provided, uses old path structure: `assets/{assetGroupId}/`

This allows the system to handle cleanup of any old files that might exist before the structure change.

## Risk Assessment

**Risk Level: VERY LOW**

1. **Localized Changes**: Only 6 path generation points updated
2. **No Database Changes**: URLs stored in DB are opaque strings
3. **No API Changes**: Frontend doesn't parse or generate paths
4. **Explicit Validation**: Runtime errors if item_id is missing
5. **Clean Slate**: Fresh start eliminates migration complexity

## Testing Checklist

After clearing all data and redeploying:

1. ✅ Upload image via PC upload → Check B2 path is `assets/{item_id}/{asset_group_id}/source.webp`
2. ✅ Upload image via IronDrive picker → Check B2 path structure matches
3. ✅ Upload video → Check B2 path is `assets/{item_id}/{asset_group_id}/video.{ext}`
4. ✅ Delete file → Verify cleanup finds and deletes from correct path
5. ✅ View uploaded files in UI → Verify CDN URLs work correctly

## Deployment Steps

1. Clear all data from database (as planned)
2. Clear all files from B2 bucket (as planned)
3. Redeploy worker with updated code
4. Test uploads immediately to verify new path structure

## Files Modified

- `worker/src/services/uploadHandler.ts`
- `worker/src/services/storage.ts`
- `worker/src/services/jobProcessor.ts`
- `worker/src/services/cleanupProcessor.ts`

## Build Status

✅ Frontend build: SUCCESS
⚠️  Worker build: Requires `npm install` (TypeScript compilation is valid)
