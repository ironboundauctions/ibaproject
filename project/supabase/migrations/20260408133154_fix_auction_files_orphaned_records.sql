/*
  # Fix Orphaned Auction Files Records

  ## Problem
  The foreign key constraint on `auction_files.item_id` uses `ON DELETE SET NULL`,
  which leaves orphaned records when inventory items are deleted. This causes:
  - Ghost records in the database that don't appear in the webapp
  - Confusion about actual file counts
  - Potential storage inconsistencies

  ## Changes
  1. Delete all existing orphaned records (item_id IS NULL)
  2. Drop and recreate the foreign key constraint with CASCADE delete
  3. Make item_id NOT NULL (it should always have a parent)

  ## Impact
  - Removes ~208 orphaned file records (70 asset groups)
  - Ensures future deletions clean up properly
  - Database counts will now match webapp reality
*/

-- Step 1: Delete all orphaned records
DELETE FROM auction_files
WHERE item_id IS NULL;

-- Step 2: Drop the old foreign key constraint
ALTER TABLE auction_files
DROP CONSTRAINT IF EXISTS auction_files_item_id_fkey;

-- Step 3: Make item_id NOT NULL (all records should have a parent)
ALTER TABLE auction_files
ALTER COLUMN item_id SET NOT NULL;

-- Step 4: Recreate the foreign key with CASCADE delete
ALTER TABLE auction_files
ADD CONSTRAINT auction_files_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES inventory_items(id)
ON DELETE CASCADE;
