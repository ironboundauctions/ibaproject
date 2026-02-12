/*
  # Media Publishing System - Metadata and Constraints

  1. New Columns
    - `auction_files.variant` (text) - Variant type: 'thumb', 'display', 'video'
    - `auction_files.width` (integer) - Image/video width in pixels
    - `auction_files.height` (integer) - Image/video height in pixels
    - `auction_files.duration_seconds` (numeric) - Video duration in seconds
    - `auction_files.cdn_url` (text) - Single CDN URL field (replaces thumb_url/display_url per row)

  2. Constraints
    - Add unique constraint on (asset_group_id, variant) for idempotency
    - Ensures reprocessing overwrites the same row

  3. Changes
    - Modify auction_files table to support variant-per-row approach
    - Each variant (thumb, display, video) gets its own row
    - Enable UPSERT pattern for publish worker

  4. Notes
    - Width/height required for images (responsive loading)
    - Duration required for videos (player UI)
    - Unique constraint prevents duplicate variants per asset
    - Existing thumb_url/display_url columns remain for backward compatibility
*/

-- Add variant column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'variant'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN variant text;
  END IF;
END $$;

-- Add cdn_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'cdn_url'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN cdn_url text;
  END IF;
END $$;

-- Add metadata columns to auction_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'width'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN width integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'height'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN height integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN duration_seconds numeric(10, 2);
  END IF;
END $$;

-- Add unique constraint on (asset_group_id, variant) for idempotency
-- Only add if variant column exists and has data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'variant'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'auction_files_asset_group_variant_unique'
    ) THEN
      -- First, ensure there are no existing duplicates
      -- This constraint will fail if there are duplicate (asset_group_id, variant) pairs
      ALTER TABLE auction_files
      ADD CONSTRAINT auction_files_asset_group_variant_unique
      UNIQUE (asset_group_id, variant);
    END IF;
  END IF;
END $$;

-- Create index for deleted files query (used by cleanup job)
CREATE INDEX IF NOT EXISTS idx_auction_files_deleted_at
ON auction_files(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Create index for variant queries
CREATE INDEX IF NOT EXISTS idx_auction_files_variant
ON auction_files(variant)
WHERE variant IS NOT NULL;