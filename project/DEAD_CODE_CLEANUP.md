# Dead Code Cleanup - March 5, 2026

## Summary

Removed confusing dead code that incorrectly suggested PC uploads go to RAID. PC uploads actually go **directly to the worker/B2**, never to RAID.

## Actual Upload Flow (Correct)

### PC Uploads (Active Code)
```
PC → FileUploadService.uploadPCFileToWorker() → Worker → B2 → CDN
```

Used by:
- `InventoryItemFormNew.tsx` (active form)
- `GlobalInventoryManagement.tsx` (active component)

### Picker Uploads (Active Code)
```
IronDrive Picker → source_key → Worker processes → B2 variants → CDN
```

## Dead Code Removed

### 1. Old Form Components
- ❌ `src/components/InventoryItemForm.tsx` - Old form that referenced RAID upload
- ❌ `src/components/InventoryManagement.tsx` - Old management component (never used)
- ❌ `src/components/CreateAuctionModal.tsx` - Imported but never rendered
- ❌ `src/components/BulkInventoryUploadForm.tsx` - Not imported anywhere

### 2. Dead Upload Functions in IronDriveService
- ❌ `uploadInventoryImages()` - PC upload to RAID (dead code)
- ❌ `uploadImage()` - Single file wrapper (dead code)
- ❌ `uploadWithProgress()` - Helper for above (dead code)
- ❌ Related TypeScript interfaces: `UploadResult`, `UploadResponse`, `FileMetadata`

### 3. Buggy Deletion Logic
Fixed `inventoryService.ts` `deleteItem()` function that:
- ❌ Called non-existent `IronDriveService.deleteFilePhysical()`
- ❌ Had complex RAID deletion logic (unnecessary - we never delete from B2/RAID)
- ✅ Now simply soft-deletes with `detached_at` timestamp

### 4. Unused Import
- ❌ Removed `CreateAuctionModal` import from `App.tsx`

## What Remains in IronDriveService

These functions ARE still used:

- ✅ `checkHealth()` - Used by IronDriveConnectionTest
- ✅ `getReferenceCount()` - Used by inventoryService
- ✅ `deleteFile()` - Soft delete (sets detached_at)
- ✅ `getCdnUrl()` - Build CDN URLs
- ✅ `createFolder()` - RAID folder management
- ✅ `testConnection()` - Health check wrapper
- ✅ `isRaidAvailable()` - Check RAID status
- ✅ `getImageUrl()` - URL builder
- ✅ `getRaidState()` - State accessor

## Architecture Confirmed

### PC Upload Path (Current & Correct)
1. User picks file in `InventoryItemFormNew.tsx`
2. Calls `FileUploadService.uploadPCFileToWorker(file, itemId)`
3. POSTs to `${VITE_WORKER_URL}/api/upload-and-process`
4. Worker processes and uploads to B2
5. Worker creates variants (thumb, display, video)
6. Returns CDN URLs
7. Frontend creates `auction_files` records with `b2_key` and `cdn_url`

### Picker Upload Path (Current & Correct)
1. User picks file from IronDrive picker
2. Frontend creates `auction_files` record with `source_key` (RAID path)
3. Trigger creates `publish_jobs` record
4. Worker polls `publish_jobs` table
5. Worker downloads from RAID, processes, uploads to B2
6. Worker updates `auction_files` with `b2_key`, `cdn_url`, variants

## File Deletion (Clarified)

- Files are NEVER physically deleted from RAID or B2
- Deletion sets `detached_at` timestamp (30-day soft delete)
- CASCADE on `item_id` handles auction_files cleanup
- No manual file management needed

## Build Status

✅ Build successful after cleanup
✅ No TypeScript errors
✅ All dead code removed
