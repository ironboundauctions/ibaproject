-- Run this query to check what file records exist for your video item
-- Replace 'YOUR_ITEM_ID' with the actual inventory item ID that has the video

SELECT
    id,
    item_id,
    asset_group_id,
    variant,
    original_name,
    mime_type,
    source_key,
    cdn_url,
    backup_url,
    published_status,
    width,
    height,
    created_at
FROM auction_files
WHERE item_id = 'YOUR_ITEM_ID'  -- REPLACE THIS
    AND detached_at IS NULL
ORDER BY asset_group_id, variant;

-- This will show you all variants (source, video, thumb, display) for the item
-- Check:
-- 1. Does a 'video' variant exist with a cdn_url?
-- 2. Does a 'thumb' variant exist with a cdn_url?
-- 3. Does a 'display' variant exist with a cdn_url?
-- 4. What is the published_status for each variant?
