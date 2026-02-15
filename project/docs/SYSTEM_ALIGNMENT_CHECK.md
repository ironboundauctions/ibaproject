# System Alignment Verification Report

**Date:** 2026-02-14
**Status:** ✅ **ALIGNED** - Webapp and Worker Ready to Connect

---

## Executive Summary

✅ **Frontend and worker are properly aligned and ready to work together.**

The webapp correctly implements the authoritative architecture:
- Frontend uploads to RAID, receives `source_key` only (no URLs)
- Frontend inserts source variant → auto-triggers publish job
- Worker polls jobs, downloads from RAID, processes, uploads to B2
- Worker tracks `b2_key` for all variants
- Frontend displays CDN URLs only

**Only configuration verification needed before production (see Critical Items below).**

---

## Data Flow Verification ✅

### 1. Upload Phase (Frontend → RAID)
**File:** `src/services/ironDriveService.ts`

```typescript
// Line 249: Returns source_key only (no URL)
const source_key = `${SERVICE_USER_ID}/${uploadedFile.filename}`;

allFileMetadata.push({
  source_key,           // ✅ Identifier only
  original_name: uploadedFile.originalName,
  mime_type: uploadedFile.mimeType,
  size: uploadedFile.size
  // ✅ No cdn_url, no download_url
});
```

✅ **Correct:** Returns identifiers only, matches authoritative contract

---

### 2. Attach Phase (Frontend → Database)
**File:** `src/services/mediaPublishingService.ts`

```typescript
// Lines 53-75: Creates source variant
const asset_group_id = crypto.randomUUID();  // ✅ Groups variants

const sourceFileData = {
  asset_group_id,                            // ✅ Correct
  variant: 'source',                         // ✅ Correct
  source_key: params.source_key,             // ✅ From RAID picker
  original_name: params.original_name,       // ✅ From RAID picker
  mime_type: params.mime_type || null,
  bytes: params.bytes || null,
  item_id: params.item_id || null,
  published_status: 'pending',               // ✅ Triggers worker
};

await supabase.from('auction_files').insert(sourceFileData);
```

✅ **Correct:** Inserts source variant with pending status

---

### 3. Auto-Trigger (Database → Worker Queue)
**File:** `supabase/migrations/20260214203033_20260214_restore_correct_media_architecture.sql`

```sql
-- Lines 142-165: Auto-creates publish job when source inserted
CREATE OR REPLACE FUNCTION create_publish_job_for_source()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.variant = 'source' THEN
    INSERT INTO publish_jobs (
      file_id,
      asset_group_id,
      status,
      priority
    ) VALUES (
      NEW.id,
      NEW.asset_group_id,
      'pending',
      5
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

✅ **Correct:** Automatically queues job when source variant created

---

### 4. Worker Poll (Worker → Database)
**File:** `worker/src/services/database.ts`

```typescript
// Lines 60-91: Polls for next pending job
async getNextJob(): Promise<PublishJob | null> {
  // Uses FOR UPDATE SKIP LOCKED for concurrency
  const result = await client.query<PublishJob>(
    `UPDATE publish_jobs
     SET status = 'processing',
         started_at = NOW()
     WHERE id = (
       SELECT id FROM publish_jobs
       WHERE status IN ('pending', 'failed')
         AND retry_count < max_retries
         AND run_after <= NOW()
       ORDER BY priority DESC, run_after ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`
  );
}
```

✅ **Correct:** Polls with proper locking, priority, and retry logic

---

### 5. Worker Download (Worker → RAID)
**File:** `worker/src/services/raid.ts`

```typescript
// Lines 5-32: Downloads from RAID with auth
async downloadFile(fileKey: string): Promise<Buffer> {
  const url = `${config.raid.endpoint}/${fileKey}`;  // ⚠️ Must be /pub/download

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Auction-Publisher': config.raid.secret,    // ✅ Correct auth header
    },
  });

  return Buffer.from(await response.arrayBuffer());
}
```

**Configuration Required:**
```bash
# worker/.env or Railway
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download  # ⚠️ MUST include /pub/download
```

✅ **Code Correct:** Uses proper header and endpoint pattern
⚠️ **Config Required:** Verify `RAID_PUB_ENDPOINT` in Railway includes `/pub/download`

---

### 6. Worker Process (Worker → B2)
**File:** `worker/src/services/imageProcessor.ts` + `storage.ts`

```typescript
// storage.ts Lines 43-62: Uploads variants and returns b2_key
async uploadVariants(
  assetGroupId: string,
  thumbBuffer: Buffer,
  displayBuffer: Buffer
): Promise<{ thumbUrl: string; thumbB2Key: string; displayUrl: string; displayB2Key: string }> {
  const thumbKey = `assets/${assetGroupId}/thumb.webp`;      // ✅ B2 object key
  const displayKey = `assets/${assetGroupId}/display.webp`;  // ✅ B2 object key

  const [thumbUrl, displayUrl] = await Promise.all([
    this.uploadFile(thumbKey, thumbBuffer, 'image/webp'),    // ✅ Uploads to B2
    this.uploadFile(displayKey, displayBuffer, 'image/webp'), // ✅ Uploads to B2
  ]);

  return {
    thumbUrl,
    thumbB2Key: thumbKey,      // ✅ Returns b2_key for database
    displayUrl,
    displayB2Key: displayKey,  // ✅ Returns b2_key for database
  };
}
```

✅ **Correct:** Uploads to B2, returns both CDN URL and b2_key

---

### 7. Worker Upsert (Worker → Database)
**File:** `worker/src/services/database.ts`

```typescript
// Lines 140-185: Upserts variant with b2_key
async upsertVariant(
  assetGroupId: string,
  variant: string,
  cdnUrl: string,
  metadata: {
    width?: number;
    height?: number;
    b2Key?: string;  // ✅ Tracks B2 key
  }
): Promise<string> {
  await this.pool.query(
    `INSERT INTO auction_files (
      asset_group_id,
      variant,
      cdn_url,
      b2_key,           -- ✅ Stores b2_key for cleanup
      width,
      height,
      original_name,
      published_status
    ) VALUES ($1, $2, $3, $4, $5, $6, '', 'published')
    ON CONFLICT (asset_group_id, variant)  -- ✅ Idempotency
    DO UPDATE SET
      cdn_url = EXCLUDED.cdn_url,
      b2_key = EXCLUDED.b2_key,            -- ✅ Updates b2_key
      published_status = 'published'
    `,
    [assetGroupId, variant, cdnUrl, metadata.b2Key, metadata.width, metadata.height]
  );
}
```

✅ **Correct:** Uses UNIQUE constraint for idempotency, stores b2_key for future cleanup

---

### 8. Worker Complete (Worker → Database)
**File:** `worker/src/services/database.ts`

```typescript
// Lines 102-138: Marks job completed
async markJobCompleted(jobId: string, fileId: string, ...): Promise<void> {
  await client.query('BEGIN');

  // Mark job completed
  await client.query(
    `UPDATE publish_jobs
     SET status = 'completed',
         completed_at = NOW()
     WHERE id = $1`,
    [jobId]
  );

  // Mark source published
  await client.query(
    `UPDATE auction_files
     SET published_status = 'published'
     WHERE id = $1 AND variant = 'source'`,  // ✅ Updates source variant status
    [fileId]
  );

  await client.query('COMMIT');
}
```

✅ **Correct:** Transactional update, marks job and source variant as published

---

### 9. Frontend Display (Frontend → User)
**File:** `src/services/mediaPublishingService.ts`

```typescript
// Line 179-182: Generates CDN URL from b2_key
getCdnUrl(b2_key: string): string {
  const cdnBase = import.meta.env.VITE_CDN_BASE_URL;  // https://cdn.ibaproject.bid/file/IBA-Lot-Media
  return `${cdnBase}/${b2_key}`;                       // assets/{id}/display.webp
}

// Line 164-177: Gets published variants
async getPublishedVariants(asset_group_id: string): Promise<MediaFile[]> {
  const { data } = await supabase
    .from('auction_files')
    .select('*')
    .eq('asset_group_id', asset_group_id)
    .eq('published_status', 'published')  // ✅ Only published
    .is('detached_at', null);              // ✅ Not soft-deleted

  return data as MediaFile[];
}
```

✅ **Correct:** Frontend displays CDN URLs only, never RAID URLs

---

## Database Schema Verification ✅

**File:** `supabase/migrations/20260214203033_20260214_restore_correct_media_architecture.sql`

### auction_files Table
```sql
CREATE TABLE auction_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id),
  asset_group_id uuid NOT NULL,                    -- ✅ Groups variants
  variant text NOT NULL,                           -- ✅ source|thumb|display|video
  source_key text,                                 -- ✅ RAID path (source only)
  b2_key text,                                     -- ✅ B2 object key (variants)
  cdn_url text,                                    -- ✅ Public CDN URL
  original_name text NOT NULL,
  bytes bigint,
  mime_type text,
  width integer,
  height integer,
  duration_seconds numeric(10, 2),
  published_status text NOT NULL DEFAULT 'pending', -- ✅ Workflow state
  detached_at timestamptz,                         -- ✅ Soft delete (30-day retention)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (asset_group_id, variant)                 -- ✅ Idempotency constraint
);
```

✅ **Correct:** Matches authoritative schema exactly

### publish_jobs Table
```sql
CREATE TABLE publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES auction_files(id),
  asset_group_id uuid NOT NULL,
  status text NOT NULL,                            -- ✅ pending|processing|completed|failed
  priority int NOT NULL DEFAULT 5,
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 5,              -- ✅ Retry logic
  error_message text,
  run_after timestamptz DEFAULT now(),             -- ✅ Exponential backoff support
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

✅ **Correct:** Queue with retry logic and prioritization

---

## Security Verification ✅

### Frontend Environment (Public)
```bash
# .env
VITE_SUPABASE_ANON_KEY=eyJ...          # ✅ Anon key only
VITE_SUPABASE_URL=https://...          # ✅ Public URL
VITE_IRONDRIVE_API=https://...         # ✅ Public endpoint
VITE_CDN_BASE_URL=https://...          # ✅ Public CDN

# ✅ NO SERVICE_ROLE_KEY
# ✅ NO B2 credentials
# ✅ NO RAID publisher secret
```

✅ **Secure:** No secrets in frontend environment

### Worker Environment (Private - Railway)
```bash
# Railway environment variables
DATABASE_URL=postgresql://...           # ✅ Direct database access
RAID_PUBLISHER_SECRET=xxx              # ✅ Server-to-server auth
RAID_PUB_ENDPOINT=.../pub/download     # ⚠️ Verify includes /pub/download
B2_KEY_ID=xxx                          # ✅ B2 credentials
B2_APP_KEY=xxx                         # ✅ B2 credentials
B2_ENDPOINT=s3.us-west-004...          # ⚠️ Verify region
B2_REGION=us-west-004                  # ⚠️ Verify region
CDN_BASE_URL=https://cdn...            # ✅ CDN base for URL construction
```

✅ **Secure:** Secrets server-side only
⚠️ **Requires Verification:** See Critical Items below

### RLS Policies
```sql
-- Public can view published media
CREATE POLICY "Public can view published media"
  ON auction_files FOR SELECT
  TO public
  USING (published_status = 'published' AND detached_at IS NULL);

-- Admins can insert/update/delete
CREATE POLICY "Admins can insert media"
  ON auction_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );
```

✅ **Correct:** Restrictive by default, proper permission checks

---

## Configuration Verification Required ⚠️

### Critical Item #1: B2 Region Must Match Cloudflare 🔴

**Current Configuration:**
```bash
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
```

**Problem:** If Cloudflare CDN points to a different B2 region, CDN URLs will 404.

**Action Required:**
1. Check Cloudflare DNS: `dig cdn.ibaproject.bid CNAME`
2. Check Backblaze bucket region in dashboard
3. If different, update both `.env` and Railway

**Test:**
```bash
# After worker uploads, test CDN access:
curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/test-uuid/display.webp
# Must return 200 OK, not 404
```

---

### Critical Item #2: Railway Must Reach RAID 🔴

**Current Configuration:**
```bash
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download
```

**Problem:** If Railway can't reach RAID, worker cannot download originals.

**Action Required - From Railway Shell:**
```bash
# Test 1: Health check
curl -I https://raid.ibaproject.bid/health
# Expected: 200 OK

# Test 2: Auth check (use real secret)
curl -I -H "X-Auction-Publisher: REAL_SECRET" \
  https://raid.ibaproject.bid/pub/download/test/test
# Expected: 404 (not 401) = auth works, file doesn't exist

# Test 3: Real download (use actual source_key from database)
curl -I -H "X-Auction-Publisher: REAL_SECRET" \
  https://raid.ibaproject.bid/pub/download/REAL_SOURCE_KEY
# Expected: 200 OK
```

**If Fails:**
- 401 = Wrong `RAID_PUBLISHER_SECRET`
- Timeout/DNS = Railway can't reach RAID (firewall/routing)
- 403 = RAID blocking Railway IPs

---

### Critical Item #3: RAID_PUB_ENDPOINT Path 🔴

**Critical Note from Planner Team:**
> "Ignore any `/download` in health JSON - only `/pub/download` is valid endpoint"

**Verify Worker Configuration:**
```bash
# Railway environment must be:
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download

# NOT:
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid          # ❌ Wrong
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/download # ❌ Wrong (old endpoint)
```

**Worker Code Expectation:**
```typescript
// raid.ts line 6
const url = `${config.raid.endpoint}/${fileKey}`;
// With fileKey = "e9478d39.../image.jpg"
// Must construct: https://raid.ibaproject.bid/pub/download/e9478d39.../image.jpg
```

✅ **Code Correct:** Worker uses `${endpoint}/${fileKey}` pattern
⚠️ **Verify Config:** Railway `RAID_PUB_ENDPOINT` must include `/pub/download`

---

## End-to-End Test Plan ✅

**After configuring Railway, run this complete test:**

### 1. Upload to RAID
- Admin panel → Upload image to IronDrive
- Note the filename

### 2. Attach to Item
- Create/edit inventory item
- Click "Pick from IronDrive"
- Select uploaded image
- Save

### 3. Verify Database
```sql
-- Check source created
SELECT * FROM auction_files WHERE variant = 'source' ORDER BY created_at DESC LIMIT 1;
-- Should show: published_status = 'pending'

-- Check job created
SELECT * FROM publish_jobs ORDER BY created_at DESC LIMIT 1;
-- Should show: status = 'pending'

-- Note the asset_group_id
```

### 4. Wait for Worker (15-30 seconds)
```sql
-- Check job completed
SELECT * FROM publish_jobs WHERE id = 'JOB_ID' LIMIT 1;
-- Should show: status = 'completed'

-- Check variants created
SELECT variant, cdn_url, b2_key, published_status
FROM auction_files
WHERE asset_group_id = 'ASSET_GROUP_ID'
ORDER BY variant;
-- Should show 3 rows:
--   variant='source',  published_status='published', b2_key=null
--   variant='thumb',   published_status='published', b2_key='assets/.../thumb.webp'
--   variant='display', published_status='published', b2_key='assets/.../display.webp'
```

### 5. Test CDN URLs
```bash
# Copy display.webp cdn_url from above
curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{id}/display.webp
# Expected: 200 OK, content-type: image/webp

# Open in browser - should display image
```

### 6. Verify Frontend
- View item in public auction interface
- Image should display using CDN URL
- Right-click → Copy Image Address
- Verify URL is `cdn.ibaproject.bid` (not `raid.ibaproject.bid`)

---

## Railway Environment Checklist

Copy these exact values to Railway Dashboard → Worker Service → Variables:

```bash
# Database (from Supabase project settings → Database → Connection string)
DATABASE_URL=postgresql://postgres.sbhdjnchafboizbnqsmp:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# RAID (get RAID_PUBLISHER_SECRET from RAID server admin)
RAID_PUBLISHER_SECRET=<from_raid_server_AUCTION_PUBLISHER_SECRET>
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download

# B2 Storage (from Backblaze dashboard → App Keys)
B2_KEY_ID=<from_backblaze>
B2_APP_KEY=<from_backblaze>
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com  # ⚠️ VERIFY REGION
B2_REGION=us-west-004                        # ⚠️ VERIFY REGION

# CDN
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media

# Worker Settings (optional)
WORKER_POLL_INTERVAL=15000
MAX_RETRIES=5
LOG_LEVEL=info
CONCURRENCY=1
```

---

## Alignment Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend Upload | ✅ | Returns source_key only |
| Frontend Attach | ✅ | Creates source variant + triggers job |
| Database Schema | ✅ | Matches authoritative design |
| Auto Trigger | ✅ | Creates publish_job on source insert |
| Worker Poll | ✅ | Proper locking and retry logic |
| Worker Download | ✅ | Uses correct header and pattern |
| Worker Process | ✅ | Creates thumb + display variants |
| Worker Upload | ✅ | Uploads to B2, returns b2_key |
| Worker Upsert | ✅ | Stores b2_key with cdn_url |
| Worker Complete | ✅ | Marks job and source published |
| Frontend Display | ✅ | Shows CDN URLs only |
| Security | ✅ | No secrets in frontend |
| RLS Policies | ✅ | Restrictive, admin-only writes |

---

## Final Status

**Architecture:** ✅ Correct and aligned with authoritative guide
**Implementation:** ✅ All code ready to work together
**Security:** ✅ Proper separation of concerns
**Configuration:** ⚠️ Requires verification (3 items above)

**Estimated Time to Production:** 30 minutes (config verification + smoke test)

**Recommendation:** Proceed with Railway configuration verification, then run end-to-end test.
