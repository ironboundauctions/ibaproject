/*
  # Add pre_bidding_enabled column to auction_events

  Allows admins to toggle whether pre-bidding is open for a specific event.
  Default is false — admin must explicitly enable it.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_events' AND column_name = 'pre_bidding_enabled'
  ) THEN
    ALTER TABLE auction_events ADD COLUMN pre_bidding_enabled boolean DEFAULT false;
  END IF;
END $$;
