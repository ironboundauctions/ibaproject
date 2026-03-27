/*
  # Update Batch Analysis Jobs for Barcode Workflow

  1. Changes to batch_analysis_jobs table
    - Add `analysis_results` (jsonb) - Stores grouped/ungrouped/errors structure from barcode scanning
    - Add `uploaded_files` (jsonb) - Stores metadata for all uploaded files with CDN URLs
    - Add `user_adjustments` (jsonb) - Stores user's manual grouping changes
    - Add `analyzed_at` (timestamptz) - When barcode analysis completed
    - Add `confirmed_at` (timestamptz) - When user confirmed and created items
    - Add `cancelled_at` (timestamptz) - When user cancelled without confirming
    - Add `expires_at` (timestamptz) - When temp files should be deleted (24 hours)
    - Update status enum to include: ready_for_review, processing, confirmed, expired, cancelled

  2. Indexes
    - Add index on expires_at for cleanup queries

  3. Security
    - Add policy for service role to read expired batches for cleanup
*/

-- Add new columns
DO $$
BEGIN
  -- Add analysis_results column (stores grouped/ungrouped/errors structure)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_analysis_jobs' AND column_name = 'analysis_results'
  ) THEN
    ALTER TABLE batch_analysis_jobs ADD COLUMN analysis_results jsonb DEFAULT '{"grouped": [], "ungrouped": [], "errors": []}'::jsonb;
  END IF;

  -- Add uploaded_files column (stores CDN URLs and metadata)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_analysis_jobs' AND column_name = 'uploaded_files'
  ) THEN
    ALTER TABLE batch_analysis_jobs ADD COLUMN uploaded_files jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add user_adjustments column (stores manual grouping changes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_analysis_jobs' AND column_name = 'user_adjustments'
  ) THEN
    ALTER TABLE batch_analysis_jobs ADD COLUMN user_adjustments jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add analyzed_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_analysis_jobs' AND column_name = 'analyzed_at'
  ) THEN
    ALTER TABLE batch_analysis_jobs ADD COLUMN analyzed_at timestamptz;
  END IF;

  -- Add confirmed_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_analysis_jobs' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE batch_analysis_jobs ADD COLUMN confirmed_at timestamptz;
  END IF;

  -- Add cancelled_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_analysis_jobs' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE batch_analysis_jobs ADD COLUMN cancelled_at timestamptz;
  END IF;

  -- Add expires_at timestamp (defaults to 24 hours from creation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batch_analysis_jobs' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE batch_analysis_jobs ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '24 hours');
  END IF;
END $$;

-- Drop old status constraint and add new one with updated statuses
ALTER TABLE batch_analysis_jobs DROP CONSTRAINT IF EXISTS batch_analysis_jobs_status_check;
ALTER TABLE batch_analysis_jobs ADD CONSTRAINT batch_analysis_jobs_status_check
  CHECK (status IN ('pending', 'analyzing', 'ready_for_review', 'processing', 'confirmed', 'failed', 'expired', 'cancelled'));

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_batch_analysis_jobs_expires_at ON batch_analysis_jobs(expires_at);

-- Drop existing service role policy if exists
DROP POLICY IF EXISTS "Service role can read expired batches" ON batch_analysis_jobs;

-- Policy: Service role can read expired batches for cleanup
CREATE POLICY "Service role can read expired batches"
  ON batch_analysis_jobs
  FOR SELECT
  TO service_role
  USING (true);

-- Add comments explaining the structure
COMMENT ON COLUMN batch_analysis_jobs.analysis_results IS 'Barcode scan results: {grouped: [{inv_number: string, files: [{fileName, assetGroupId}]}], ungrouped: [{fileName, assetGroupId}], errors: [{fileName, error}]}';
COMMENT ON COLUMN batch_analysis_jobs.uploaded_files IS 'Array of uploaded file metadata: [{fileName, assetGroupId, cdnUrls: {source, display, thumb}}]';
COMMENT ON COLUMN batch_analysis_jobs.user_adjustments IS 'User manual grouping changes: {movedFiles: [{from, to, fileName}], deletedFiles: [assetGroupId], newGroups: [{inv_number, files}]}';
