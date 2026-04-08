# B2 Bucket Cleanup Feature

## Overview
Added a new B2 Bucket Cleanup tool that scans Backblaze B2 storage for orphaned files that no longer have corresponding database records. This helps identify and remove files that were left behind when database records were deleted.

## Implementation

### Frontend Component
**File:** `src/components/B2BucketCleanup.tsx`

A new React component that provides:
- Scan B2 bucket for all asset groups
- Compare B2 asset groups against database records
- Display orphaned files with details (key, size, last modified)
- Bulk delete orphaned files from B2
- Visual statistics showing:
  - Total B2 asset groups
  - Total database asset groups
  - Number of orphaned files
  - Estimated wasted storage space

### Worker Endpoints
**File:** `worker/src/index.ts`

Added two new API endpoints:

1. **POST /api/scan-orphaned-b2-files**
   - Scans B2 bucket for all asset groups
   - Queries database for all asset groups
   - Compares and identifies orphaned files
   - Returns detailed report with statistics

2. **POST /api/cleanup-orphaned-b2-files**
   - Accepts array of file keys to delete
   - Deletes files from B2 storage
   - Returns count of deleted and failed deletions

### Worker Services

**File:** `worker/src/services/storage.ts`
- Added `listAllAssetGroups()` method
- Scans entire B2 bucket with pagination
- Extracts asset group IDs from file paths
- Supports both old format (assets/{assetGroupId}/) and new format (assets/{itemId}/{assetGroupId}/)
- Returns array of unique asset groups with metadata

**File:** `worker/src/services/database.ts`
- Added `getAllAssetGroups()` method
- Queries all distinct asset group IDs from auction_files table
- Returns sorted list for efficient comparison

### Integration
**File:** `src/components/AdminPanel.tsx`
- Added B2BucketCleanup component to the "Recently Removed" tab
- Appears below OrphanedRecordsCleanup component
- Available to admin users

## Usage

1. Navigate to Admin Panel → Recently Removed tab
2. Scroll to "B2 Bucket Cleanup" section
3. Click "Scan B2 Bucket" to analyze storage
4. Review the orphaned files report
5. Click "Delete All Orphaned Files" to clean up (with confirmation)

## How It Works

1. **Scan Process:**
   - Lists all files in B2 bucket under `assets/` prefix
   - Extracts unique asset group IDs from file paths
   - Queries database for all asset groups in auction_files table
   - Identifies asset groups in B2 that don't exist in database

2. **Cleanup Process:**
   - Takes list of file keys to delete
   - Iterates through each file
   - Deletes from B2 using S3 DeleteObjectCommand
   - Reports success/failure counts

## Benefits

- Identifies wasted storage space
- Removes orphaned files automatically
- Prevents storage costs from abandoned files
- Provides detailed statistics and reporting
- Safe deletion with confirmation prompts

## Safety Features

- Dry-run scan before deletion (no files deleted during scan)
- Confirmation prompt before deletion
- Detailed reporting of success/failures
- Only deletes files explicitly selected
- Does not touch database records (only B2 files)

## Notes

- The scanner handles both old and new B2 path formats
- Supports pagination for large buckets
- Asset group ID extraction uses UUID pattern matching
- Scan results show estimated storage savings
- Worker uses existing S3-compatible B2 client
