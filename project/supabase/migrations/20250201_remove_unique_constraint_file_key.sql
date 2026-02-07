/*
  # Remove UNIQUE constraint from auction_files.file_key

  1. Changes
    - Drop the UNIQUE index on `auction_files.file_key`
    - Create a regular (non-unique) index on `file_key` for performance

  2. Purpose
    - Allow multiple inventory items to reference the same file from IronDrive picker
    - Files uploaded from PC still get unique filenames (no collision)
    - Files selected from IronDrive picker can now be shared across multiple items

  3. Impact
    - FIXES: Bug where selecting same IronDrive file for multiple items fails
    - No breaking changes: All queries filter by item_id, not file_key
    - Performance maintained with regular index

  4. Future Enhancement
    - Smart deletion with reference counting will be added in follow-up migration
    - Physical files will only be deleted when last reference is removed
*/

-- Drop the existing UNIQUE index
DROP INDEX IF EXISTS idx_auction_files_file_key;

-- Create a regular (non-unique) index for performance
CREATE INDEX IF NOT EXISTS idx_auction_files_file_key ON auction_files(file_key);

-- Verify the change
COMMENT ON INDEX idx_auction_files_file_key IS 'Non-unique index for file_key lookups. Allows multiple items to reference the same file.';
