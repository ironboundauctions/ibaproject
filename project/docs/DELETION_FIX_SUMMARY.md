# File Deletion Fix - March 5, 2026

## Issue Discovered

When testing file deletion, we found that **source.webp files were never being deleted from B2**, even though database records were properly removed. This left 6 orphaned files in the B2 bucket.

### Root Cause

The worker was trying to delete files individually by hardcoded filenames:
```typescript
keys.push(`assets/${assetGroupId}/thumb.webp`);
keys.push(`assets/${assetGroupId}/display.webp`);
keys.push(`assets/${assetGroupId}/source.webp`);  // This was missing initially!
keys.push(`assets/${assetGroupId}/video.mp4`);    // Plus other video extensions
```

**Problems with this approach:**
1. Easy to forget a variant (like we did with `source.webp`)
2. Video files could have any extension - we had to guess
3. Left empty folders in B2
4. Future file types would be missed

## Solution Implemented

**Changed from individual file deletion to folder deletion:**

Instead of guessing filenames, we now:
1. List ALL files in `assets/{assetGroupId}/`
2. Delete everything found

```typescript
async deleteAssetGroup(assetGroupId: string): Promise<void> {
  // List all files in the folder using B2's prefix filter
  const files = await this.listAssetGroupFiles(assetGroupId);

  // Delete everything - no guessing needed!
  await this.s3Client.send(
    new DeleteObjectsCommand({
      Bucket: config.b2.bucket,
      Delete: {
        Objects: files.map(Key => ({ Key })),
        Quiet: false,
      },
    })
  );
}
```

## Benefits

✅ **Complete cleanup** - Deletes ALL files regardless of name/extension
✅ **Future-proof** - Works with any new file types automatically
✅ **No orphans** - Entire folder removed, not just known files
✅ **Simpler code** - No variant parameter needed
✅ **Better logging** - Shows actual files deleted vs attempted

## Files Changed

- `worker/src/services/storage.ts` - Updated `deleteAssetGroup()` method

## Deployment Steps

### 1. Deploy Updated Worker

The deployment package is ready:
```bash
worker-folder-deletion-fix.tar.gz
```

Deploy to Railway using the same process as before (upload and redeploy).

### 2. Clean Up Orphaned Files

After deployment, run the cleanup script:
```bash
./cleanup-6-orphaned-files.sh
```

This will delete the 6 orphaned asset groups:
- `de7f090b-124b-4a44-84d2-6d7bbd0f03e2`
- `2326e6c3-f719-4d62-a168-39ec388cfb48`
- `67725319-24df-46bd-84d2-e53410964bc6`
- `a0e76a7d-4014-40ba-bd75-f1a9ce592fd7`
- `6e5fb8a8-5929-4a86-b949-bfac0e0fcac8`
- `353668cf-baf9-4114-90bf-34761e26100c`

### 3. Verify Cleanup

Check that files are gone:
```bash
curl https://ibaproject-production.up.railway.app/api/check-asset-group/de7f090b-124b-4a44-84d2-6d7bbd0f03e2
```

Should return:
```json
{
  "b2Count": 0,
  "dbCount": 0
}
```

## Testing Checklist

After deployment:

- [ ] Upload a new image via PC upload
- [ ] Verify it appears in IronDrive picker
- [ ] Delete the item from inventory
- [ ] Wait 30 seconds for cleanup job to run
- [ ] Check B2 bucket - folder should be completely gone
- [ ] Check diagnostic endpoint - should show 0 files
- [ ] Verify no orphaned files remain

## Long-term Impact

This fix ensures:
- Future deletions will be complete
- No more manual cleanup needed
- System scales with any file type
- Maintenance burden reduced
