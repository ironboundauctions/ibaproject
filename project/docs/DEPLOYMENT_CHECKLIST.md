# Quick Deployment Checklist

## Before You Start

### ✅ Gather These Credentials

- [ ] **Database URL** - Copy from your main `.env` file
  ```
  DATABASE_URL=postgresql://postgres.xxx...
  ```

- [ ] **RAID Secret** - Contact IBA RAID administrator
  ```
  RAID_PUBLISHER_SECRET=xxx
  ```

- [ ] **B2 Credentials** - Get from Backblaze dashboard
  ```
  B2_KEY_ID=xxx
  B2_APP_KEY=xxx
  ```

- [ ] **CDN URL** - Verify this works
  ```
  CDN_BASE_URL=https://cdn.ibaproject.bid
  ```

---

## Deployment Steps (Railway - 10 minutes)

### 1. Commit Worker Code
```bash
cd /path/to/your/project
git add worker/
git commit -m "Add media publishing worker"
git push
```

### 2. Create Railway Project
- Go to https://railway.app
- Sign in with GitHub
- Click "New Project" → "Deploy from GitHub repo"
- Select your repository

### 3. Configure Railway
**Settings Tab:**
- Root Directory: `worker`
- Start Command: `npm start`

**Variables Tab:**
Paste all your environment variables:
```bash
DATABASE_URL=...
RAID_PUBLISHER_SECRET=...
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid
B2_KEY_ID=...
B2_APP_KEY=...
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
CDN_BASE_URL=https://cdn.ibaproject.bid
WORKER_POLL_INTERVAL=15000
MAX_RETRIES=5
LOG_LEVEL=info
CONCURRENCY=3
```

### 4. Deploy
- Click "Deploy"
- Wait 2-3 minutes
- Check logs for: `INFO: Starting Media Publishing Worker`

### 5. Test RAID (In Railway Terminal)
```bash
curl -v https://raid.ibaproject.bid/health
```
Should return `200 OK`

### 6. Test with Real Data
**Upload an image in your app, then check database:**
```sql
SELECT id, file_name, publish_status, thumb_url
FROM auction_files
ORDER BY created_at DESC
LIMIT 1;
```

After ~30 seconds, `publish_status` should be `'published'` and `thumb_url` should be populated!

### 7. Verify CDN
Copy the `thumb_url` and open in browser. Should display the image!

---

## Quick Tests

### Test 1: Worker is Running
**Expected log output:**
```
INFO: Starting Media Publishing Worker
INFO: Running initial cleanup
```

### Test 2: RAID is Reachable
```bash
curl https://raid.ibaproject.bid/health
```
**Expected:** `200 OK`

### Test 3: Job Processing
**Check database:**
```sql
SELECT status, COUNT(*) FROM publish_jobs GROUP BY status;
```
**Expected:** Jobs should move from `pending` → `processing` → `completed`

### Test 4: Files on CDN
**Open in browser:**
```
https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{uuid}/thumb.webp
```
**Expected:** Image displays

---

## Common Issues

### ❌ Worker won't start
**Error:** `Error: connect ECONNREFUSED`
**Fix:** Check `DATABASE_URL` is correct

### ❌ RAID connection fails
**Error:** `Failed to download from RAID`
**Fix:**
1. Verify `RAID_PUBLISHER_SECRET`
2. Test: `curl https://raid.ibaproject.bid/health`

### ❌ B2 upload fails
**Error:** `File upload failed`
**Fix:** Verify B2 credentials in Backblaze dashboard

### ❌ Jobs stuck in processing
**Fix:** Reset them:
```sql
UPDATE publish_jobs
SET status = 'pending', started_at = NULL
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '30 minutes';
```

---

## Success Criteria

✅ Worker logs show: `INFO: Starting Media Publishing Worker`
✅ RAID health check returns `200 OK`
✅ Test image processes successfully
✅ `thumb_url` and `display_url` populated in database
✅ Images accessible at CDN URLs
✅ No errors in worker logs for 1 hour

---

## What Happens Next?

**Automatically:**
- Worker polls every 15 seconds for new jobs
- Processes images to WebP (thumb + display variants)
- Uploads to B2 storage
- Updates database with CDN URLs
- Retries failed jobs with exponential backoff
- Runs cleanup every 24 hours (deletes files older than 30 days)

**You can:**
- Monitor logs in Railway dashboard
- Check job status in database
- Scale up by increasing `CONCURRENCY`
- Deploy multiple workers for higher throughput

---

## Need Help?

See **WORKER_DEPLOYMENT_GUIDE.md** for detailed troubleshooting!
