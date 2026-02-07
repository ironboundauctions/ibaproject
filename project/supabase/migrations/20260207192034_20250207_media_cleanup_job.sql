/*
  # Media Cleanup Job - 30-Day Purge

  1. New Components
    - Enable pg_cron extension if not already enabled
    - Create cleanup function to purge soft-deleted files after 30 days
    - Schedule daily cron job to run cleanup

  2. Cleanup Process
    - Identifies files where deleted_at is older than 30 days
    - Logs files to be deleted for audit trail
    - Deletes the auction_files records (CASCADE will remove related publish_jobs)

  3. Important Notes
    - Physical B2 file deletion must be handled by external worker/script
    - This migration only handles database cleanup
    - Files are permanently removed from database after 30 days
    - The worker should implement B2 cleanup based on cdn_key_prefix before deletion
*/

-- Enable pg_cron extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_deleted_media_files()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deletion_count integer;
  files_to_delete text[];
BEGIN
  -- Get list of files to delete for logging
  SELECT array_agg(id::text)
  INTO files_to_delete
  FROM auction_files
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  -- Delete files older than 30 days
  WITH deleted AS (
    DELETE FROM auction_files
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT count(*) INTO deletion_count FROM deleted;

  -- Log the cleanup
  IF deletion_count > 0 THEN
    RAISE NOTICE 'Cleaned up % media files: %', deletion_count, files_to_delete;
  END IF;
END;
$$;

-- Schedule cleanup job to run daily at 2 AM UTC
SELECT cron.schedule(
  'cleanup-deleted-media-files',
  '0 2 * * *',
  $$SELECT cleanup_deleted_media_files();$$
);

-- Add comment
COMMENT ON FUNCTION cleanup_deleted_media_files() IS 'Permanently deletes auction_files records that have been soft-deleted for more than 30 days. Related publish_jobs are automatically deleted via CASCADE. Physical B2 files should be deleted by worker before this runs.';
