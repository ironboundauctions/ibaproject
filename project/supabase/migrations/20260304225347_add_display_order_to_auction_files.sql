/*
  # Add display_order to auction_files table

  1. Changes
    - Add `display_order` column to `auction_files` table
      - Integer column to track the order of media files
      - Defaults to 0
      - Used for drag-and-drop reordering in the inventory form

  2. Notes
    - Existing files will have display_order = 0
    - Frontend will handle setting proper order values when saving
*/

-- Add display_order column
ALTER TABLE auction_files
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_auction_files_display_order
ON auction_files(item_id, display_order)
WHERE detached_at IS NULL;