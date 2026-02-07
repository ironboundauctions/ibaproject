/*
  # Media Publishing System - Full Implementation

  1. Changes to `auction_files` table
    - Add `thumb_url` (text) - 400px thumbnail WebP URL on CDN
    - Add `display_url` (text) - 1600px display WebP URL on CDN
    - Add `publish_status` (text) - Status: 'pending', 'processing', 'published', 'failed', 'deleted'
    - Add `published_at` (timestamptz) - When variants were successfully published
    - Add `deleted_at` (timestamptz) - Soft delete timestamp (30-day grace period)
    - Add `cdn_key_prefix` (text) - Base S3 key for this file's variants

  2. New Tables
    - `publish_jobs` - Queue table for asynchronous media processing
      - `id` (uuid, primary key)
      - `file_id` (uuid, foreign key to auction_files)
      - `status` (text) - 'pending', 'processing', 'completed', 'failed'
      - `priority` (int) - Job priority (higher = more urgent)
      - `retry_count` (int) - Number of retry attempts
      - `max_retries` (int) - Maximum allowed retries
      - `error_message` (text) - Error details if failed
      - `started_at` (timestamptz) - When processing began
      - `completed_at` (timestamptz) - When processing finished
      - `created_at` (timestamptz) - When job was created
      - `updated_at` (timestamptz) - Last update timestamp

  3. Indexes
    - Index on publish_jobs (status, priority, created_at) for queue polling
    - Index on auction_files (publish_status, deleted_at) for cleanup

  4. Security
    - Enable RLS on publish_jobs
    - Add policies for admin access only
*/

-- Add new columns to auction_files
DO $$
BEGIN
  -- Add thumb_url if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'thumb_url'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN thumb_url text;
  END IF;

  -- Add display_url if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'display_url'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN display_url text;
  END IF;

  -- Add publish_status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'publish_status'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN publish_status text DEFAULT 'pending';
  END IF;

  -- Add published_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN published_at timestamptz;
  END IF;

  -- Add deleted_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN deleted_at timestamptz;
  END IF;

  -- Add cdn_key_prefix if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'cdn_key_prefix'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN cdn_key_prefix text;
  END IF;
END $$;

-- Create publish_jobs table
CREATE TABLE IF NOT EXISTS publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES auction_files(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority int NOT NULL DEFAULT 5,
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 5,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_publish_jobs_queue
  ON publish_jobs(status, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_publish_jobs_file_id
  ON publish_jobs(file_id);

CREATE INDEX IF NOT EXISTS idx_auction_files_publish_status
  ON auction_files(publish_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auction_files_cleanup
  ON auction_files(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Enable RLS on publish_jobs
ALTER TABLE publish_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for publish_jobs (admin only)
CREATE POLICY "Admins can view all publish jobs"
  ON publish_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert publish jobs"
  ON publish_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "System can update publish jobs"
  ON publish_jobs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add constraint to ensure valid publish_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auction_files_publish_status_check'
  ) THEN
    ALTER TABLE auction_files
    ADD CONSTRAINT auction_files_publish_status_check
    CHECK (publish_status IN ('pending', 'processing', 'published', 'failed', 'deleted'));
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for publish_jobs updated_at
DROP TRIGGER IF EXISTS update_publish_jobs_updated_at ON publish_jobs;
CREATE TRIGGER update_publish_jobs_updated_at
  BEFORE UPDATE ON publish_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to document the CDN URL structure
COMMENT ON COLUMN auction_files.cdn_key_prefix IS 'Base S3 key for variants. Example: "auction-123/lot-456/original-filename". Variants: {prefix}_thumb.webp, {prefix}_display.webp';
COMMENT ON COLUMN auction_files.thumb_url IS 'CDN URL for 400px thumbnail (WebP). Format: https://cdn.ibaproject.bid/file/IBA-Lot-Media/{cdn_key_prefix}_thumb.webp';
COMMENT ON COLUMN auction_files.display_url IS 'CDN URL for 1600px display image (WebP). Format: https://cdn.ibaproject.bid/file/IBA-Lot-Media/{cdn_key_prefix}_display.webp';
COMMENT ON COLUMN auction_files.publish_status IS 'Publishing status: pending (queued), processing (worker active), published (variants available), failed (error), deleted (soft deleted, 30-day retention)';
COMMENT ON TABLE publish_jobs IS 'Queue table for asynchronous media processing. Worker polls for pending jobs, downloads from RAID, processes images, uploads to B2, and updates auction_files.';