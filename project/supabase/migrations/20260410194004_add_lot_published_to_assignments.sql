/*
  # Add lot_published to event_inventory_assignments

  Allows admins to publish/unpublish individual lots within an event catalog.
  Default is true so existing lots remain visible.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_inventory_assignments' AND column_name = 'lot_published'
  ) THEN
    ALTER TABLE event_inventory_assignments ADD COLUMN lot_published boolean DEFAULT true;
  END IF;
END $$;
