-- Diagnostic Queries for IronDrive Image Processing
-- Run these in Supabase SQL Editor to check what's happening

-- 1. Check if publish_jobs table exists and has jobs
SELECT
  status,
  COUNT(*) as count,
  MAX(created_at) as latest_created,
  MAX(updated_at) as latest_updated
FROM publish_jobs
GROUP BY status
ORDER BY status;

-- 2. Check latest publish_jobs (last 10)
SELECT
  id,
  file_id,
  asset_group_id,
  status,
  retry_count,
  error_message,
  created_at,
  started_at,
  completed_at
FROM publish_jobs
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check auction_files for a specific item (replace ITEM_ID)
-- SELECT
--   asset_group_id,
--   variant,
--   source_key,
--   cdn_url,
--   published_status,
--   created_at
-- FROM auction_files
-- WHERE item_id = 'ITEM_ID'
-- ORDER BY asset_group_id, variant;

-- 4. Check for source files without corresponding display/thumb variants
SELECT
  af_source.asset_group_id,
  af_source.source_key,
  af_source.published_status as source_status,
  af_display.variant as has_display,
  af_thumb.variant as has_thumb
FROM auction_files af_source
LEFT JOIN auction_files af_display
  ON af_source.asset_group_id = af_display.asset_group_id
  AND af_display.variant = 'display'
LEFT JOIN auction_files af_thumb
  ON af_source.asset_group_id = af_thumb.asset_group_id
  AND af_thumb.variant = 'thumb'
WHERE af_source.variant = 'source'
  AND af_source.detached_at IS NULL
ORDER BY af_source.created_at DESC
LIMIT 10;

-- 5. Check if any files have cdn_url set
SELECT
  variant,
  COUNT(*) as total,
  COUNT(cdn_url) as with_cdn_url,
  COUNT(*) - COUNT(cdn_url) as without_cdn_url
FROM auction_files
WHERE detached_at IS NULL
GROUP BY variant;

-- 6. Check trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'auction_files';

-- 7. Check recent source files and their jobs
SELECT
  af.id as file_id,
  af.asset_group_id,
  af.source_key,
  af.published_status as file_status,
  af.created_at as file_created,
  pj.id as job_id,
  pj.status as job_status,
  pj.retry_count,
  pj.error_message,
  pj.created_at as job_created
FROM auction_files af
LEFT JOIN publish_jobs pj ON af.id = pj.file_id
WHERE af.variant = 'source'
  AND af.detached_at IS NULL
ORDER BY af.created_at DESC
LIMIT 10;
