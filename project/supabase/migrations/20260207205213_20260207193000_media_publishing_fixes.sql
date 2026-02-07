/*
  # Media Publishing System - Idempotency & Asset Group Fixes

  1. Changes to `auction_files` table
    - Add `asset_group_id` (uuid) - Groups related files (e.g., same lot across events)
    - Add constraint to ensure unique B2 keys per asset group

  2. Changes to `publish_jobs` table
    - Add `asset_group_id` (uuid) - For tracking and grouping
    - Add `source_item_id` (uuid) - Reference to original inventory/lot item
    - Add `run_after` (timestamptz) - For exponential backoff scheduling

  3. B2 Key Format
    - New format: assets/{asset_group_id}/{variant}.webp
    - Ensures idempotent uploads (same key = overwrite, not duplicate)

  4. Idempotency
    - Worker uses UPSERT to update existing records instead of creating duplicates
*/

-- Add asset_group_id to auction_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'asset_group_id'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN asset_group_id uuid;

    -- Backfill: Files with same file_key get same asset_group_id
    -- Use the first file's ID as the group ID for files with same file_key
    WITH grouped_files AS (
      SELECT 
        id,
        file_key,
        FIRST_VALUE(id) OVER (PARTITION BY file_key ORDER BY created_at, id) as group_id
      FROM auction_files
      WHERE asset_group_id IS NULL
    )
    UPDATE auction_files af
    SET asset_group_id = gf.group_id
    FROM grouped_files gf
    WHERE af.id = gf.id;

    -- For any remaining nulls, generate new UUIDs
    UPDATE auction_files
    SET asset_group_id = gen_random_uuid()
    WHERE asset_group_id IS NULL;

    -- Make it NOT NULL after backfill
    ALTER TABLE auction_files ALTER COLUMN asset_group_id SET NOT NULL;
  END IF;
END $$;

-- Add file_type if not exists (for tracking image vs video vs document)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN file_type text DEFAULT 'image';
  END IF;
END $$;

-- Add columns to publish_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publish_jobs' AND column_name = 'asset_group_id'
  ) THEN
    ALTER TABLE publish_jobs ADD COLUMN asset_group_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publish_jobs' AND column_name = 'source_item_id'
  ) THEN
    ALTER TABLE publish_jobs ADD COLUMN source_item_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publish_jobs' AND column_name = 'run_after'
  ) THEN
    ALTER TABLE publish_jobs ADD COLUMN run_after timestamptz DEFAULT now();
  END IF;
END $$;

-- Update index to include run_after for backoff scheduling
DROP INDEX IF EXISTS idx_publish_jobs_queue;
CREATE INDEX idx_publish_jobs_queue
  ON publish_jobs(status, priority DESC, run_after ASC, created_at ASC)
  WHERE status IN ('pending', 'failed');

-- Add index on asset_group_id for lookups
CREATE INDEX IF NOT EXISTS idx_auction_files_asset_group
  ON auction_files(asset_group_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_publish_jobs_asset_group
  ON publish_jobs(asset_group_id);

-- Add comments
COMMENT ON COLUMN auction_files.asset_group_id IS 'Groups related files (e.g., same lot across different events). Used as base for B2 key: assets/{asset_group_id}/{variant}.webp';
COMMENT ON COLUMN auction_files.file_type IS 'File type: image, video, document. V1 only processes images.';
COMMENT ON COLUMN publish_jobs.asset_group_id IS 'Asset group identifier for this job. Used to construct B2 key path.';
COMMENT ON COLUMN publish_jobs.source_item_id IS 'Reference to source inventory item or lot.';
COMMENT ON COLUMN publish_jobs.run_after IS 'Earliest time this job should run. Used for exponential backoff on retries.';
