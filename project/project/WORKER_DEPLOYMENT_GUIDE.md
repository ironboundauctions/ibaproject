# Worker Deployment Guide

## Step-by-Step Deployment to Railway (Recommended)

### Why Railway?
- Easy Node.js deployment
- Free tier available ($5/month credit)
- Great for background workers
- Simple environment variable management

---

## Option 1: Deploy to Railway (Easiest)

### Step 1: Prepare Your Repository

1. **Ensure worker files are committed to git:**
   ```bash
   git add worker/
   git commit -m "Add media publishing worker"
   git push
   ```

2. **Create Railway account:**
   - Go to https://railway.app
   - Sign up with GitHub

### Step 2: Create New Project

1. **In Railway Dashboard:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect it's a Node.js project

### Step 3: Configure Worker Settings

1. **Set Root Directory:**
   - Go to project Settings
   - Under "Build", set **Root Directory** to: `worker`
   - Set **Start Command** to: `npm start`

2. **Set Environment Variables:**

   Click "Variables" tab and add these:

   ```bash
   # Database (copy from your main .env file)
   DATABASE_URL=postgresql://postgres.xxx...

   # RAID (you'll need these from IBA RAID system)
   RAID_PUBLISHER_SECRET=your-secret-key-here
   RAID_PUB_ENDPOINT=https://raid.ibaproject.bid

   # B2 Storage (you'll need these from Backblaze)
   B2_KEY_ID=your-b2-key-id
   B2_APP_KEY=your-b2-app-key
   B2_BUCKET=IBA-Lot-Media
   B2_ENDPOINT=s3.us-west-004.backblazeb2.com
   B2_REGION=us-west-004

   # CDN
   CDN_BASE_URL=https://cdn.ibaproject.bid

   # Worker Config (optional - these are defaults)
   WORKER_POLL_INTERVAL=15000
   MAX_RETRIES=5
   LOG_LEVEL=info
   CONCURRENCY=3
   ```

3. **Deploy:**
   - Railway will automatically deploy
   - Watch the logs for any errors

### Step 4: Test RAID Connectivity

Once deployed, open Railway's "Terminal" feature and run:

```bash
# Test 1: Health Check
curl -v https://raid.ibaproject.bid/health

# Test 2: Download Test (replace with real values)
curl -v \
  -H "X-Auction-Publisher: ${RAID_PUBLISHER_SECRET}" \
  "https://raid.ibaproject.bid/pub/download/{userId}/{filename}"
```

**Expected Results:**
- Health check should return: `200 OK` with response body
- Download should return: `200 OK` with file data

---

## Option 2: Deploy to Render (Alternative)

### Step 1: Prepare Repository
Same as Railway - commit and push to GitHub

### Step 2: Create New Web Service

1. **In Render Dashboard:**
   - Go to https://render.com
   - Click "New +" → "Background Worker"
   - Connect your GitHub repository

### Step 3: Configure Service

1. **Settings:**
   - Name: `media-publishing-worker`
   - Region: `Oregon (US West)` or closest to your DB
   - Branch: `main`
   - Root Directory: `worker`
   - Build Command: `npm install`
   - Start Command: `npm start`

2. **Environment Variables:**
   Add the same variables as Railway (see above)

3. **Deploy:**
   - Click "Create Background Worker"
   - Monitor logs for startup

### Step 4: Test RAID
Use Render's Shell access to run the same curl tests as above

---

## Option 3: Deploy to VPS (Advanced)

If you have a VPS (DigitalOcean, Linode, AWS EC2, etc.):

### Step 1: SSH into your server
```bash
ssh user@your-server-ip
```

### Step 2: Install Node.js
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v20.x
```

### Step 3: Clone and Setup
```bash
# Clone your repo
git clone https://github.com/your-username/your-repo.git
cd your-repo/worker

# Install dependencies
npm install

# Create .env file
nano .env
```

Paste your environment variables:
```bash
DATABASE_URL=postgresql://...
RAID_PUBLISHER_SECRET=...
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid
B2_KEY_ID=...
B2_APP_KEY=...
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
CDN_BASE_URL=https://cdn.ibaproject.bid
```

### Step 4: Run with PM2 (Production Process Manager)
```bash
# Install PM2
sudo npm install -g pm2

# Start worker
pm2 start npm --name "media-worker" -- start

# Setup auto-restart on server reboot
pm2 startup
pm2 save

# Monitor logs
pm2 logs media-worker
```

### Step 5: Test RAID
Run curl tests directly on the VPS:
```bash
curl -v https://raid.ibaproject.bid/health
```

---

## Post-Deployment: Verify Everything Works

### 1. Check Worker Logs

Look for these startup messages:
```
INFO: Starting Media Publishing Worker
INFO: Running initial cleanup
INFO: Worker loop started
```

### 2. Test End-to-End Flow

**A. Upload a Test Image:**

From your main app, upload an image to IronDrive. The system should:
1. Create record in `auction_files` table (status: `pending`)
2. Create job in `publish_jobs` table

**B. Check Database:**
```sql
-- Check if job was created
SELECT * FROM publish_jobs ORDER BY created_at DESC LIMIT 5;

-- Check file status
SELECT id, file_name, publish_status, thumb_url, display_url
FROM auction_files
ORDER BY created_at DESC LIMIT 5;
```

**C. Watch Worker Logs:**

You should see:
```
INFO: Processing job {jobId}
INFO: File details {fileKey}
INFO: File uploaded successfully {thumbUrl}
INFO: Job completed successfully
```

**D. Verify CDN URLs:**

Copy the `thumb_url` from database and paste in browser:
```
https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{uuid}/thumb.webp
```

Should display the thumbnail image!

### 3. Test Idempotency

**Run the same job twice:**

```sql
-- Re-insert the same job (simulating re-run)
INSERT INTO publish_jobs (file_id, status, priority)
SELECT id, 'pending', 1
FROM auction_files
WHERE id = 'your-file-id-here';
```

Worker should:
- Process the job again
- Overwrite B2 files (same keys)
- Update database (not create duplicates)

Check B2 dashboard - should only see 2 files per asset_group_id:
- `assets/{uuid}/thumb.webp`
- `assets/{uuid}/display.webp`

---

## Troubleshooting

### Issue: Worker won't start

**Check logs for:**
```
Error: connect ECONNREFUSED
```
**Fix:** Database URL is wrong. Verify `DATABASE_URL` in env vars.

---

### Issue: "File not found" errors

**Check logs for:**
```
Error: Failed to download from RAID
```

**Debug steps:**
1. Test RAID health endpoint:
   ```bash
   curl https://raid.ibaproject.bid/health
   ```

2. Verify `RAID_PUBLISHER_SECRET` is correct

3. Check `file_key` in database matches IronDrive format:
   ```sql
   SELECT file_key FROM auction_files WHERE id = 'failing-job-id';
   ```

---

### Issue: B2 upload fails

**Check logs for:**
```
Error: File upload failed
```

**Debug steps:**
1. Verify B2 credentials:
   ```bash
   # Test with AWS CLI (if installed)
   aws s3 ls s3://IBA-Lot-Media \
     --endpoint-url https://s3.us-west-004.backblazeb2.com
   ```

2. Check B2 bucket name exactly matches: `IBA-Lot-Media`

3. Verify B2 key has upload permissions in Backblaze dashboard

---

### Issue: Jobs stuck in "processing"

**Symptoms:** Jobs show `status = 'processing'` but never complete

**Cause:** Worker crashed mid-job

**Fix:** Reset stuck jobs:
```sql
UPDATE publish_jobs
SET status = 'pending',
    retry_count = retry_count + 1,
    started_at = NULL
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '30 minutes';
```

---

## Monitoring & Maintenance

### Daily Checks

1. **View recent jobs:**
   ```sql
   SELECT status, COUNT(*)
   FROM publish_jobs
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY status;
   ```

2. **Check failed jobs:**
   ```sql
   SELECT id, file_id, error_message, retry_count
   FROM publish_jobs
   WHERE status = 'failed'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. **Monitor cleanup:**
   ```sql
   SELECT COUNT(*) as cleaned_files,
          MAX(cleaned_at) as last_cleanup
   FROM media_cleanup_log;
   ```

### Scale Up (if needed)

**If jobs are backing up:**

1. **Increase concurrency:**
   - Set `CONCURRENCY=5` (or higher) in environment variables
   - Restart worker

2. **Deploy multiple workers:**
   - Railway/Render: Create additional instances
   - They'll safely compete for jobs (PostgreSQL locking prevents duplicates)

---

## Getting Missing Credentials

### RAID_PUBLISHER_SECRET

**Contact:** IBA RAID system administrator
**Ask for:** Publisher API secret for media publishing
**Format:** Long random string (like: `abc123def456...`)

### B2 Credentials

**Get from Backblaze B2:**

1. Log into https://www.backblaze.com/b2/cloud-storage.html
2. Go to "App Keys" section
3. Create new key with permissions:
   - `listBuckets`
   - `listFiles`
   - `readFiles`
   - `writeFiles`
   - `deleteFiles`
4. Copy:
   - `keyID` → `B2_KEY_ID`
   - `applicationKey` → `B2_APP_KEY`

### CDN_BASE_URL

**Should be:** `https://cdn.ibaproject.bid`

**Verify it works:**
```bash
curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/
```

Should return `200 OK` or `403 Forbidden` (not `404 Not Found`)

---

## Next Steps After Deployment

1. ✅ Worker deployed and running
2. ✅ RAID connectivity tested
3. ✅ End-to-end test completed
4. ✅ CDN URLs accessible

**Now:**
- Update frontend to display `thumb_url` and `display_url` from database
- Monitor worker logs for 24 hours
- Check cleanup runs successfully after 24 hours
- Test with production data

---

## Need Help?

**Check these first:**
1. Worker logs (most issues show up here)
2. Database `publish_jobs.error_message` column
3. RAID health endpoint
4. B2 bucket in Backblaze dashboard

**Still stuck?**
- Share worker logs (last 50 lines)
- Share failing job details from database
- Share RAID curl test results
