/*
  # Add deleted_at column for soft delete functionality

  1. Changes
    - Add `deleted_at` timestamp column to `inventory_items` table
    - Column is nullable (NULL = active, timestamp = soft deleted)
    - Enables "Recently Removed Items" feature
  
  2. Security
    - No changes to RLS policies needed
    - Existing policies will continue to work
*/

-- Add deleted_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;