/*
  # Add unique constraint and updated_at to live_auction_lot_results

  ## Changes
  - Add `updated_at` column to track when a result was last modified
  - Add unique constraint on (session_id, inventory_item_id) to allow upsert per lot per session
  - Deduplicate any existing duplicate rows first (keep most recent by id sort)

  ## Purpose
  Enables upsert so that marking a lot sold, then navigating away and back, then resetting,
  all operate on a single row per lot rather than accumulating duplicates.
*/

ALTER TABLE live_auction_lot_results
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  DELETE FROM live_auction_lot_results a
  USING live_auction_lot_results b
  WHERE a.id < b.id
    AND a.session_id = b.session_id
    AND a.inventory_item_id IS NOT NULL
    AND a.inventory_item_id = b.inventory_item_id;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'live_auction_lot_results'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'live_auction_lot_results_session_item_unique'
  ) THEN
    ALTER TABLE live_auction_lot_results
      ADD CONSTRAINT live_auction_lot_results_session_item_unique
      UNIQUE (session_id, inventory_item_id);
  END IF;
END $$;
