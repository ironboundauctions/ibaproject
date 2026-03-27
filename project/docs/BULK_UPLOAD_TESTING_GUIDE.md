# Bulk Upload Testing Guide

This guide explains how to test the complete bulk upload and analysis system.

## Prerequisites

1. Analysis Worker deployed to Railway
2. Processing Worker deployed and running
3. IronDrive API configured
4. Supabase database with all migrations applied
5. Frontend application running

## System Architecture Overview

```
[User Browser]
    ↓ Select files
[BulkUploadModal]
    ↓ Upload files
[Processing Worker] /api/bulk-upload
    ↓ Process & store in temp/
[B2 Storage] temp/{asset-group-id}/source.webp
    ↓ Create analysis job
[Supabase] batch_analysis_jobs table
    ↓ Poll for jobs
[Analysis Worker]
    ↓ Call IronDrive API
[IronDrive] AI Analysis
    ↓ Update job results
[Supabase] batch_analysis_jobs updated
    ↓ Real-time subscription
[BulkUploadModal] Show results
    ↓ User confirms
[Processing Worker] /api/bulk-process
    ↓ Move from temp/ to assets/
[B2 Storage] assets/{item-id}/{asset-group-id}/
    ↓ Create database records
[Supabase] auction_files table
```

## Test Case 1: Single Image Upload

### Steps:
1. Log in to the application
2. Navigate to Global Inventory
3. Click the Upload icon (↑) next to any inventory item
4. Select 1 image file
5. Click "Upload and Analyze"

### Expected Results:
- File uploads to temp storage
- Analysis job created with status "pending"
- Analysis Worker picks up job
- Status changes to "analyzing"
- IronDrive analyzes the image
- Status changes to "completed"
- Modal shows analysis results (title, description, category, tags)
- You can edit the results
- Click "Confirm and Add to Inventory"
- File moves to permanent storage
- Database record created
- Modal shows "Upload Complete!"
- Item's image count increments

### Verification:
```sql
-- Check the analysis job
SELECT * FROM batch_analysis_jobs
ORDER BY created_at DESC
LIMIT 1;

-- Check the file was added
SELECT * FROM auction_files
WHERE item_id = 'your-item-id'
ORDER BY created_at DESC;
```

## Test Case 2: Bulk Upload (10 Images)

### Steps:
1. Navigate to Global Inventory
2. Click Upload icon next to an item
3. Select 10 image files at once
4. Click "Upload and Analyze"

### Expected Results:
- All 10 files upload to temp storage
- Analysis job created with total_files = 10
- Worker processes in batches (default batch_size = 10)
- Progress bar updates as files are analyzed
- All 10 results appear in confirmation screen
- Each can be individually edited
- Confirm adds all 10 to inventory
- All files appear in the item's gallery

### Performance Expectations:
- Upload time: ~5-10 seconds for 10 images
- Analysis time: Depends on IronDrive API
  - Sequential: ~2-3 seconds per image = 20-30 seconds
  - Batched: Should be faster
- Total time: ~30-45 seconds for complete flow

## Test Case 3: Large Batch (50+ Images)

### Steps:
1. Select 50+ image files
2. Upload and analyze

### Expected Results:
- Files upload in chunks
- Analysis processes in batches of 10
- Progress bar shows accurate progress
- No timeout errors
- All files successfully added

### Monitoring:
Watch the Analysis Worker logs:
```bash
curl https://your-worker.railway.app/status
```

Should show:
```json
{
  "activeJobs": 1,
  "maxConcurrentJobs": 3,
  "pollInterval": 5000,
  "batchSize": 10
}
```

## Test Case 4: Error Handling

### Test 4a: Non-Image Files
1. Select a PDF or text file
2. Attempt to upload

**Expected**: File is filtered out with message "Some files were skipped - only images are allowed"

### Test 4b: IronDrive API Failure
1. Temporarily disable IronDrive API
2. Upload images

**Expected**:
- Job status changes to "failed"
- Error message displayed
- Temp files remain (for retry)
- User can cancel to cleanup

### Test 4c: Network Interruption
1. Upload files
2. Disable network during analysis
3. Re-enable network

**Expected**:
- Job remains in analyzing state
- Worker retries automatically
- Job eventually completes or fails

### Test 4d: Cancel During Analysis
1. Upload images
2. Click Cancel while analyzing

**Expected**:
- Modal closes
- Temp files are cleaned up
- Job remains in database for audit

## Test Case 5: Concurrent Users

### Steps:
1. Two users simultaneously upload to different items
2. Both should process without interference

### Expected Results:
- Each job processes independently
- No cross-contamination of files
- Both complete successfully

## Test Case 6: Edit Analysis Results

### Steps:
1. Upload images and wait for analysis
2. Edit the title, description, category, tags
3. Confirm

### Expected Results:
- Edited values are saved
- Database records reflect edits
- Original AI analysis is replaced

## Database Verification Queries

### Check Recent Analysis Jobs
```sql
SELECT
  id,
  status,
  total_files,
  processed_files,
  created_at,
  completed_at
FROM batch_analysis_jobs
ORDER BY created_at DESC
LIMIT 10;
```

### Check Job Results
```sql
SELECT
  results
FROM batch_analysis_jobs
WHERE id = 'your-job-id';
```

### Check Uploaded Files
```sql
SELECT
  variant,
  cdn_url,
  b2_key,
  published_status,
  display_order
FROM auction_files
WHERE item_id = 'your-item-id'
ORDER BY display_order, created_at;
```

### Verify Temp Files Cleaned
```sql
-- Should return no results after successful upload
SELECT * FROM auction_files
WHERE b2_key LIKE 'temp/%'
AND detached_at IS NULL;
```

## Performance Benchmarks

### Target Metrics:
- Upload 10 images: < 10 seconds
- Analyze 10 images: < 30 seconds
- Total flow (10 images): < 45 seconds
- Upload 50 images: < 30 seconds
- Analyze 50 images: < 2 minutes
- Total flow (50 images): < 3 minutes

### Monitoring:
```sql
-- Average processing time
SELECT
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds,
  COUNT(*) as job_count
FROM batch_analysis_jobs
WHERE status = 'completed';
```

## Troubleshooting

### Issue: Files Not Uploading
**Check:**
- Processing Worker is running and accessible
- Network connectivity
- File size limits

**Logs:**
```bash
# Check Processing Worker logs
curl https://your-worker.railway.app/health
```

### Issue: Analysis Not Starting
**Check:**
- Analysis Worker is running
- Database has the job record
- Job status is "pending"

**Fix:**
```sql
-- Manually retry a failed job
UPDATE batch_analysis_jobs
SET status = 'pending', error_message = NULL
WHERE id = 'your-job-id';
```

### Issue: Files Stuck in Temp
**Check:**
```sql
SELECT * FROM auction_files
WHERE b2_key LIKE 'temp/%';
```

**Cleanup:**
```bash
# Call the cleanup endpoint
curl -X POST https://your-worker.railway.app/api/delete-asset-group \
  -H "Content-Type: application/json" \
  -d '{"assetGroupId": "temp/asset-group-id"}'
```

## Success Criteria

All tests pass when:
- ✅ Single image upload completes in < 15 seconds
- ✅ Bulk upload (10) completes in < 45 seconds
- ✅ Bulk upload (50) completes in < 3 minutes
- ✅ Error handling works correctly
- ✅ Concurrent users don't interfere
- ✅ Edited results are saved correctly
- ✅ Temp files are cleaned up
- ✅ Database records are accurate
- ✅ Files appear in item gallery
- ✅ No orphaned records remain

## Next Steps

After successful testing:
1. Monitor production usage for 1 week
2. Adjust `MAX_CONCURRENT_JOBS` based on load
3. Optimize `BATCH_SIZE` for IronDrive performance
4. Consider caching strategies for repeated uploads
5. Implement analytics to track usage patterns
