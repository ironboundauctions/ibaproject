/*
  # Add backup URL and source user to auction_files

  1. Changes
    - Add `download_url_backup` column to store Bolt URL as fallback
    - Add `source_user_id` column to track the IronDrive user who owns the file

  2. Indexes
    - Add index on `source_user_id` for faster lookups

  3. Purpose
    - Enable dual URL storage (RAID primary, Bolt backup) for reliability
    - Track file ownership from IronDrive picker selections
*/

-- Add backup URL column (nullable)
ALTER TABLE public.auction_files
  ADD COLUMN IF NOT EXISTS download_url_backup text;

-- Add source user ID column (nullable)
ALTER TABLE public.auction_files
  ADD COLUMN IF NOT EXISTS source_user_id uuid;

-- Add index for faster lookups by source_user_id
CREATE INDEX IF NOT EXISTS auction_files_source_user_id_idx
  ON public.auction_files (source_user_id);
