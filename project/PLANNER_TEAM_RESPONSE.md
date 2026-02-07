# Response to Planner Team Checklist

## Implementation Summary

We've implemented the media publishing system with the following fixes based on your checklist:

---

## ✅ 1. Worker Runtime

**Implementation:** Node.js Worker (Railway/Render/VPS compatible)

- **NOT** Supabase Edge Function
- Uses `sharp` for image processing (requires Node.js runtime)
- Poll-based queue system: checks every 15 seconds (configurable via `WORKER_POLL_INTERVAL`)
- Deployment: `npm start` on any Node.js server
- Location: `/worker/` directory

**Files:**
- `worker/src/index.ts` - Main worker entry point
- `worker/src/services/jobProcessor.ts` - Job processing logic
- `worker/package.json` - Node.js dependencies including `sharp`

---

## ✅ 2. Queue Table Spec

**Implementation:** `publish_jobs` table with all required fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Job ID |
| `file_id` | uuid | Reference to auction_files |
| `asset_group_id` | uuid | Asset group identifier (NEW) |
| `source_item_id` | uuid | Source inventory/lot item (NEW) |
| `status` | text | pending/processing/completed/failed |
| `priority` | int | Job priority (higher = urgent) |
| `retry_count` | int | Current retry attempt |
| `max_retries` | int | Max attempts (default: 5) |
| `run_after` | timestamptz | Backoff scheduling (NEW) |
| `error_message` | text | Last error details |
| `started_at` | timestamptz | Processing start time |
| `completed_at` | timestamptz | Processing end time |
| `created_at` | timestamptz | Job creation time |
| `updated_at` | timestamptz | Last update time |

**Exponential Backoff:**
- Formula: `2^retry_count * 60` seconds
- Retry 1: 2 minutes delay
- Retry 2: 4 minutes delay
- Retry 3: 8 minutes delay
- Retry 4: 16 minutes delay
- Retry 5: 32 minutes delay

**Files:**
- `supabase/migrations/20260207193000_media_publishing_fixes.sql`
- `worker/src/services/database.ts` - Queue polling logic

---

## ⚠️ 3. Reachability Tests

**Status:** NOT TESTED (Cannot test from local environment)

**Required Tests (from actual worker environment):**

```bash
# Test 1: Health Check
curl -v https://raid.ibaproject.bid/health

# Test 2: File Download
curl -v \
  -H "X-Auction-Publisher: ${RAID_PUBLISHER_SECRET}" \
  https://raid.ibaproject.bid/pub/download/{userId}/{storedFilename}
```

**Action Required:**
- Deploy worker to Railway/Render/VPS
- Run tests from that environment
- Verify both endpoints return 200 OK

---

## ✅ 4. Idempotency

**Implementation:** FIXED - Now fully idempotent

**Database Changes:**
- Added `asset_group_id` to `auction_files` table
- Files with same source get same `asset_group_id`
- Worker uses `asset_group_id` for B2 key generation

**B2 Key Structure:**
```
assets/{asset_group_id}/thumb.webp
assets/{asset_group_id}/display.webp
```

**Behavior:**
- Same `asset_group_id` = same B2 keys
- Reruns overwrite existing files (idempotent)
- No duplicate files created
- Database updates use single record per file

**Files:**
- `supabase/migrations/20260207193000_media_publishing_fixes.sql`
- `worker/src/services/storage.ts:48-56` - Upload logic

---

## ✅ 5. B2 Key + CDN Format

**Implementation:** Updated to match spec

**B2 Key Format:**
```
assets/{asset_group_id}/thumb.webp
assets/{asset_group_id}/display.webp
```

**CDN URL Format:**
```
https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/thumb.webp
https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/display.webp
```

**Configuration:**
- `CDN_BASE_URL` env var should be: `https://cdn.ibaproject.bid`
- Worker automatically appends `/file/IBA-Lot-Media/` prefix

**Files:**
- `worker/src/services/storage.ts:33` - CDN URL construction
- `worker/src/services/storage.ts:48-56` - Upload with correct keys

---

## ✅ 6. Video Handling

**Implementation:** V1 is image-only (as specified)

**Behavior:**
- Video files throw error: `"Video processing not yet implemented"`
- Job fails gracefully with clear error message
- Only processes files where `file_type` starts with `'image/'`
- MP4/video support deferred to future version

**Files:**
- `worker/src/services/jobProcessor.ts:38-44` - Video check
- `worker/src/services/imageProcessor.ts:9-11` - MIME type validation

---

## ✅ 7. Cleanup

**Implementation:** Worker-based cleanup with B2 deletion

**Process:**
1. Worker runs cleanup check every 24 hours
2. Queries files where `deleted_at < NOW() - 30 days`
3. Deletes B2 objects first (thumb.webp + display.webp)
4. Deletes database records after B2 success
5. Logs all operations to `media_cleanup_log` table
6. NEVER touches RAID masters

**Safety:**
- B2 deletion MUST succeed before DB deletion
- If B2 fails, DB record preserved for retry
- All operations logged for audit trail
- "Unused" = `deleted_at IS NOT NULL` (no active references)

**Files:**
- `worker/src/services/cleanupProcessor.ts` - Cleanup logic
- `worker/src/index.ts:40-60` - Scheduling (24h interval)
- `supabase/migrations/20260207193500_cleanup_worker_based.sql` - Audit log table

---

## Environment Variables Required

Worker needs these environment variables:

```bash
# Database
DATABASE_URL=postgresql://...

# RAID
RAID_PUBLISHER_SECRET=your-secret-key
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid

# B2 Storage
B2_KEY_ID=your-b2-key-id
B2_APP_KEY=your-b2-app-key
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004

# CDN
CDN_BASE_URL=https://cdn.ibaproject.bid

# Worker Config (optional)
WORKER_POLL_INTERVAL=15000  # 15 seconds
MAX_RETRIES=5
LOG_LEVEL=info
CONCURRENCY=3
```

---

## Next Steps

### Immediate (Before Deployment)
1. **CRITICAL:** Test RAID endpoints from actual worker environment
2. Verify `CDN_BASE_URL` is set correctly
3. Confirm B2 credentials have delete permissions

### Deployment
1. Deploy worker to Railway/Render/VPS
2. Set all environment variables
3. Run `npm install && npm start`
4. Monitor logs for first job processing

### Verification
1. Upload test image via RAID
2. Verify variants appear at CDN URLs
3. Check idempotency: re-run same job, verify no duplicates
4. Test cleanup: soft-delete file, wait 30 days (or adjust for testing)

---

## Questions for Planner Team

1. **CDN_BASE_URL:** Confirm value is `https://cdn.ibaproject.bid` (no trailing slash)
2. **B2 Permissions:** Confirm our B2 credentials can delete objects
3. **RAID Testing:** Can you provide test credentials to verify endpoints?
4. **Cleanup Timing:** 24-hour interval acceptable, or should we adjust?

---

## Deployment Documentation

Created comprehensive deployment guides:

1. **WORKER_DEPLOYMENT_GUIDE.md** - Complete deployment instructions
   - Railway deployment (recommended)
   - Render deployment (alternative)
   - VPS deployment (advanced)
   - Testing procedures
   - Troubleshooting guide
   - Monitoring instructions

2. **DEPLOYMENT_CHECKLIST.md** - Quick-start checklist
   - Pre-deployment credential gathering
   - 10-minute Railway deployment
   - Verification steps
   - Success criteria

---

## Files Changed

### Migrations
- `20260207193000_media_publishing_fixes.sql` - Idempotency + asset_group_id
- `20260207193500_cleanup_worker_based.sql` - Cleanup audit log

### Worker
- `worker/src/services/storage.ts` - B2 format + deletion
- `worker/src/services/database.ts` - Backoff + cleanup queries
- `worker/src/services/jobProcessor.ts` - Uses asset_group_id
- `worker/src/services/cleanupProcessor.ts` - NEW: Cleanup logic
- `worker/src/index.ts` - Cleanup scheduling

### Frontend
- No changes required (database columns are additive)
