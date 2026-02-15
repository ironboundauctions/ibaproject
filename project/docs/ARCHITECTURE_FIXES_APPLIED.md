# Architecture Fixes Applied - 2026-02-14

This document summarizes the fixes applied to align the codebase with the authoritative implementation guide.

## Summary of Changes

The application has been realigned to follow the correct architecture:
- **RAID**: Master archive for originals (permanent storage)
- **Worker**: Processes and publishes optimized variants to B2
- **B2**: Public variants storage
- **Cloudflare CDN**: Public delivery of media files

## 1. Database Schema

### Migration: `20260214_restore_correct_media_architecture.sql`

**Recreated `auction_files` table** with correct structure:
- `asset_group_id`: Groups all variants of the same original file
- `variant`: 'source' | 'thumb' | 'display' | 'video'
- `source_key`: RAID file key for source variants
- `b2_key`: B2 object key for published variants
- `cdn_url`: Cloudflare CDN URL for public access
- `original_name`: Human-readable filename
- `bytes`, `mime_type`: File metadata
- `width`, `height`, `duration_seconds`: Media dimensions
- `published_status`: 'pending' | 'processing' | 'published' | 'failed'
- `detached_at`: Soft delete timestamp (30-day retention)

**Restored `publish_jobs` table**:
- Queue for asynchronous media processing
- Worker polls this table for pending jobs
- Includes retry logic with exponential backoff

**Created auto-trigger**:
- Automatically creates publish job when source variant is inserted
- Ensures all new media is queued for processing

## 2. Environment Variables

Updated `.env` with correct configuration:
- `RAID_PUB_BASE`: RAID publisher download endpoint
- `RAID_PUBLISHER_SECRET`: Authentication secret for RAID
- `B2_KEY_ID`, `B2_APP_KEY`: B2 credentials
- `B2_BUCKET`: Set to `IBA-Lot-Media`
- `CDN_BASE_URL`: Set to `https://cdn.ibaproject.bid/file/IBA-Lot-Media`
- Worker configuration parameters

## 3. Frontend Services

### IronDriveService
- **Updated picker contract**: Now returns only `source_key` and `original_name`
- **Removed**: Direct CDN URL generation from IronDrive
- **Updated**: All references to use new schema field names
- **Soft delete**: Changed to set `detached_at` instead of physical deletion

### MediaPublishingService
- **Completely rewritten** to work directly with Supabase
- **New methods**:
  - `attachMedia()`: Creates source variant and auto-generates publish job
  - `detachMedia()`: Soft deletes media (30-day retention)
  - `getMediaStatus()`: Retrieves files and job status
  - `getMediaByItem()`: Gets all media for a specific item
  - `getPublishedVariants()`: Gets all published variants for an asset group

### Edge Functions
- **Removed**: All edge functions (lot-media-attach, lot-media-detach, lot-media-status)
- Frontend now works directly with database via mediaPublishingService

## 4. Worker Updates

### Database Service
- Updated `AuctionFile` interface to match new schema
- Fixed field names: `source_key`, `b2_key`, `cdn_url`, `original_name`, `published_status`, `detached_at`
- Updated `upsertVariant()` to include `b2_key`
- Fixed all SQL queries to use correct field names

### Job Processor
- Updated to read `source_key` from source files
- Enhanced logging with `asset_group_id`
- Passes `b2_key` to database when upserting variants

### Storage Service
- Updated `uploadVariants()` to return both URLs and B2 keys
- Updated `uploadVideo()` to return both URL and B2 key
- Ensures proper B2 key format: `assets/{asset_group_id}/{variant}.ext`

## 5. Build Verification

Successfully built the project with no errors.

## Key Architecture Principles

1. **RAID is permanent**: Original files uploaded to RAID are NEVER deleted automatically
2. **Worker publishes to B2**: Worker downloads from RAID, processes, uploads to B2
3. **Frontend serves CDN only**: Public pages display only Cloudflare CDN URLs
4. **Soft delete with retention**: Files marked for deletion kept for 30 days
5. **IronDrive is picker only**: Returns identifiers, does not publish or generate CDN URLs

## Next Steps

1. **Configure secrets**: Set actual values for:
   - `RAID_PUBLISHER_SECRET`
   - `B2_KEY_ID`
   - `B2_APP_KEY`

2. **Deploy worker**: Follow worker deployment guide to deploy the media processing worker

3. **Test workflow**:
   - Upload file to IronDrive
   - Create/update item in admin
   - Pick file from IronDrive (returns source_key)
   - Verify publish job created
   - Wait for worker to process
   - Verify variants published to B2
   - Confirm CDN URLs work on frontend

4. **Acceptance testing**: Run the tests outlined in the authoritative guide section 10

## Files Modified

- `/supabase/migrations/20260214_restore_correct_media_architecture.sql`
- `/.env`
- `/src/services/ironDriveService.ts`
- `/src/services/mediaPublishingService.ts`
- `/worker/src/services/database.ts`
- `/worker/src/services/jobProcessor.ts`
- `/worker/src/services/storage.ts`

## Files Removed

- `/supabase/functions/lot-media-attach/`
- `/supabase/functions/lot-media-detach/`
- `/supabase/functions/lot-media-status/`
