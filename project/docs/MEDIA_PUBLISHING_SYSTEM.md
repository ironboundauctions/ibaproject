# Media Publishing System - Complete Guide

## Overview

The Media Publishing System automates the process of downloading auction media from RAID, creating optimized WebP variants, and publishing to Backblaze B2 with CloudFlare CDN distribution.

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        User/Admin                             │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                   Edge Functions (Supabase)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   attach    │  │   detach    │  │   status    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                   Database (Postgres)                         │
│  ┌──────────────┐         ┌────────────────┐                │
│  │auction_files │◄────────│ publish_jobs   │                │
│  └──────────────┘         └────────────────┘                │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│              Background Worker (Node.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Download │─▶│ Process  │─▶│  Upload  │─▶│  Update  │   │
│  │   RAID   │  │  (sharp) │  │    B2    │  │  Status  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│           Backblaze B2 + CloudFlare CDN                       │
│  https://cdn.ibaproject.bid/file/IBA-Lot-Media/...           │
└──────────────────────────────────────────────────────────────┘
```

## Database Schema

### `auction_files` Table (Extended)

New columns added:
- `thumb_url` (text) - CDN URL for 400px thumbnail
- `display_url` (text) - CDN URL for 1600px display image
- `publish_status` (text) - 'pending', 'processing', 'published', 'failed', 'deleted'
- `published_at` (timestamptz) - Timestamp when variants were published
- `deleted_at` (timestamptz) - Soft delete timestamp (30-day retention)
- `cdn_key_prefix` (text) - Base S3 key for this file's variants

### `publish_jobs` Table (New)

Background job queue:
- `id` (uuid) - Job ID
- `file_id` (uuid) - Foreign key to auction_files
- `status` (text) - 'pending', 'processing', 'completed', 'failed'
- `priority` (int) - Higher = more urgent (default: 5)
- `retry_count` (int) - Number of retries attempted
- `max_retries` (int) - Maximum allowed retries (default: 5)
- `error_message` (text) - Error details if failed
- `started_at` (timestamptz) - When processing began
- `completed_at` (timestamptz) - When processing finished

## Edge Functions

### 1. `lot-media-attach`

Attaches media to lots/auctions and enqueues for processing.

**Endpoint**: `POST /functions/v1/lot-media-attach`

**Request Body**:
```json
{
  "file_key": "raid://auction-123/lot-456/image.jpg",
  "file_name": "image.jpg",
  "file_type": "image/jpeg",
  "lot_id": "uuid-here",
  "auction_id": "uuid-here",
  "priority": 10
}
```

**Response**:
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "file_key": "raid://...",
    "publish_status": "pending",
    ...
  },
  "job": {
    "id": "uuid",
    "status": "pending",
    ...
  }
}
```

### 2. `lot-media-detach`

Soft-deletes media (30-day retention before permanent deletion).

**Endpoint**: `POST /functions/v1/lot-media-detach`

**Request Body**:
```json
{
  "file_id": "uuid-here"
}
```

**Response**:
```json
{
  "success": true,
  "message": "File marked for deletion (30-day retention period)",
  "file_id": "uuid"
}
```

### 3. `lot-media-status`

Retrieves publishing status for media files.

**Endpoint**: `GET /functions/v1/lot-media-status?lot_id=uuid`

**Query Parameters** (one required):
- `file_id` - Get status for specific file
- `lot_id` - Get all media for a lot
- `auction_id` - Get all media for an auction

**Response**:
```json
{
  "files": [
    {
      "id": "uuid",
      "file_key": "raid://...",
      "thumb_url": "https://cdn.ibaproject.bid/file/IBA-Lot-Media/..._thumb.webp",
      "display_url": "https://cdn.ibaproject.bid/file/IBA-Lot-Media/..._display.webp",
      "publish_status": "published",
      "published_at": "2025-02-07T10:00:00Z",
      "job": {
        "status": "completed",
        "retry_count": 0,
        "completed_at": "2025-02-07T10:00:05Z"
      }
    }
  ]
}
```

## Frontend Integration

### MediaImage Component

Use the `MediaImage` component to display images with automatic CDN/RAID fallback:

```tsx
import { MediaImage } from './components/MediaImage';

function LotImage({ file }) {
  return (
    <MediaImage
      thumbUrl={file.thumb_url}
      displayUrl={file.display_url}
      raidUrl={file.file_key}
      alt={file.file_name}
      variant="thumb"
      publishStatus={file.publish_status}
      className="w-full h-64 object-cover"
    />
  );
}
```

**Features**:
- Automatically uses CDN variants when `publish_status === 'published'`
- Falls back to RAID URL if CDN fails or not yet published
- Shows processing indicator for pending jobs
- Shows error badge for failed jobs
- Lazy loading for performance

### Media Publishing Service

Use the service to interact with edge functions:

```tsx
import { mediaPublishingService } from './services/mediaPublishingService';

// Attach media file
const result = await mediaPublishingService.attachMedia({
  file_key: 'raid://auction-123/lot-456/image.jpg',
  file_name: 'image.jpg',
  file_type: 'image/jpeg',
  lot_id: lotId,
  priority: 10, // Higher priority = processed sooner
});

// Get media status for a lot
const status = await mediaPublishingService.getMediaStatus({
  lot_id: lotId,
});

// Detach (soft delete) media
await mediaPublishingService.detachMedia(fileId);
```

## Worker Processing

### Processing Flow

1. **Poll Queue**: Worker polls `publish_jobs` for pending jobs
2. **Download**: Downloads source file from RAID using authentication
3. **Process Images**:
   - Creates 400px thumbnail (WebP, 85% quality)
   - Creates 1600px display image (WebP, 90% quality)
4. **Upload**: Uploads both variants to B2 via S3 API
5. **Update Status**: Marks job complete and updates `auction_files` with CDN URLs

### Job Priority

Jobs are processed in priority order (higher first):
- **Priority 10**: Urgent (featured lots, active auctions)
- **Priority 5**: Normal (default)
- **Priority 1**: Low (archived content)

### Retry Logic

Failed jobs automatically retry:
- **Attempt 1**: Immediate retry
- **Attempt 2**: 1 minute delay
- **Attempt 3**: 5 minutes delay
- **Attempt 4**: 15 minutes delay
- **Attempt 5**: 1 hour delay
- **After 5 failures**: Marked as permanently failed

### Concurrency

Worker processes multiple jobs concurrently (default: 3).

Configure via `CONCURRENCY` environment variable.

## CDN URL Structure

Published variants follow this pattern:

```
Base Key: {file_key}/{timestamp}-{sanitized_filename}

Thumbnail:  {base_key}_thumb.webp
Display:    {base_key}_display.webp

Example:
raid://auction-123/lot-456/my-image.jpg
↓
https://cdn.ibaproject.bid/file/IBA-Lot-Media/raid://auction-123/lot-456/my-image.jpg/1707307200000-my-image_thumb.webp
https://cdn.ibaproject.bid/file/IBA-Lot-Media/raid://auction-123/lot-456/my-image.jpg/1707307200000-my-image_display.webp
```

## File Lifecycle

### 1. Creation

- Admin uploads file to RAID
- Calls `lot-media-attach` edge function
- Creates `auction_files` record with `publish_status: 'pending'`
- Creates `publish_jobs` record

### 2. Processing

- Worker picks up job
- Updates `publish_status: 'processing'`
- Downloads, processes, uploads
- Updates `publish_status: 'published'`
- Sets `thumb_url`, `display_url`, `published_at`

### 3. Published

- File is live on CDN
- Frontend uses CDN URLs automatically
- RAID source remains as fallback

### 4. Soft Delete

- Admin calls `lot-media-detach`
- Sets `publish_status: 'deleted'`
- Sets `deleted_at` timestamp
- File remains in database for 30 days

### 5. Permanent Delete

- After 30 days, pg_cron job runs
- Deletes database record
- Worker should delete B2 files (future enhancement)

## Image Processing Specifications

### Thumbnail Variant

- **Max dimensions**: 400x400px
- **Fit mode**: Inside (maintains aspect ratio)
- **Format**: WebP
- **Quality**: 85%
- **Use case**: Grid views, thumbnails, previews

### Display Variant

- **Max dimensions**: 1600x1600px
- **Fit mode**: Inside (maintains aspect ratio)
- **Format**: WebP
- **Quality**: 90%
- **Use case**: Detail views, lightboxes, galleries

### Source File

- Remains on RAID indefinitely
- Used as fallback if CDN fails
- Original quality preserved

## Monitoring & Maintenance

### Key Metrics

Monitor these in your database:

```sql
-- Publishing status breakdown
SELECT publish_status, COUNT(*)
FROM auction_files
WHERE deleted_at IS NULL
GROUP BY publish_status;

-- Failed jobs needing attention
SELECT pj.*, af.file_name
FROM publish_jobs pj
JOIN auction_files af ON af.id = pj.file_id
WHERE pj.status = 'failed'
AND pj.retry_count >= pj.max_retries;

-- Processing performance (last hour)
SELECT
  COUNT(*) as completed_jobs,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_seconds
FROM publish_jobs
WHERE status = 'completed'
AND completed_at > NOW() - INTERVAL '1 hour';
```

### Cleanup

Automatic cleanup via pg_cron:
- **Schedule**: Daily at 2 AM UTC
- **Target**: Files with `deleted_at` older than 30 days
- **Action**: Permanent database deletion

### Manual Intervention

Reprocess failed jobs:
```sql
-- Reset failed job to retry
UPDATE publish_jobs
SET status = 'pending',
    retry_count = 0,
    error_message = NULL
WHERE id = 'job-uuid-here';

-- Reset file status
UPDATE auction_files
SET publish_status = 'pending'
WHERE id = 'file-uuid-here';
```

## Troubleshooting

### File stuck in "processing"

1. Check worker logs for errors
2. Verify worker is running
3. Check database for job status:
   ```sql
   SELECT * FROM publish_jobs WHERE file_id = 'uuid';
   ```

### CDN images not loading

1. Verify `publish_status = 'published'`
2. Check `thumb_url` and `display_url` are set
3. Test CDN URL directly in browser
4. Frontend should fall back to RAID automatically

### Worker not processing jobs

1. Check worker is running: `pm2 status` or container logs
2. Verify database connection
3. Check for pending jobs: `SELECT * FROM publish_jobs WHERE status = 'pending'`
4. Review worker logs for errors

## Best Practices

### For Developers

1. **Always use MediaImage component** - Don't access URLs directly
2. **Check publish_status** - Handle pending/failed states gracefully
3. **Provide fallbacks** - RAID URLs should always work
4. **Show status indicators** - Users need feedback during processing

### For Admins

1. **Monitor failed jobs** - Review and reprocess if needed
2. **Watch queue depth** - Scale worker if backlog grows
3. **Test uploads** - Verify end-to-end before bulk imports
4. **Plan deletions** - Remember 30-day retention period

## Security Considerations

- **Authentication**: All edge functions require valid JWT
- **Authorization**: Only admins can attach/detach media
- **RAID access**: Secured via Bearer token
- **B2 access**: Uses S3-compatible signed requests
- **CDN caching**: Public, but URLs are non-guessable (UUIDs + timestamps)

## Future Enhancements

Planned improvements:
- Video transcoding support
- Progressive image loading (LQIP)
- Image optimization profiles (aggressive, balanced, quality)
- Bulk processing API
- B2 file cleanup on deletion
- Webhook notifications for job completion
- Admin dashboard for monitoring

## Getting Started

### 1. Deploy Worker

Follow instructions in `/worker/README.md` to deploy the worker to your hosting service.

### 2. Test System

```bash
# Attach a test file
curl -X POST https://your-project.supabase.co/functions/v1/lot-media-attach \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "file_key": "test-key",
    "file_name": "test.jpg",
    "file_type": "image/jpeg",
    "priority": 10
  }'

# Check status
curl https://your-project.supabase.co/functions/v1/lot-media-status?file_id=FILE_UUID \
  -H "apikey: YOUR_ANON_KEY"
```

### 3. Integrate Frontend

Use `MediaImage` component and `mediaPublishingService` in your application.

### 4. Monitor

Set up monitoring queries and alerts for failed jobs.

## Support

For issues or questions:
1. Check worker logs
2. Review edge function logs in Supabase dashboard
3. Query database for job/file status
4. Refer to troubleshooting section above
