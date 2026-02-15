# PC Upload Implementation Complete

## Overview
Implemented direct PC file uploads to the worker with processing pipeline. PC uploads now bypass RAID storage and go straight to the worker for processing and publishing to B2/CDN.

## Architecture

### Two Parallel Upload Paths

**Path 1: IronDrive Picker (unchanged)**
```
IronDrive Picker → RAID Storage (source_key) → Worker Poll → Process → B2 → CDN
```
- Original files stay in RAID as backup
- Worker processes on schedule
- Can re-process if needed

**Path 2: PC File Selector (new)**
```
PC File Input → Worker HTTP Endpoint → Process → B2 → CDN
```
- Files uploaded directly from browser
- Immediate processing (resize, optimize, WebP)
- No RAID backup (original stays on user's PC)
- Faster, simpler flow

## Implementation Details

### Worker Changes

#### 1. Added Dependencies (`worker/package.json`)
- `express` - HTTP server
- `multer` - File upload handling
- `@types/express`, `@types/multer` - TypeScript types

#### 2. HTTP Server (`worker/src/index.ts`)
- Express server running alongside job processor
- Port: 3000 (configurable via `PORT` env var)
- Endpoints:
  - `GET /health` - Health check
  - `POST /api/upload-and-process` - File upload endpoint

#### 3. Upload Handler (`worker/src/services/uploadHandler.ts`)
- Accepts files via multipart/form-data
- Processes images (creates thumb + display variants)
- Uploads to B2 storage
- Creates auction_files records with:
  - `status: 'published'`
  - `uploaded_from: 'pc'`
  - `source_key: null` (no RAID backup)
  - Proper metadata (width, height, format)

#### 4. Database Service (`worker/src/services/database.ts`)
- Added `createAuctionFile()` method
- Supports both lot_id and inventory_item_id

#### 5. Storage Service (`worker/src/services/storage.ts`)
- Added `getCdnUrl()` method for generating CDN URLs

### Frontend Changes

#### 1. Environment Variable (`.env`)
```env
VITE_WORKER_URL=http://localhost:3000
```

#### 2. File Upload Service (`src/services/fileUploadService.ts`)
- Added `uploadPCFileToWorker()` - single file upload
- Added `uploadMultiplePCFilesToWorker()` - batch upload
- Progress tracking support
- Returns processed file metadata and CDN URLs

#### 3. Inventory Form (`src/components/InventoryItemFormNew.tsx`)
- Uses `FileUploadService.uploadMultiplePCFilesToWorker()`
- Removed old `StorageService` dependency
- Updated to work with new auction_files schema
- Files marked as detached instead of deleted

#### 4. Removed Dependencies
- Removed `StorageService` import from `inventoryService.ts`

## Database Schema

### auction_files table
```sql
- lot_id: uuid (nullable)
- inventory_item_id: uuid (nullable)
- variant: text ('thumb', 'display', 'full')
- b2_key: text (B2 storage path)
- source_key: text (nullable, RAID path for picker uploads)
- status: text ('published')
- uploaded_from: text ('pc' or 'picker')
- file_size: integer
- width: integer
- height: integer
- format: text ('webp')
- detached_at: timestamp (nullable, for cleanup)
```

## Upload Flow

### PC Upload Process
1. User selects files in browser
2. Frontend calls `FileUploadService.uploadMultiplePCFilesToWorker()`
3. Files sent to worker via HTTP POST
4. Worker receives file, processes immediately:
   - Creates thumbnail (400x400)
   - Creates display image (1600x1600)
   - Converts to WebP format
5. Uploads both variants to B2
6. Creates auction_files records
7. Returns CDN URLs to frontend

### What Gets Stored
- **B2 Storage**: Processed variants (thumb.webp, display.webp)
- **Database**: File metadata, CDN URLs, dimensions
- **RAID**: Nothing (PC uploads don't touch RAID)

## Benefits

✅ **Faster**: No intermediate storage step
✅ **Simpler**: Direct upload → process → publish flow
✅ **Consistent**: All files end up as WebP in same formats
✅ **Flexible**: User keeps original on their PC
✅ **Safe**: IronDrive picker path unchanged

## Testing

Both build processes complete successfully:
- Frontend: `npm run build` ✅
- Worker: `cd worker && npm run build` ✅

## Next Steps

1. Deploy worker to Railway with updated code
2. Set `VITE_WORKER_URL` in production .env
3. Test PC uploads end-to-end
4. Monitor worker logs for any issues

## Files to Archive (Optional)

These files are no longer used but kept for reference:
- `src/services/storageService.ts` - Old B2 upload service
- `supabase/functions/upload-to-b2/index.ts` - Old edge function

Can be removed when confident the new system works perfectly.
