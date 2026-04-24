# Barcode Images B2 Migration

## Overview
Barcode images are now stored in B2 (via the worker) instead of Supabase storage, aligning with the architecture used for all other media files.

## Why This Change?
- **Scalability**: With ~2000 items/month, storing barcode images in Supabase storage would create unnecessary costs and storage burden
- **Consistency**: All media files should use the same B2/CDN flow for uniformity
- **Cost Efficiency**: B2 is more cost-effective for high-volume image storage
- **Architecture Alignment**: Matches the existing media publishing system

## Implementation Details

### Database Changes
1. Added `barcode_asset_group_id` column to `inventory_items` table
   - Tracks the asset group ID for lifecycle management
   - Allows proper deletion of barcode images from B2

### Upload Flow
1. User uploads barcode image in inventory form
2. Image is sent to worker via `IronDriveService.uploadFile()`
3. Worker processes image and creates variants (source, display, thumb)
4. Worker uploads all variants to B2
5. CDN URL is saved to `inventory_items.barcode_image_url`
6. Asset group ID is saved to `inventory_items.barcode_asset_group_id`

### Deletion Flow
1. When user removes barcode image, call `IronDriveService.deleteFile(assetGroupId, itemId)`
2. Worker marks file as detached in database
3. Worker removes file from B2 after 30-day retention period

### Storage Structure in B2
Barcode images use the 'barcode' variant type:
```
assets/{asset_group_id}/source.webp  (original converted to WebP)
assets/{asset_group_id}/display.webp (1600px variant)
assets/{asset_group_id}/thumb.webp   (400px variant)
```

## Benefits
- ✅ Consistent with overall architecture
- ✅ Scalable for high volume (2000+ items/month)
- ✅ Cost-effective storage
- ✅ Proper lifecycle management (upload/delete)
- ✅ CDN delivery for fast loading
- ✅ Automatic image optimization (WebP conversion)

## Code Changes
- `InventoryItemFormNew.tsx`: Updated barcode upload/delete to use IronDriveService
- `inventoryService.ts`: Added `barcode_asset_group_id` to interface
- Database: Added `barcode_asset_group_id` column to `inventory_items`

## Testing
1. Upload a barcode image in inventory form
2. Verify it uploads to B2 (check asset group ID in database)
3. Verify CDN URL is saved
4. Remove barcode image and verify deletion call
5. Edit item and verify existing barcode loads correctly
