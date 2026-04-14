/*
  # Add Live Auction Fields to auction_events

  ## Changes
  - Adds `bid_increment` (numeric) — the dollar increment used during the live auction
  - Adds `stream_url` (text) — embed URL for the auctioneer video stream shown to online bidders
  - Adds `auto_accept_online_bids` (boolean) — when true, pre-bids fire automatically as increments are called;
    when false, the clerk manually accepts each online bid

  ## Notes
  - All new columns are nullable with sensible defaults so existing rows are not broken
  - bid_increment defaults to 25 (dollars)
  - auto_accept_online_bids defaults to true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_events' AND column_name = 'bid_increment'
  ) THEN
    ALTER TABLE auction_events ADD COLUMN bid_increment numeric DEFAULT 25;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_events' AND column_name = 'stream_url'
  ) THEN
    ALTER TABLE auction_events ADD COLUMN stream_url text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_events' AND column_name = 'auto_accept_online_bids'
  ) THEN
    ALTER TABLE auction_events ADD COLUMN auto_accept_online_bids boolean DEFAULT true;
  END IF;
END $$;
