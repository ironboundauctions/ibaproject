/*
  # Make lot_number nullable in event_inventory_assignments

  ## Summary
  Items added to an event no longer require a lot number at insert time.
  Lot numbers are assigned later via a "Generate Lot Numbers" action.

  ## Changes
  - `event_inventory_assignments.lot_number` changed from NOT NULL to nullable
  - The unique constraint on (event_id, lot_number) is replaced with a partial unique index
    that only enforces uniqueness when lot_number is not null, allowing multiple null values per event

  ## Notes
  - Existing rows with lot numbers are unaffected
  - sale_order still tracks insertion order for later lot number generation
*/

ALTER TABLE event_inventory_assignments
  DROP CONSTRAINT IF EXISTS event_inventory_assignments_event_id_lot_number_key;

ALTER TABLE event_inventory_assignments ALTER COLUMN lot_number DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_inventory_assignments_event_id_lot_number_unique
  ON event_inventory_assignments (event_id, lot_number)
  WHERE lot_number IS NOT NULL;
