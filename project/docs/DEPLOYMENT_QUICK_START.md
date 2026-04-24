# Quick Start: Deploy Folder Deletion Fix

## What Changed?

The worker now deletes **entire folders** instead of individual files. This prevents orphaned files from being left behind.

## Deploy in 3 Steps

### Step 1: Deploy Updated Worker

1. Download `worker-folder-deletion-fix.tar.gz`
2. Go to Railway dashboard → Worker service
3. Click "Deploy" → Upload the tarball
4. Wait for deployment to complete

### Step 2: Clean Up Orphaned Files

Run the cleanup script:
```bash
./cleanup-6-orphaned-files.sh
```

Or manually for each asset group:
```bash
curl -X POST https://ibaproject-production.up.railway.app/api/delete-asset-group \
  -H "Content-Type: application/json" \
  -d '{"assetGroupId": "de7f090b-124b-4a44-84d2-6d7bbd0f03e2"}'
```

Repeat for all 6 orphaned asset group IDs (see script for full list).

### Step 3: Verify It Worked

Check the first asset group:
```bash
curl https://ibaproject-production.up.railway.app/api/check-asset-group/de7f090b-124b-4a44-84d2-6d7bbd0f03e2
```

Expected result:
```json
{
  "assetGroupId": "de7f090b-124b-4a44-84d2-6d7bbd0f03e2",
  "filesInB2": [],
  "filesInDB": [],
  "b2Count": 0,
  "dbCount": 0
}
```

## Test the Fix

1. Upload a new image via PC upload
2. Delete the inventory item
3. Wait 30 seconds
4. Check B2 - entire folder should be gone
5. No orphaned files!

## Rollback (if needed)

If something goes wrong, redeploy the previous version:
- `worker-deployment.tar.gz` (original)
- Or `worker-deployment-fixed.tar.gz` (previous fix)

## Files Included

- `worker-folder-deletion-fix.tar.gz` - Updated worker code
- `cleanup-6-orphaned-files.sh` - Cleanup script for existing orphans
- `DELETION_FIX_SUMMARY.md` - Detailed explanation
- `BEFORE_AFTER_COMPARISON.md` - Visual comparison
- `worker/FOLDER_DELETION_FIX.md` - Technical documentation

## Need Help?

Check the logs in Railway dashboard:
- Look for "Deleting entire asset group folder from B2"
- Should show "filesFound", "deleted", and "errors"
- Errors will be visible (no longer hidden)

## Success Criteria

✅ Worker deploys without errors
✅ All 6 orphaned files deleted
✅ New uploads work correctly
✅ Deletions remove entire folders
✅ No orphaned files remain in B2
