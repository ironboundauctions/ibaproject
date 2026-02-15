# Final End-to-End Test Instructions

**Status:** ✅ All connectivity tests passed! Ready for production test.

---

## What We've Verified

1. ✅ Railway worker is deployed and running
2. ✅ All environment variables configured correctly
3. ✅ Railway can reach RAID server (health check: 200 OK)
4. ✅ Railway can authenticate to RAID (download test: 404 - auth works!)
5. ✅ B2 bucket region confirmed: us-east-005

---

## Final Test: Upload Real Image

### Step 1: Open Admin Panel

1. Navigate to your application
2. Login as admin
3. Go to **Global Inventory Management**

### Step 2: Upload Test Image

1. Click **"Add New Item"** or **"Upload Image"**
2. Choose a test image (JPEG or PNG, ideally 1-5 MB)
3. Fill in required fields:
   - Title: "Test Image"
   - Description: "Testing worker processing"
   - Any other required fields
4. Click **Save** or **Upload**

### Step 3: Monitor Railway Logs

**Immediately after upload:**

1. Open Railway Dashboard
2. Go to Worker Service → Deployments → View Logs
3. Watch for these messages (should appear within 15-30 seconds):

```
[INFO] Polling for pending jobs...
[INFO] Found 1 pending jobs
[INFO] Processing job xxx...
[INFO] Downloading from RAID: https://raid.ibaproject.bid/pub/download/assets/...
[INFO] Downloaded X.X MB in X.Xs
[INFO] Generating thumbnail (max 800px)...
[INFO] Generated thumbnail: XX KB
[INFO] Generating display variant (max 2000px)...
[INFO] Generated display: XXX KB
[INFO] Uploading to B2: assets/{id}/thumb.webp
[INFO] Upload successful: thumb.webp
[INFO] Uploading to B2: assets/{id}/display.webp
[INFO] Upload successful: display.webp
[INFO] Job completed successfully in X.Xs
```

### Step 4: Verify in Database

Open Supabase Dashboard → SQL Editor:

```sql
-- Check the most recent files
SELECT
  id,
  asset_group_id,
  variant,
  published_status,
  b2_key,
  cdn_url,
  file_size_bytes,
  created_at
FROM auction_files
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC, variant;
```

**Expected Results:**

You should see **3 rows** with the same `asset_group_id`:

1. **source variant:**
   - `published_status`: `published`
   - `b2_key`: `null` (stays on RAID)
   - `cdn_url`: `null`

2. **thumb variant:**
   - `published_status`: `published`
   - `b2_key`: `assets/{id}/thumb.webp`
   - `cdn_url`: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{id}/thumb.webp`
   - `file_size_bytes`: ~50,000-100,000 (50-100 KB)

3. **display variant:**
   - `published_status`: `published`
   - `b2_key`: `assets/{id}/display.webp`
   - `cdn_url`: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{id}/display.webp`
   - `file_size_bytes`: ~200,000-500,000 (200-500 KB)

### Step 5: Test CDN URL in Browser

1. Copy the `cdn_url` from the **display** variant
2. Open a new browser tab
3. Paste the URL
4. Press Enter

**Expected:** Image displays correctly

**URL format:** `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{id}/display.webp`

### Step 6: Verify in Public Auction View

1. Navigate to the public auction interface
2. Find the inventory item you just created
3. Verify:
   - ✅ Thumbnail loads quickly (from CDN)
   - ✅ Click to view full image
   - ✅ Display variant shows (from CDN)
   - ✅ Check browser DevTools → Network tab
   - ✅ Images loaded from `cdn.ibaproject.bid`, NOT `raid.ibaproject.bid`

---

## Success Criteria

The system is working correctly when:

1. ✅ Worker processes job within 30 seconds of upload
2. ✅ Railway logs show successful completion (no errors)
3. ✅ Database shows 3 variants (source, thumb, display)
4. ✅ Thumbnail is ~50-100 KB (efficiently compressed)
5. ✅ Display variant is ~200-500 KB (good quality, reasonable size)
6. ✅ CDN URLs load in browser (<500ms)
7. ✅ Images display correctly in public auction interface
8. ✅ No failed jobs in database

---

## What to Do If Something Goes Wrong

### Worker processes job but CDN URL returns 404

**Cause:** B2 files uploaded but CDN can't find them

**Fix:**
1. Check Cloudflare DNS for `cdn.ibaproject.bid`
2. Should be CNAME pointing to: `IBA-Lot-Media.s3.us-east-005.backblazeb2.com`
3. Verify B2 bucket name is exactly `IBA-Lot-Media`
4. Check B2 bucket files exist (login to Backblaze → Browse Files)

### Worker logs show "Failed to upload to B2"

**Cause:** B2 credentials or endpoint issue

**Fix:**
1. Verify `B2_KEY_ID` and `B2_APP_KEY` in Railway
2. Verify `B2_REGION=us-east-005` (not west-004)
3. Verify `B2_ENDPOINT=s3.us-east-005.backblazeb2.com`
4. Check B2 bucket permissions (should be Public)

### Job stays "pending" or "processing" forever

**Cause:** Worker encountered error but didn't fail properly

**Fix:**
```sql
-- Check for error message
SELECT id, status, error_message, retry_count, started_at
FROM publish_jobs
WHERE status IN ('pending', 'processing')
ORDER BY created_at DESC;

-- Reset stuck job to retry
UPDATE publish_jobs
SET status = 'pending', retry_count = 0
WHERE id = 'JOB_ID_HERE';
```

### Images upload but thumbnails are too large

**Cause:** Worker image processing settings

**Expected sizes:**
- Thumbnail: 50-100 KB (800px max)
- Display: 200-500 KB (2000px max)

Both should be WebP format for optimal compression.

---

## After Successful Test

Once the test passes completely:

1. ✅ System is production-ready
2. ✅ No further configuration needed
3. ✅ All future uploads will process automatically

### Recommended: Set Up Monitoring

**Check daily:**
```sql
-- Failed jobs in last 24 hours
SELECT COUNT(*) as failed_count
FROM publish_jobs
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours';

-- Average processing time
SELECT
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
FROM publish_jobs
WHERE status = 'completed'
AND created_at > NOW() - INTERVAL '24 hours';
```

**Railway alerts:**
- Set up email/Slack notifications for worker crashes
- Monitor memory/CPU usage trends
- Set up uptime monitoring for Railway worker

---

## Ready to Test?

1. Open your admin panel
2. Upload a test image
3. Watch Railway logs
4. Verify in database
5. Test CDN URL in browser
6. Check public auction interface

**Good luck! The system should work perfectly based on all successful connectivity tests.**
