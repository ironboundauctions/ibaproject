# Fresh Test Setup - Complete Cleanup

This guide will help you completely wipe all test data and start fresh to properly test the deletion fix.

## Step 1: Clean B2 Bucket (Manual)

Delete all files in the B2 bucket using the cleanup script:
```bash
./cleanup-6-orphaned-files.sh
```

Or manually delete the 6 asset group folders in B2:
- `assets/de7f090b-124b-4a44-84d2-6d7bbd0f03e2/`
- `assets/2326e6c3-f719-4d62-a168-39ec388cfb48/`
- `assets/67725319-24df-46bd-84ed-e53410964bc6/`
- `assets/a0e76a7d-4014-40ba-bd75-f1a9ce592fd7/`
- `assets/6e5fb8a8-5929-4a86-b949-bfac0e0fcac8/`
- `assets/353668cf-baf9-4114-90bf-34761e26100c/`

## Step 2: Clean Database

Database is already clean (all counts are 0).

To verify:
```sql
SELECT COUNT(*) FROM inventory_items;
SELECT COUNT(*) FROM auction_files;
SELECT COUNT(*) FROM publish_jobs;
```

All should return 0.

## Step 3: Deploy Updated Worker

1. Upload `worker-folder-deletion-fix.tar.gz` to Railway
2. Wait for deployment
3. Check logs for "Deleting entire asset group folder from B2"

## Step 4: Fresh Test

1. Upload new item with image
2. Verify files created in B2 (should be 3: source, thumb, display)
3. Delete the item
4. Wait 30 seconds
5. Verify ALL files removed from B2 (folder should not exist)

## Success = No orphaned files!
