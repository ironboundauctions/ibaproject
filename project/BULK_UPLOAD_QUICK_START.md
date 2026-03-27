# Bulk Upload Quick Start

Get the bulk upload system running in 5 steps.

## Step 1: Deploy Analysis Worker to Railway

```bash
cd analysis-worker
npm install
```

1. Go to your existing Railway project (same project as your processing worker)
2. Click "New Service" → "GitHub Repo"
3. Select your repository and set Root Directory to `analysis-worker`
4. Add environment variables (same as your processing worker):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `IRONDRIVE_API_URL`
5. Deploy and copy the public URL

**Result**: Analysis Worker is running alongside your processing worker in the same project

## Step 2: Update Frontend Environment

Add to your `.env` file:

```env
VITE_ANALYSIS_WORKER_URL=https://your-analysis-worker.railway.app
```

Replace `https://your-analysis-worker.railway.app` with the actual Railway URL from Step 1.

**Result**: Frontend can communicate with Analysis Worker

## Step 3: Verify Database Migration

The migration is already applied. Verify with:

```sql
SELECT COUNT(*) FROM batch_analysis_jobs;
```

**Result**: Should return 0 (table exists but is empty)

## Step 4: Build and Deploy

```bash
npm run build
```

Deploy to your hosting platform (Vercel, Netlify, etc.)

**Result**: Frontend is deployed with bulk upload feature

## Step 5: Test the System

1. Log in to your application
2. Navigate to Global Inventory
3. Click the Upload icon (↑) next to any item
4. Select 2-3 test images
5. Click "Upload and Analyze"
6. Wait for AI analysis
7. Review and edit results
8. Click "Confirm and Add to Inventory"

**Expected**: Images appear in the item's gallery within 30-45 seconds

## Verification Checklist

- [ ] Analysis Worker shows "healthy" at `/health` endpoint
- [ ] Frontend can access worker (check browser console)
- [ ] Upload button appears in Global Inventory
- [ ] Files upload successfully
- [ ] Analysis job is created in database
- [ ] AI analysis completes
- [ ] Results appear in modal
- [ ] Confirmation adds files to inventory
- [ ] Files appear in item gallery

## Troubleshooting

**Analysis Worker not accessible?**
```bash
curl https://your-worker.railway.app/health
```
Should return: `{"status":"healthy",...}`

**Jobs not processing?**
```sql
SELECT * FROM batch_analysis_jobs ORDER BY created_at DESC LIMIT 1;
```
Check status - should change from "pending" to "analyzing" to "completed"

**Files not appearing?**
```sql
SELECT COUNT(*) FROM auction_files WHERE item_id = 'your-item-id';
```
Count should increase after upload

## Next Steps

1. Review `docs/BULK_UPLOAD_TESTING_GUIDE.md` for comprehensive testing
2. Monitor Railway logs for Analysis Worker
3. Adjust `MAX_CONCURRENT_JOBS` and `BATCH_SIZE` for your load
4. Set up monitoring and alerts

## Support

See full documentation:
- `analysis-worker/DEPLOYMENT_GUIDE.md` - Detailed deployment steps
- `docs/BULK_UPLOAD_TESTING_GUIDE.md` - Complete testing guide
- `docs/BULK_UPLOAD_IMPLEMENTATION_SUMMARY.md` - System overview

## Configuration Tuning

After initial testing, optimize these settings:

**For faster processing:**
- Increase `MAX_CONCURRENT_JOBS` to 5-10
- Increase `BATCH_SIZE` to 20-50
- Scale Railway service to larger instance

**For cost optimization:**
- Decrease `BATCH_SIZE` to reduce IronDrive API calls
- Increase `POLL_INTERVAL` to 10000ms during low usage
- Use Railway's sleep feature for dev environments

Ready to process hundreds of images at once!
