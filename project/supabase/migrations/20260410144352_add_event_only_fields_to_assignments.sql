/*
  # Add event-only fields to event_inventory_assignments

  ## Summary
  Adds fields to the event_inventory_assignments junction table that are specific
  to how an item appears in a particular auction event. These fields do NOT exist
  on inventory_items and will never sync back to inventory.

  ## New Columns on event_inventory_assignments
  - `lot_notes` (text) - Auction-specific notes about this lot (ring notes, auctioneer notes, etc.)
  - `lot_starting_price` (numeric) - Override starting price for this specific auction event.
    If NULL, the inventory item's starting_price is used instead.

  ## Design Intent
  - inventory_items holds canonical, permanent item data
  - event_inventory_assignments holds event-specific overrides and metadata
  - Edits to title, description, category, media, etc. go to inventory_items (synced)
  - Lot number, sale order, lot notes, lot starting price are event-specific (not synced)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_inventory_assignments' AND column_name = 'lot_notes'
  ) THEN
    ALTER TABLE event_inventory_assignments ADD COLUMN lot_notes text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_inventory_assignments' AND column_name = 'lot_starting_price'
  ) THEN
    ALTER TABLE event_inventory_assignments ADD COLUMN lot_starting_price numeric(10,2) DEFAULT NULL;
  END IF;
END $$;
