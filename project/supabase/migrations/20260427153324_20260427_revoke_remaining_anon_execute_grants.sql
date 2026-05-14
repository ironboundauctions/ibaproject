-- Trigger-only functions: revoke anon + authenticated (never called via REST)
REVOKE EXECUTE ON FUNCTION public.create_publish_job_for_new_file() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- Internal functions: revoke anon + authenticated
REVOKE EXECUTE ON FUNCTION public.ensure_super_admin_exists() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_bid() FROM anon, authenticated;

-- update_auction_bid: revoke anon (bidding requires authentication)
REVOKE EXECUTE ON FUNCTION public.update_auction_bid() FROM anon;

-- cleanup_deleted_media_files: revoke authenticated (only called by worker/trigger, not frontend)
REVOKE EXECUTE ON FUNCTION public.cleanup_deleted_media_files() FROM authenticated;
