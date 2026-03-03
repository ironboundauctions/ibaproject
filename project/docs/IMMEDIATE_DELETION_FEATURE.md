# Immediate Permanent Deletion Feature

## Overview

Added immediate permanent deletion functionality that allows admins to bypass the 30-day waiting period and immediately delete files from both the B2 bucket and database.

## What Was Changed

### 1. Frontend Service (`src/services/storageService.ts`)

Added `deleteAssetGroup()` method that:
- Calls the worker's deletion endpoint
- Passes the asset group ID
- Handles authentication
- Returns success/error status

### 2. Worker API Endpoint (`worker/src/index.ts`)

Added `POST /api/delete-asset-group` endpoint that:
- Accepts `assetGroupId` in request body
- Validates the asset group has no active references (not attached to items)
- Deletes all variants from B2 bucket (thumb, display, source, video)
- Deletes all related database records
- Returns deletion count and success status

### 3. Worker Database Service (`worker/src/services/database.ts`)

Added `getFilesByAssetGroup()` method:
- Queries all files for a given asset group ID
- Returns array of `AuctionFile` records
- Used to get file IDs for deletion

### 4. Recently Removed Files Component (`src/components/RecentlyRemovedFiles.tsx`)

Updated `handleDeleteNow()` to:
- Show comprehensive confirmation dialog explaining what will be deleted
- Call `StorageService.deleteAssetGroup()` instead of just deleting DB record
- Delete from B2 bucket AND database
- Bypass the 30-day waiting period

## How It Works

### Current Flow (Before)
1. User removes image from item → `detached_at` timestamp set
2. Image sits in "Recently Removed" for 30 days
3. Worker's cleanup job deletes from B2 and database after 30 days
4. "Delete" button only removed database record, NOT B2 files

### New Flow (After)
1. User removes image from item → `detached_at` timestamp set
2. Image sits in "Recently Removed" for 30 days
3. **NEW:** "Delete" button immediately:
   - Calls worker endpoint
   - Worker checks no active references exist
   - Worker deletes all variants from B2 bucket
   - Worker deletes all database records
   - User gets confirmation

## Safety Features

1. **Active Reference Check**: Cannot delete if asset group is still attached to any items
2. **Comprehensive Confirmation**: Clear dialog explaining exactly what will be deleted
3. **Full Deletion**: Removes ALL variants (thumb, display, source, video) from B2
4. **Database Cleanup**: Removes all related `auction_files` records
5. **Error Handling**: Proper error messages if deletion fails

## Usage

1. Navigate to Admin Panel → Recently Removed Files
2. Find the file you want to delete permanently
3. Click the red "Delete" button
4. Read the confirmation dialog carefully
5. Confirm to permanently delete from B2 and database

## Technical Notes

- Uses the same worker infrastructure that handles cleanup
- Reuses existing `StorageService.deleteAssetGroup()` method
- Reuses existing `DatabaseService` methods
- No new dependencies required
- Works with existing B2 configuration
- Requires worker to be deployed and accessible

## Testing Checklist

- [ ] Delete button shows proper confirmation dialog
- [ ] Deletion removes file from B2 bucket
- [ ] Deletion removes all database records
- [ ] Cannot delete files still attached to items
- [ ] Error handling works when worker is unavailable
- [ ] Recently Removed list refreshes after deletion
- [ ] No orphaned records left in database
- [ ] No orphaned files left in B2 bucket
