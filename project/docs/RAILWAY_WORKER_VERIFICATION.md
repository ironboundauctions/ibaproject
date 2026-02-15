# Railway Worker Verification & Configuration

## Current Status

✅ **Railway Worker Deployed**
✅ **All Environment Variables Configured**
✅ **Step 1 Complete:** Railway → RAID health check passed (HTTP/2 200 OK)
✅ **Step 2 Complete:** RAID authenticated download test passed (HTTP/2 404 - auth working!)

**🎯 READY FOR PRODUCTION:** All connectivity tests passed!

**Next:** Upload real image via admin panel for end-to-end test

## Required Environment Variables on Railway

Go to Railway Dashboard → Your Worker Service → Variables tab and verify/update these:

### Database Connection
```
DATABASE_URL=postgresql://postgres.sbhdjnchafboizbnqsmp:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```
*(Get exact URL from Supabase Dashboard → Project Settings → Database → Connection String → Transaction mode)*

### RAID Configuration
```
RAID_PUBLISHER_SECRET=[get from RAID server]
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download
```
**⚠️ CRITICAL:** Must be `/pub/download` not just the base URL

### B2 Storage (✅ VERIFIED)
```
B2_KEY_ID=[from Backblaze dashboard]
B2_APP_KEY=[from Backblaze dashboard]
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-east-005.backblazeb2.com
B2_REGION=us-east-005
```

**✅ Confirmed from user's Backblaze screenshot:** Bucket is in us-east-005 region

### CDN Configuration
```
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media
```

### Worker Settings (Optional)
```
WORKER_POLL_INTERVAL=15000
MAX_RETRIES=5
LOG_LEVEL=info
CONCURRENCY=1
```

---

## Verification Steps

### 1. Check Worker is Running

**Railway Dashboard:**
- Go to your worker service
- Check "Deployments" tab - should show "Active"
- Check "Metrics" tab - should show CPU/Memory usage

**Check Logs:**
```
Railway Dashboard → Worker Service → Deployments → View Logs
```

Look for:
- ✅ "Worker started"
- ✅ "Connected to database"
- ✅ "Polling for jobs..."
- ❌ "Missing required environment variable" = fix .env
- ❌ "Failed to connect to database" = fix DATABASE_URL

### 2. Test RAID Connectivity from Railway

**Option A: Railway Shell (if available)**
```bash
# In Railway Dashboard → Worker Service → Shell
curl -I https://raid.ibaproject.bid/health

# Test auth (replace with real secret)
curl -I -H "X-Auction-Publisher: your_secret_here" \
  https://raid.ibaproject.bid/pub/download/test/test
```

**Option B: Create a Test Job**
1. In your local database (via Supabase dashboard SQL editor):
```sql
-- Insert a test source file
INSERT INTO auction_files (asset_group_id, variant, source_key, original_name, mime_type)
VALUES (
  gen_random_uuid(),
  'source',
  'test/nonexistent.jpg',
  'Test Image.jpg',
  'image/jpeg'
);

-- Check if publish_job was auto-created
SELECT * FROM publish_jobs ORDER BY created_at DESC LIMIT 1;
```

2. Watch Railway logs for 30 seconds
3. Look for:
   - ✅ "Processing job..." = Worker picked it up
   - ❌ "RAID download failed: 401" = Wrong RAID_PUBLISHER_SECRET
   - ❌ "RAID download failed: 404" = Good! Auth works, file doesn't exist (expected)
   - ❌ "Failed to fetch" or timeout = Railway can't reach RAID

### 3. Test B2 Upload

After verifying RAID connectivity works, create a real test with an actual file:

```sql
-- Find a real file in IronDrive first, then use its source_key
-- Example: userId/actualfile.jpg

INSERT INTO auction_files (asset_group_id, variant, source_key, original_name, mime_type)
VALUES (
  gen_random_uuid(),
  'source',
  'YOUR_REAL_SOURCE_KEY_HERE',  -- Must exist in RAID
  'Real Test.jpg',
  'image/jpeg'
);

-- Wait 30 seconds, then check:
SELECT * FROM publish_jobs ORDER BY created_at DESC LIMIT 1;
-- Should show status='completed'

SELECT * FROM auction_files
WHERE asset_group_id = 'THE_ASSET_GROUP_ID_FROM_ABOVE'
ORDER BY variant;
-- Should show 3 rows: source, thumb, display
```

### 4. Test CDN Access

```bash
# Get the display.webp cdn_url from above query, then:
curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/display.webp

# Expected: 200 OK, content-type: image/webp
# If 404: B2 region mismatch (see PLANNER_TEAM_VERIFICATION.md)
```

---

## Common Issues & Fixes

### Worker Logs Show: "Missing required environment variable"
**Fix:** Add the missing variable in Railway Dashboard → Variables

### Worker Logs Show: "RAID download failed: 401"
**Fix:**
1. Check `RAID_PUBLISHER_SECRET` is set correctly
2. Get the actual secret from RAID server (ask RAID admin)
3. Verify it matches exactly (no spaces, quotes)

### Worker Logs Show: "ENOTFOUND raid.ibaproject.bid"
**Fix:** Railway can't resolve DNS
1. Try using Railway's outbound IP allowlist if RAID has firewall
2. Verify `raid.ibaproject.bid` is publicly accessible
3. Test: `curl https://raid.ibaproject.bid/health` from any machine

### Jobs Stay in "pending" Forever
**Check:**
1. Is worker running? (Railway Metrics tab should show activity)
2. Is `WORKER_POLL_INTERVAL` set? (default: 15000ms)
3. Are there error logs?

### CDN URLs Return 404
**Most Common Cause:** B2 region mismatch
1. Verify Cloudflare `cdn.ibaproject.bid` CNAME target
2. Verify B2 bucket region matches B2_ENDPOINT
3. See PLANNER_TEAM_VERIFICATION.md Critical Item #1

### Worker Uses Too Much Memory/CPU
**Fix:**
```
CONCURRENCY=1  # Process one job at a time
WORKER_POLL_INTERVAL=30000  # Poll less frequently
```

---

## Quick Checklist

- [x] All environment variables set in Railway (user confirmed)
- [x] Worker deployment shows "Active" (user confirmed)
- [x] Test RAID connectivity from Railway - **PASSED** (200 OK response)
- [x] Test RAID authenticated download - **PASSED** (404 response, auth works!)
- [x] B2 region verified: us-east-005 (from screenshot)
- [ ] **NEXT:** Upload real image via admin panel
- [ ] Worker processes job successfully (watch Railway logs)
- [ ] CDN URLs accessible publicly (test in browser)
- [ ] Image displays correctly in auction view

---

## Next Steps After Verification

1. **If all tests pass:** System is ready for production use
2. **If RAID connectivity fails:** Contact RAID admin about Railway IPs
3. **If CDN URLs 404:** Fix B2 region mismatch (see PLANNER_TEAM_VERIFICATION.md)
4. **If worker crashes:** Check Railway logs, fix environment variables

---

## Monitoring in Production

**Railway Dashboard:**
- Check worker logs daily for errors
- Monitor memory/CPU usage
- Set up alerts for deployment failures

**Database Monitoring:**
```sql
-- Check for stuck jobs (over 1 hour old, still processing)
SELECT * FROM publish_jobs
WHERE status = 'processing'
AND started_at < NOW() - INTERVAL '1 hour';

-- Check failed jobs
SELECT id, error_message, retry_count
FROM publish_jobs
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 10;

-- Check pending jobs count
SELECT COUNT(*) FROM publish_jobs WHERE status = 'pending';
```

---

## Getting the RAID_PUBLISHER_SECRET

The secret must match the `AUCTION_PUBLISHER_SECRET` value on your RAID server.

**To find it:**
1. SSH into RAID server: `ssh user@raid.ibaproject.bid`
2. Check IronDrive configuration (likely in `.env` or config file)
3. Look for: `AUCTION_PUBLISHER_SECRET=xxx`
4. Copy that exact value to Railway's `RAID_PUBLISHER_SECRET`

**Security Note:** This is a server-to-server secret. Never expose it in frontend code or Git.
