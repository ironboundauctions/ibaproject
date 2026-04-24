-- CLEANUP SCRIPT: Delete ALL test inventory data and media
-- WARNING: This will delete ALL inventory items and their media files
-- Run this in Supabase SQL Editor to start fresh

-- Step 1: Soft-delete all auction_files (sets detached_at)
-- This allows the worker cleanup job to handle B2 deletion
UPDATE auction_files
SET detached_at = NOW()
WHERE detached_at IS NULL;

-- Step 2: Delete all publish_jobs
DELETE FROM publish_jobs;

-- Step 3: Delete all inventory items (CASCADE will delete auction_files)
DELETE FROM inventory_items;

-- Step 4: Verify cleanup
SELECT 'Cleanup complete!' as status;

-- Optional: Check what's left
SELECT
  'auction_files' as table_name,
  COUNT(*) as remaining_rows,
  COUNT(*) FILTER (WHERE detached_at IS NOT NULL) as soft_deleted,
  COUNT(*) FILTER (WHERE detached_at IS NULL) as active
FROM auction_files
UNION ALL
SELECT
  'inventory_items' as table_name,
  COUNT(*) as remaining_rows,
  0 as soft_deleted,
  COUNT(*) as active
FROM inventory_items
UNION ALL
SELECT
  'publish_jobs' as table_name,
  COUNT(*) as remaining_rows,
  0 as soft_deleted,
  COUNT(*) as active
FROM publish_jobs;
