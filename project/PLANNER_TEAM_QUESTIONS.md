# Media Publishing System - Status Report for Planner Team

## Original Plan Requirements
From the Auction Team Guide document you provided:

1. Implement publish worker (pulls from RAID using source_key)
2. Generates image variants (WebP thumb/display) and uploads to B2
3. Uploads videos as-is to B2
4. Sets Cache-Control headers on upload
5. Writes metadata to DB (width/height/duration, bytes, mime, sha256 optional)
6. Implements lot-level 'Recently removed (30 days)' UI for restore
7. Implements cleanup job to purge detached assets >30 days when unused
8. Ensure admin preview uses CDN URLs

---

## What's Been Implemented (75% Complete)

### ✅ 1. Publish Worker - COMPLETE
**How it works:**
- Worker runs on Railway (Node.js environment, not Supabase Edge Functions)
- Polls `publish_jobs` table every 5 seconds for pending jobs
- Downloads source files from RAID using `file_key` via RaidService
- Processes images and uploads to B2
- Updates `auction_files` table with CDN URLs
- Implements retry logic (max 3 retries with exponential backoff)

**Files:**
- `/worker/src/services/jobProcessor.ts` - Main processing logic
- `/worker/src/services/database.ts` - Database operations
- `/worker/src/services/raid.ts` - RAID file downloads
- `/worker/src/index.ts` - Worker entry point

**Database tables:**
- `publish_jobs` - Job queue (file_id, status, retry_count, error_message)
- `auction_files` - File records with publish status

### ✅ 2. Image Variants - COMPLETE
**How it works:**
- Uses Sharp library for image processing
- Creates thumbnail: 400px max dimension, WebP format, 85% quality
- Creates display: 1600px max dimension, WebP format, 90% quality
- Maintains aspect ratio with `fit: 'inside'`
- Never enlarges images smaller than target size

**Files:**
- `/worker/src/services/imageProcessor.ts`

**B2 Upload:**
- Uploads to configured bucket via `/worker/src/services/storage.ts`
- Generates CDN URLs: `{CDN_URL}/{cdn_key_prefix}_{variant}.webp`
- Stores URLs in `auction_files.thumb_url` and `display_url`

### ✅ 3. Cache-Control Headers - COMPLETE
**Implementation:**
```typescript
CacheControl: 'public, max-age=31536000, immutable'
```
- 1-year cache lifetime
- Public caching enabled
- Marked immutable (content never changes)

**File:** `/worker/src/services/storage.ts:29`

### ✅ 4. Cleanup Job - COMPLETE
**How it works:**
- Runs every hour via `setInterval`
- Queries for files where `deleted_at < NOW() - INTERVAL '30 days'`
- Deletes both variants from B2 (thumb + display)
- Removes database record after successful B2 deletion
- Processes up to 100 files per run
- Graceful error handling (logs failures, continues)

**Files:**
- `/worker/src/services/cleanupProcessor.ts`

**Database:**
- Respects soft delete: Only deletes files with `deleted_at` older than 30 days
- Hard deletes from `auction_files` after B2 cleanup

### ✅ 5. Edge Functions for Media Operations - COMPLETE
Created three Supabase Edge Functions:

**`lot-media-attach`:**
- Creates `auction_files` record
- Creates `publish_jobs` record
- Returns file and job info

**`lot-media-detach`:**
- Soft deletes file (sets `deleted_at` timestamp)
- Does NOT delete from B2 immediately (30-day grace period)

**`lot-media-status`:**
- Queries file status by file_id, lot_id, or auction_id
- Returns files with their associated job status

**Files:**
- `/supabase/functions/lot-media-attach/index.ts`
- `/supabase/functions/lot-media-detach/index.ts`
- `/supabase/functions/lot-media-status/index.ts`

### ✅ 6. Frontend Service Layer - COMPLETE
**File:** `/src/services/mediaPublishingService.ts`

Provides TypeScript service for:
- `attachMedia()` - Create file and start publish job
- `detachMedia()` - Soft delete file
- `getMediaStatus()` - Query file status

---

## What's Missing (25%)

### ❌ 1. Video Upload Support - NOT IMPLEMENTED
**Current state:**
```typescript
// worker/src/services/jobProcessor.ts:43
if (!this.imageProcessor.isImage(file.file_type)) {
  throw new Error('Video processing not yet implemented');
}
```

**What needs to happen:**
- Detect video MIME types (video/mp4, video/quicktime, video/webm, etc.)
- Download video from RAID (same as images)
- Upload video directly to B2 WITHOUT processing (no transcoding)
- Store CDN URL in database (use `display_url` or add `video_url` column?)
- Update frontend to display videos

**Questions for planner:**
- Should videos be stored in the same B2 bucket as images?
- Do we need multiple video qualities or just upload original?
- Should thumbnail be generated from video first frame? Or manual upload?

### ❌ 2. Recently Removed UI - NOT IMPLEMENTED
**Current state:**
- Database fully supports it (`deleted_at` column exists)
- Soft delete happens via `lot-media-detach` edge function
- 30-day grace period enforced by cleanup job
- **But there is NO UI to view or restore deleted files**

**What needs to happen:**
- Add "Recently Removed" section to inventory/lot management
- List files where `deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '30 days'`
- Show countdown: "X days until permanent deletion"
- Add "Restore" button (clears `deleted_at`, cancels deletion)
- Add "Delete Now" button (forces immediate cleanup)

**Questions for planner:**
- Where should this UI live? In AdminPanel? InventoryManagement? Both?
- Should it be per-lot or global view?
- Who should have access? All admins or specific permissions?

### ⚠️ 3. Metadata Storage - PARTIALLY IMPLEMENTED
**Current state:**
- `auction_files.size` stores file size in bytes ✅
- `auction_files.mime_type` stores MIME type ✅
- Width/height NOT stored ❌
- Duration NOT stored ❌
- SHA256 NOT stored ❌

**What needs to happen:**
- Add columns: `width`, `height`, `duration` (for videos), `sha256` (optional)
- Extract image dimensions from Sharp metadata during processing
- Extract video duration using ffprobe or similar (for videos)
- Calculate SHA256 hash during download (optional, for deduplication)
- Store in database during `markJobCompleted`

**Questions for planner:**
- Is SHA256 important for deduplication? Or just nice-to-have?
- Should we store video codec info (h264, h265, etc.)?
- Any other metadata needed (bitrate, framerate, color space)?

### ⚠️ 4. Admin Preview CDN Usage - NEEDS VERIFICATION
**Unclear:** We don't know if all admin panels are using CDN URLs or if some still reference RAID `download_url`

**What needs to happen:**
- Audit all components that display images/files
- Verify they use `thumb_url`/`display_url` (CDN) not `download_url` (RAID)
- Add fallback logic: If not published yet, what should display?
- Test that published images load from CDN in admin tools

**Components to check:**
- `AdminPanel.tsx`
- `InventoryManagement.tsx`
- `InventoryItemForm.tsx`
- `EventInventoryManager.tsx`
- `GlobalInventoryManagement.tsx`
- Any other admin file management UIs

**Questions for planner:**
- What should display for unpublished files (still processing)?
- Should we show RAID preview until CDN is ready?
- Or show loading state / placeholder?

---

## Architecture Decisions Made

### Decision: Railway Instead of Supabase for Worker
**Why:**
- Supabase Edge Functions have limited runtime (unclear if sufficient for image processing)
- Railway provides native Node.js environment
- Sharp library works better in Node.js
- Long-running processes easier to manage
- Better debugging and logging capabilities
- More control over job processing and retries

**Trade-offs:**
- Additional infrastructure to manage (Railway + Supabase)
- Need to maintain environment variables in two places
- Slightly more complex deployment

**Current deployment:**
- Worker runs on Railway with health checks
- Connects to Supabase database via connection string
- Connects to B2 via S3-compatible API
- Connects to RAID API via custom service

### Database Schema
Well-designed separation of concerns:
- `auction_files` - File metadata and CDN URLs
- `publish_jobs` - Job queue with status tracking
- Soft delete via `deleted_at` timestamp
- Asset grouping via `asset_group_id`

---

## Questions for Planner Team

### Priority and Scope
1. **Video support** - Is this critical for MVP or can it wait?
2. **Recently Removed UI** - User-facing feature or admin-only?
3. **Metadata storage** - Which fields are must-have vs nice-to-have?
4. **Admin preview audit** - Should we do this before adding new features?

### Video Implementation Details
5. Should videos be in the same B2 bucket or separate?
6. Do we need video transcoding or just upload original?
7. Should we generate thumbnail from first frame automatically?
8. What video formats must be supported? (mp4, mov, webm, etc.)

### Recently Removed UI
9. Where should "Recently Removed" UI live in the app?
10. Per-lot view or global view across all lots/auctions?
11. Who has permission to restore files?
12. Should restore notify anyone or log the action?

### Metadata and Deduplication
13. Is SHA256 hashing important for your use case?
14. Do you need video technical metadata (codec, bitrate, etc.)?
15. Should duplicate files (same SHA256) be prevented or allowed?

### Admin Preview
16. What should display when file is still publishing (job in progress)?
17. Should unpublished files show RAID preview or placeholder?
18. Is there a requirement to preview before publish?

---

## Current System Health

### Working Components
- ✅ Worker processes jobs successfully
- ✅ Images publish to B2 with CDN URLs
- ✅ Cleanup job runs on schedule
- ✅ Edge functions handle attach/detach operations
- ✅ Frontend service layer integrates cleanly
- ✅ Build completes without errors

### Known Limitations
- ❌ Videos immediately fail with "not yet implemented"
- ❌ No way to recover accidentally deleted files
- ❌ Image dimensions not available for responsive loading
- ⚠️ Unknown if all admin UIs use CDN URLs correctly

---

## Recommended Next Steps

### Option A: Complete Core Features First
1. Implement video upload (highest impact)
2. Add metadata storage (width/height/duration)
3. Build "Recently Removed" UI (safety feature)
4. Audit admin preview usage

### Option B: Stabilize Before Adding Features
1. Audit admin preview CDN usage (ensure current system works)
2. Add metadata storage (improves current system)
3. Build "Recently Removed" UI (safety feature)
4. Then add video support (new feature)

### Option C: User-Driven Priority
Planner team decides based on:
- User feedback / requests
- Business requirements
- Timeline constraints
- Resource availability

---

## Request for Planner Team

Please review this status and provide:
1. **Priority ranking** - Which missing features are most important?
2. **Scope clarification** - Answers to questions above
3. **Go/no-go decision** - Should we proceed with implementation?
4. **Timeline expectations** - Any deadlines or milestones?
5. **Resource constraints** - Any limitations we should know about?

Once we have your guidance, we can implement the remaining features according to your priorities.
