# Real Image End-to-End Test Plan

**Date:** February 14, 2026
**Status:** Ready for Execution
**System:** Media Publishing with RAID Integration

---

## Pre-Test Confirmations ✅

All three confirmations from planner team have been validated:

1. **RAID URL Construction**: `RAID_PUB_ENDPOINT + "/" + source_key` ✅
   - Confirmed in `worker/src/services/raid.ts:6`
   - Uses direct concatenation: `${config.raid.endpoint}/${fileKey}`

2. **Image Variant Sizes**: 400px thumb / 1600px display ✅
   - Confirmed in `worker/src/services/imageProcessor.ts`
   - Documentation updated to match implementation

3. **Environment Variable Names**: `RAID_PUB_ENDPOINT` matches across all systems ✅
   - Worker code: `requireEnv('RAID_PUB_ENDPOINT')`
   - Railway env: `RAID_PUB_ENDPOINT` set correctly

---

## Test Objective

Verify complete end-to-end workflow:
1. Upload real image file to RAID via IronDrive picker
2. Attach file to lot/auction in our system
3. Worker downloads from RAID automatically
4. Worker generates 400px thumb + 1600px display (WebP)
5. Worker uploads both variants to B2 storage
6. Worker updates database with CDN URLs
7. Frontend displays image from CDN with RAID fallback

---

## System Architecture

```
IronDrive Picker → RAID Storage
       ↓
   Database Record (source_key stored)
       ↓
   Auto-created publish_job (via trigger)
       ↓
   Railway Worker (polls every 15 seconds)
       ↓
   Download from: RAID_PUB_ENDPOINT/{source_key}
       ↓
   Process: Sharp → 400px thumb + 1600px display
       ↓
   Upload to: B2 → CDN URLs
       ↓
   Update Database: thumb_url, display_url, publish_status='published'
       ↓
   Frontend: MediaImage component displays from CDN
```

---

## Test Environment

### Railway Worker Status
- **Service**: media-worker
- **Status**: Should be running and polling
- **Poll Interval**: 15 seconds
- **Concurrency**: 3 jobs at once
- **Max Retries**: 5 attempts per job

### Environment Variables (Railway)
```
DATABASE_URL=postgresql://postgres.sbhdjnchafboizbnqsmp:***@db.sbhdjnchafboizbnqsmp.supabase.co:5432/postgres
RAID_PUBLISHER_SECRET=AqjbEb6TAvejA2o7eSXXv2J6gf8mlDk9WUg1cJvZZvnnRcG/SfME/Cyu+oHLr0m6
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download
B2_KEY_ID=005c92d7eb30ed70000000003
B2_APP_KEY=K005oIdG4RFnenPK5IU33SrIw+ymN1E
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media
```

### Supabase Edge Functions
- `lot-media-attach`: Deployed ✅
- `lot-media-detach`: Deployed ✅
- `lot-media-status`: Deployed ✅

---

## Step-by-Step Test Procedure

### Step 1: Upload Image to RAID (via IronDrive Picker)

**Action:**
1. Open IronBound admin panel
2. Navigate to any lot/auction edit screen
3. Click "Add Media" or similar button
4. Use IronDrive picker to select/upload an image
5. Note the `source_key` returned (format: `userId/filename.jpg`)

**Expected Result:**
- IronDrive picker returns success
- You receive a `source_key` like: `abc123def/test-image.jpg`

**Verification:**
```sql
-- This step doesn't create DB records yet
-- Just capture the source_key for next step
```

---

### Step 2: Attach File to System (Create DB Record)

**Action Option A (Frontend):**
Use the inventory/lot management UI to attach the file

**Action Option B (Direct SQL):**
```sql
-- Insert test record
INSERT INTO auction_files (
  file_key,
  file_name,
  file_type,
  file_size,
  lot_id,
  auction_id,
  publish_status
) VALUES (
  'YOUR_SOURCE_KEY_HERE',  -- e.g., 'abc123def/test-image.jpg'
  'test-image.jpg',
  'image/jpeg',
  500000,  -- approximate size in bytes
  'YOUR_LOT_UUID',  -- or NULL if testing without lot
  'YOUR_AUCTION_UUID',  -- or NULL if testing without auction
  'pending'
) RETURNING id, file_key, publish_status;
```

**Expected Result:**
- Database record created in `auction_files`
- Automatic trigger creates record in `publish_jobs` with status='pending'

**Verification:**
```sql
-- Check auction_files record
SELECT id, file_key, file_name, publish_status, thumb_url, display_url
FROM auction_files
WHERE file_key = 'YOUR_SOURCE_KEY_HERE';

-- Check publish_jobs record (auto-created by trigger)
SELECT j.id, j.status, j.priority, j.retry_count, j.created_at,
       f.file_key, f.file_name
FROM publish_jobs j
JOIN auction_files f ON j.file_id = f.id
WHERE f.file_key = 'YOUR_SOURCE_KEY_HERE';
```

**Success Criteria:**
- ✅ auction_files record exists
- ✅ publish_jobs record exists with status='pending'
- ✅ No errors in database

---

### Step 3: Worker Picks Up Job (Automatic - Wait 15-30 seconds)

**Action:**
- Wait for worker to poll and pick up the job
- Monitor Railway logs in real-time

**Expected Railway Logs:**
```
[INFO] Polling for pending jobs...
[INFO] Found 1 pending job(s)
[INFO] Processing job: <job-uuid>
[DEBUG] Downloading file from RAID { fileKey: 'abc123def/test-image.jpg', url: 'https://raid.ibaproject.bid/pub/download/abc123def/test-image.jpg' }
[INFO] Downloaded file from RAID { fileKey: 'abc123def/test-image.jpg', size: 524288 }
[INFO] Starting image processing { fileKey: 'abc123def/test-image.jpg' }
[INFO] Created thumbnail { size: 45120, width: 400, height: 300, format: 'webp' }
[INFO] Created display variant { size: 256000, width: 1600, height: 1200, format: 'webp' }
[INFO] Uploading variants to B2...
[INFO] Uploaded to B2 { key: 'assets/<uuid>/thumb.webp', size: 45120 }
[INFO] Uploaded to B2 { key: 'assets/<uuid>/display.webp', size: 256000 }
[INFO] Updating database with CDN URLs...
[INFO] Job completed successfully { jobId: '<job-uuid>', duration: 8543 }
```

**Verification During Processing:**
```sql
-- Should show status='processing'
SELECT status, started_at, retry_count
FROM publish_jobs
WHERE file_id = (
  SELECT id FROM auction_files WHERE file_key = 'YOUR_SOURCE_KEY_HERE'
);
```

**Success Criteria:**
- ✅ Railway logs show job picked up
- ✅ No authentication errors from RAID
- ✅ File downloads successfully
- ✅ Image processing completes
- ✅ Both variants upload to B2
- ✅ Database updated

---

### Step 4: Verify Database Updates

**Action:**
Run verification queries after worker completes (logs show "Job completed successfully")

**Queries:**
```sql
-- Check auction_files record was updated
SELECT
  id,
  file_key,
  file_name,
  publish_status,  -- Should be 'published'
  thumb_url,       -- Should start with https://cdn.ibaproject.bid
  display_url,     -- Should start with https://cdn.ibaproject.bid
  cdn_key_prefix,  -- Should be 'assets/<uuid>'
  published_at     -- Should have timestamp
FROM auction_files
WHERE file_key = 'YOUR_SOURCE_KEY_HERE';

-- Check publish_jobs completed
SELECT
  status,          -- Should be 'completed'
  retry_count,     -- Should be 0
  error_message,   -- Should be NULL
  started_at,
  completed_at,
  completed_at - started_at AS duration  -- Should be ~5-15 seconds
FROM publish_jobs
WHERE file_id = (
  SELECT id FROM auction_files WHERE file_key = 'YOUR_SOURCE_KEY_HERE'
);
```

**Expected Results:**
- **publish_status**: `'published'`
- **thumb_url**: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/<uuid>/thumb.webp`
- **display_url**: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/<uuid>/display.webp`
- **cdn_key_prefix**: `assets/<uuid>`
- **published_at**: Recent timestamp
- **Job status**: `'completed'`
- **Job error_message**: `NULL`

**Success Criteria:**
- ✅ All URLs populated
- ✅ Status is 'published'
- ✅ Job completed without errors
- ✅ Processing took < 30 seconds

---

### Step 5: Test CDN URLs Directly

**Action:**
Copy the CDN URLs from database and test in browser/curl

**Browser Test:**
1. Open new browser tab
2. Paste thumbnail URL: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/<uuid>/thumb.webp`
3. Should see 400px optimized image
4. Paste display URL: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/<uuid>/display.webp`
5. Should see 1600px optimized image

**Curl Test:**
```bash
# Test thumbnail
curl -I "https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/<uuid>/thumb.webp"

# Expected response:
# HTTP/2 200
# content-type: image/webp
# content-length: ~30000-80000 (30-80 KB)

# Test display
curl -I "https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/<uuid>/display.webp"

# Expected response:
# HTTP/2 200
# content-type: image/webp
# content-length: ~150000-400000 (150-400 KB)
```

**Expected Results:**
- ✅ HTTP 200 status
- ✅ Content-Type: image/webp
- ✅ Thumbnail ~30-80 KB
- ✅ Display ~150-400 KB
- ✅ Images display correctly in browser

**Success Criteria:**
- ✅ Both URLs return 200
- ✅ Images are WebP format
- ✅ File sizes are appropriate
- ✅ Images display with good quality

---

### Step 6: Test Frontend Integration

**Action:**
1. Navigate to lot/auction detail page in frontend
2. The MediaImage component should automatically use CDN URLs
3. Verify in browser DevTools Network tab

**Frontend Component Usage:**
```tsx
<MediaImage
  thumbUrl={file.thumb_url}
  displayUrl={file.display_url}
  raidUrl={file.file_key}
  alt={file.file_name}
  variant="thumb"
  publishStatus={file.publish_status}
  className="w-full h-64 object-cover"
/>
```

**DevTools Verification:**
1. Open Chrome DevTools → Network tab
2. Filter by "webp" or "cdn.ibaproject.bid"
3. Should see requests to CDN URLs
4. Status should be 200
5. Size should match thumbnail variant (~30-80 KB)

**Expected Results:**
- ✅ Image displays on page
- ✅ Network tab shows CDN URL request
- ✅ Status 200
- ✅ Fast load time (< 500ms)
- ✅ No RAID requests (unless fallback triggered)

**Success Criteria:**
- ✅ Image visible and sharp
- ✅ CDN serving content
- ✅ No console errors
- ✅ No fallback to RAID needed

---

### Step 7: Test Fallback Mechanism (Optional)

**Action:**
Simulate CDN failure to verify RAID fallback works

**Test Method:**
1. Temporarily break CDN URL in database:
   ```sql
   UPDATE auction_files
   SET thumb_url = 'https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/INVALID/thumb.webp'
   WHERE file_key = 'YOUR_SOURCE_KEY_HERE';
   ```

2. Refresh frontend page
3. MediaImage component should detect CDN failure
4. Should automatically fall back to RAID URL

**Expected Results:**
- ✅ Image still displays (from RAID)
- ✅ Console shows fallback message
- ✅ Network tab shows RAID URL request
- ✅ No broken image placeholder

**Cleanup:**
```sql
-- Restore correct CDN URL
UPDATE auction_files
SET thumb_url = 'https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/<correct-uuid>/thumb.webp'
WHERE file_key = 'YOUR_SOURCE_KEY_HERE';
```

---

## Success Checklist

Complete workflow verified when:

- [ ] Image uploaded to RAID successfully
- [ ] Database record created in auction_files
- [ ] Database trigger created publish_job automatically
- [ ] Railway worker picked up job within 30 seconds
- [ ] Worker downloaded from RAID without auth errors
- [ ] Worker generated 400px thumbnail (~30-80 KB)
- [ ] Worker generated 1600px display (~150-400 KB)
- [ ] Worker uploaded both variants to B2
- [ ] Database updated with CDN URLs
- [ ] publish_status = 'published'
- [ ] Job status = 'completed'
- [ ] Thumbnail CDN URL returns HTTP 200
- [ ] Display CDN URL returns HTTP 200
- [ ] Frontend displays image from CDN
- [ ] No errors in Railway logs
- [ ] No errors in Supabase logs
- [ ] Total processing time < 30 seconds

---

## Troubleshooting Guide

### Issue: Worker doesn't pick up job

**Check:**
```sql
SELECT * FROM publish_jobs WHERE status = 'pending' LIMIT 5;
```

**Solutions:**
1. Verify Railway worker is running
2. Check DATABASE_URL env var is correct
3. Look for errors in Railway logs
4. Restart worker service

---

### Issue: RAID download fails

**Check Railway Logs For:**
- `RAID download failed: 401` → Check RAID_PUBLISHER_SECRET
- `RAID download failed: 404` → Check source_key format
- `RAID download failed: 500` → RAID server issue

**Solutions:**
1. Verify RAID_PUB_ENDPOINT is correct
2. Verify RAID_PUBLISHER_SECRET matches
3. Test RAID URL manually with curl:
   ```bash
   curl -H "X-Auction-Publisher: YOUR_SECRET" \
     "https://raid.ibaproject.bid/pub/download/userId/filename.jpg"
   ```

---

### Issue: Image processing fails

**Check Railway Logs For:**
- `Out of memory` → Increase worker memory
- `Unsupported format` → Check file is valid image
- `Sharp error` → Check image isn't corrupted

**Solutions:**
1. Increase Railway worker RAM allocation
2. Verify source image is valid
3. Check sharp package is installed

---

### Issue: B2 upload fails

**Check Railway Logs For:**
- `403 Forbidden` → Check B2 key permissions
- `404 Not Found` → Check bucket name
- `Connection timeout` → Network issue

**Solutions:**
1. Verify B2_KEY_ID and B2_APP_KEY are correct
2. Check B2 key has write permissions
3. Verify B2_BUCKET name matches exactly
4. Test B2 connection manually

---

### Issue: CDN URLs don't work

**Check:**
1. Verify URLs in database are correct format
2. Test URLs in browser directly
3. Check B2 bucket is publicly accessible
4. Verify CloudFlare CDN is configured

**Solutions:**
1. Check bucket permissions in B2 dashboard
2. Verify CDN_BASE_URL is correct
3. Test direct B2 URL (before CDN)
4. Check CloudFlare settings

---

### Issue: Frontend doesn't display images

**Check:**
1. Console for errors
2. Network tab for failed requests
3. Component props passed correctly
4. publish_status is 'published'

**Solutions:**
1. Verify MediaImage component is used
2. Check props match database columns
3. Verify CDN URLs are accessible
4. Test RAID fallback URL

---

## Monitoring Queries

### Active Jobs
```sql
SELECT
  j.status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(j.completed_at, NOW()) - j.started_at))) as avg_duration_seconds
FROM publish_jobs j
WHERE j.created_at > NOW() - INTERVAL '1 hour'
GROUP BY j.status;
```

### Recent Completions
```sql
SELECT
  f.file_name,
  j.status,
  EXTRACT(EPOCH FROM (j.completed_at - j.started_at)) as duration_seconds,
  j.error_message
FROM publish_jobs j
JOIN auction_files f ON j.file_id = f.id
WHERE j.completed_at > NOW() - INTERVAL '1 hour'
ORDER BY j.completed_at DESC
LIMIT 10;
```

### Publishing Status Summary
```sql
SELECT
  publish_status,
  COUNT(*) as count
FROM auction_files
WHERE deleted_at IS NULL
GROUP BY publish_status;
```

---

## Next Steps After Successful Test

1. ✅ Document test results
2. ✅ Verify all metrics meet expectations
3. ✅ Enable for production use
4. 📊 Monitor for 24 hours
5. 🎉 System ready for live auction media

---

**Prepared by:** Implementation Team
**Last Updated:** February 14, 2026
**Status:** Ready for Execution
