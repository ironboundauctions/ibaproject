# Direct B2 Backblaze Storage - Complete System Overhaul

## Overview
Completely removed the complex RAID/worker/publishing system in favor of **direct uploads to YOUR Backblaze B2 bucket**.

## What Changed

### 1. **Storage System - DIRECT B2**
- **Edge Function:** `supabase/functions/upload-to-b2/index.ts`
- **Service:** `src/services/storageService.ts`
- **What it does:** Files upload directly to YOUR B2 bucket via Supabase Edge Function
- **Folder structure:** `items/{item_id}/filename.ext` in YOUR B2 bucket
- **No intermediary storage, no Supabase Storage, just YOUR B2 bucket**

### 2. **Database Schema - SIMPLIFIED**
- **Tables REMOVED:**
  - `publish_jobs` (no more worker jobs)
  - `media_cleanup_log` (no more cleanup tracking)

- **Table auction_files - COMPLETELY REBUILT:**
  ```sql
  OLD (25+ columns):
  - storage_provider, file_key, download_url, backup_url
  - source_user_id, thumb_url, display_url, cdn_url
  - publish_status, published_at, deleted_at
  - asset_group_id, file_type, variant
  - width, height, duration_seconds
  ... etc

  NEW (9 columns):
  - id, item_id, file_path, url
  - name, mime_type, size, is_video
  - uploaded_by, created_at
  ```

### 3. **Upload Flow - DIRECT TO YOUR B2**
**OLD Complex Flow:**
1. User uploads → RAID storage
2. Database record created with `publish_status: 'pending'`
3. Trigger creates publish_job
4. Worker polls for jobs
5. Worker downloads from RAID
6. Worker processes (resize, convert to WebP)
7. Worker uploads to B2
8. Worker updates database with CDN URLs
9. Worker sets `publish_status: 'published'`
10. UI refreshes to show CDN URLs

**NEW Simple Flow:**
1. User uploads → **Edge Function**
2. Edge Function → **YOUR B2 bucket directly**
3. Database record created with CDN URL
4. **Done! Image immediately available**

### 4. **Edge Function**

`supabase/functions/upload-to-b2/index.ts`:
- Receives file from frontend
- Uses AWS SDK S3 client (compatible with B2)
- Uploads directly to YOUR B2 bucket
- Returns CDN URL for immediate use
- No processing, no delays, no complexity

### 5. **Components Updated**

#### storageService.ts (REWRITTEN)
- Calls the edge function with file and itemId
- Edge function returns CDN URL
- No Supabase Storage, only YOUR B2 bucket

#### InventoryItemFormNew.tsx
- Clean, simple 400-line component
- Uses `StorageService` for uploads
- Upload progress indicator
- Saves CDN URLs directly to `auction_files`
- No RAID, no IronDrive picker, no worker coordination

#### GlobalInventoryManagement.tsx
- Simplified media loading
- Single query to get all files
- Displays CDN URLs directly from YOUR B2 bucket

#### inventoryService.ts
- Removed all IronDrive/RAID code
- Simplified `deleteItem()` method

### 6. **Files/Services DEPRECATED** (Still exist but not used)
- `src/components/InventoryItemForm.tsx` (1390 lines of complexity)
- `src/services/ironDriveService.ts` (RAID integration)
- `src/services/mediaPublishingService.ts` (worker coordination)
- `worker/` directory (entire Node.js worker system)

## New System Architecture

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │ Upload file
         ↓
┌─────────────────┐
│ StorageService  │ (Frontend)
└────────┬────────┘
         │ Calls Edge Function
         ↓
┌─────────────────┐
│ upload-to-b2    │ (Supabase Edge Function)
│ Edge Function   │
└────────┬────────┘
         │ Direct upload using AWS SDK
         ↓
┌─────────────────┐
│ YOUR B2 BUCKET  │ (Backblaze B2)
│                 │
└────────┬────────┘
         │ Returns CDN URL
         ↓
┌─────────────────┐
│ auction_files   │ (Database)
│ table           │
└─────────────────┘
```

## B2 Folder Structure

**OLD (Complex):**
```
IBA-Lot-Media/
  assets/
    {asset_group_id_1}/
      thumb.webp
      display.webp
    {asset_group_id_2}/
      thumb.webp
      display.webp
    ...30+ folders for 2 images
```

**NEW (Simple):**
```
your-b2-bucket/
  items/
    {item_id_1}/
      image1.jpg
      image2.mp4
    {item_id_2}/
      photo.jpg
```

## Configuration Required

You MUST add B2 credentials to your `.env` file:

```bash
# Backblaze B2 Configuration
B2_KEY_ID=your_b2_key_id_here
B2_APP_KEY=your_b2_application_key_here
B2_BUCKET=your_b2_bucket_name_here
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
VITE_CDN_BASE_URL=https://f004.backblazeb2.com/file/your-bucket-name
```

### How to Get B2 Credentials:

1. **Log into Backblaze B2**
2. **Create Application Key:**
   - Go to "App Keys" in your B2 dashboard
   - Click "Add a New Application Key"
   - Give it a name like "auction-webapp"
   - Select your bucket
   - Copy the `keyID` → `B2_KEY_ID`
   - Copy the `applicationKey` → `B2_APP_KEY`

3. **Get Bucket Info:**
   - Your bucket name → `B2_BUCKET`
   - Your bucket region endpoint → `B2_ENDPOINT`
   - Your CDN URL → `VITE_CDN_BASE_URL`

**Note:** The edge function automatically has access to these environment variables through Supabase's secrets management.

## Testing Instructions

1. **Add B2 credentials** to your `.env` file
2. **Delete all items** in the webapp
3. **Empty your B2 bucket** completely
4. **Create a new item** with 2 images
5. **Expected Result:**
   - Exactly 2 files in YOUR B2 bucket at: `items/{item_id}/`
   - Both images display immediately via CDN URLs
   - No "Processing..." placeholders
   - No duplicate files or extra folders
   - Files are ONLY in YOUR B2 bucket, nowhere else

## Benefits

✅ **Simple** - No worker, no job queue, no complex state machine
✅ **Fast** - Images available immediately, no processing delay
✅ **Clean** - One folder per item in YOUR B2 bucket
✅ **Reliable** - No worker to crash, no jobs to get stuck
✅ **Maintainable** - 400 lines vs 1390 lines, easy to understand
✅ **Cost effective** - No Railway worker hosting costs
✅ **Direct** - Files go straight to YOUR B2 bucket, not Supabase Storage

## What Was Removed

- ❌ Supabase Storage bucket (not used)
- ❌ RAID/IronDrive intermediary storage
- ❌ Worker processing system
- ❌ publish_jobs table
- ❌ Complex multi-step upload flow
- ❌ Processing delays
- ❌ Multiple file variants (thumb, display, original)

## What You Can Remove

- The entire `worker/` directory (no longer needed)
- Railway worker deployment (save hosting costs)
- RAID storage system (for new uploads)

## Migration Notes

- **Existing items**: Will still work with fallback to `image_url` field
- **New items**: Use the new direct B2 system exclusively
- **Worker**: Can be safely shut down on Railway
- **RAID storage**: No longer needed for new uploads
