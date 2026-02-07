/*
  # Worker-Based Cleanup System

  1. Changes
    - Remove pg_cron-based cleanup (worker will handle this)
    - Add cleanup tracking table for audit logs
    - Worker will periodically check for files past 30-day retention
    - Worker deletes B2 files first, then database records

  2. Cleanup Process (handled by worker)
    - Query files where deleted_at < NOW() - 30 days
    - Delete B2 objects (thumb.webp and display.webp)
    - Delete database records
    - Log cleanup operations

  3. Important Notes
    - Cleanup is now handled by the Node.js worker, not pg_cron
    - Worker should run cleanup check every 24 hours
    - B2 files are always deleted before DB records (safety)
    - Cleanup never touches RAID masters
*/

-- Remove pg_cron job if exists
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-deleted-media-files');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Create cleanup log table for audit trail
CREATE TABLE IF NOT EXISTS media_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL,
  asset_group_id uuid NOT NULL,
  cdn_key_prefix text,
  deleted_at timestamptz NOT NULL,
  cleaned_at timestamptz DEFAULT now(),
  b2_deletion_success boolean DEFAULT false,
  db_deletion_success boolean DEFAULT false,
  error_message text
);

-- Enable RLS on cleanup log
ALTER TABLE media_cleanup_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cleanup log (admin only)
CREATE POLICY "Admins can view cleanup log"
  ON media_cleanup_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- System can insert cleanup logs (worker uses service role)
CREATE POLICY "System can insert cleanup log"
  ON media_cleanup_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add index for querying cleanup history
CREATE INDEX IF NOT EXISTS idx_media_cleanup_log_cleaned_at
  ON media_cleanup_log(cleaned_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_cleanup_log_asset_group
  ON media_cleanup_log(asset_group_id);

-- Update function comment to reflect worker-based approach
COMMENT ON FUNCTION cleanup_deleted_media_files() IS 'DEPRECATED: Cleanup is now handled by the Node.js worker. This function is kept for backward compatibility but should not be used.';

COMMENT ON TABLE media_cleanup_log IS 'Audit log for media cleanup operations. Worker logs all B2 and DB deletions here for tracking and debugging.';
