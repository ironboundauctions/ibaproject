/*
  # Fix CASCADE delete to preserve recently removed files

  ## Problem
  When inventory items are deleted, the CASCADE foreign key constraint 
  immediately deletes all related auction_files records from the database.
  This prevents the "Recently Removed Files" feature from working.

  ## Changes
  1. Change auction_files.item_id foreign key from ON DELETE CASCADE to ON DELETE SET NULL
  2. Make item_id column nullable (it already should be for detached files)
  
  ## Result
  When an inventory item is deleted:
  - Files remain in the database with item_id set to NULL
  - Files have detached_at timestamp set (by application code)
  - Files appear in "Recently Removed Files" for 30 days
  - Cleanup job can later permanently delete old detached files
*/

-- Drop the existing foreign key constraint
ALTER TABLE auction_files 
  DROP CONSTRAINT IF EXISTS auction_files_item_id_fkey;

-- Make item_id nullable (if not already)
ALTER TABLE auction_files 
  ALTER COLUMN item_id DROP NOT NULL;

-- Re-add the foreign key with SET NULL instead of CASCADE
ALTER TABLE auction_files
  ADD CONSTRAINT auction_files_item_id_fkey
  FOREIGN KEY (item_id)
  REFERENCES inventory_items(id)
  ON DELETE SET NULL;
