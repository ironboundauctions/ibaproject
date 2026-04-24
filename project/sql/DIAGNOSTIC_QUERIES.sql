-- Quick diagnostic queries

-- Check if database is clean
SELECT 'inventory' as table_name, COUNT(*) as count FROM inventory_items
UNION ALL
SELECT 'files' as table_name, COUNT(*) as count FROM auction_files  
UNION ALL
SELECT 'jobs' as table_name, COUNT(*) as count FROM publish_jobs;

-- List all asset groups
SELECT DISTINCT asset_group_id FROM auction_files ORDER BY created_at DESC;
