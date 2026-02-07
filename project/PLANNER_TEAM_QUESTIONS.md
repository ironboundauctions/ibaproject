# Questions for Planner Team - Media Publishing System

## Critical Questions Before Deployment

### 1. Worker Runtime Environment

**Question:** Is the worker running in Supabase Edge Functions, or in a Node.js server environment?

- If **Node.js:** Where will it run (Railway/Render/VPS)?
- How is it scheduled to poll every 15-60 seconds?
- Do you prefer a continuously running process or cron-triggered?

---

### 2. Queue Table Specification

**Question:** Does the `publish_jobs` table match this spec?

```sql
CREATE TABLE publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES auction_files(id),
  status text CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority int DEFAULT 0,
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 5,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);
```

**Required features:**
- Enforces max retry attempts (5)
- Tracks retry count and errors
- Has status field for state management

**Confirm:** Is this table already created, or do we need to create it?

---

### 3. RAID Reachability Tests

**Question:** From the actual worker environment (Railway/Render/wherever it will run), can you test these endpoints and confirm they succeed?

**Test 1: Health Check**
```bash
curl -v https://raid.ibaproject.bid/health
```
**Expected:** `200 OK` with response body

**Test 2: Download with Auth**
```bash
curl -v \
  -H "X-Auction-Publisher: ${RAID_PUBLISHER_SECRET}" \
  "https://raid.ibaproject.bid/pub/download/{userId}/{storedFilename}"
```
**Expected:** `200 OK` with file data (binary content)

**Critical:** These tests MUST run from the worker's production environment (not local dev machine), because network/firewall rules may differ.

---

### 4. Idempotency Guarantee

**Question:** Is there a unique constraint on the `auction_files` table to prevent duplicates?

**Required constraint:**
```sql
CREATE UNIQUE INDEX idx_auction_files_asset_variant
ON auction_files(asset_group_id, variant);
```

**And using UPSERT pattern:**
```sql
INSERT INTO auction_files (asset_group_id, variant, ...)
VALUES (?, ?, ...)
ON CONFLICT (asset_group_id, variant)
DO UPDATE SET ...
```

**Confirm:**
- Does `auction_files` have this unique constraint?
- Will worker use UPSERT to ensure reruns overwrite (not duplicate)?

---

### 5. B2 Key Format and CDN URL Structure

**Question:** Confirm the exact B2 object key format and CDN URL structure:

**B2 Object Key:**
```
assets/{asset_group_id}/thumb.webp
assets/{asset_group_id}/display.webp
```

**CDN Public URL:**
```
https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/thumb.webp
https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/display.webp
```

**Critical:** Must include `/file/` in the path.

**Test this URL format:**
```bash
curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/
```
**Expected:** `200 OK` or `403 Forbidden` (NOT `404 Not Found`)

**Confirm:**
- Is `/file/` required in CDN URLs?
- Is the bucket name `IBA-Lot-Media` correct?
- Does CDN support public reads?

---

### 6. Video Handling (v1 Scope)

**Question:** Confirm v1 video handling requirements:

**v1 Should:**
- Download MP4 from RAID
- Upload MP4 to B2 as-is (no transcoding)
- Extract basic metadata (duration, dimensions)
- Create placeholder thumbnail (optional)

**v1 Should NOT:**
- Transcode video to different formats
- Generate video thumbnails from frames
- Process video in any way

**Confirm:** Is this the correct scope for v1?

---

### 7. Cleanup Logic and Safety

**Question:** Confirm cleanup behavior to ensure we NEVER delete RAID masters:

**Cleanup Should:**
- Delete B2 objects older than 30 days
- Delete database rows for those objects
- Only delete "unused" files (no active `auction_files` references)

**Cleanup Should NEVER:**
- Touch RAID storage
- Delete source files from IronDrive
- Delete files with active references

**Definition of "unused":**
- File has `detached_at IS NOT NULL` (explicitly detached from lot)
- File has no other active references
- File is older than 30 days

**Confirm:**
- Is 30 days the correct retention period?
- Is this definition of "unused" correct?
- Cleanup runs every 24 hours acceptable?

---

## Required Credentials

To proceed with deployment, we need:

1. **RAID_PUBLISHER_SECRET** - API key for RAID downloads
2. **B2_KEY_ID** - Backblaze B2 key ID
3. **B2_APP_KEY** - Backblaze B2 application key
4. **DATABASE_URL** - PostgreSQL connection string (we have this)
5. **CDN_BASE_URL** - Confirm exact URL format

---

## Deployment Blockers

**Cannot deploy until we have:**

- [ ] Worker environment decided (Node.js on Railway/Render, or Edge Function)
- [ ] RAID connectivity tested from worker environment
- [ ] `publish_jobs` table created and verified
- [ ] B2 credentials with delete permissions
- [ ] CDN URL format confirmed and tested
- [ ] Idempotency constraint added to `auction_files`

---

## Next Steps After Answers

Once you provide these answers, we can:

1. Finalize worker deployment target
2. Run connectivity tests from production environment
3. Deploy worker with correct configuration
4. Verify end-to-end flow with test data
5. Monitor for 24 hours before full rollout

---

## Contact for Testing

**When ready to test:**
- Share worker logs (first 50 lines after startup)
- Share RAID test results from worker environment
- Share sample `file_key` from `auction_files` table
- We'll verify end-to-end flow together
