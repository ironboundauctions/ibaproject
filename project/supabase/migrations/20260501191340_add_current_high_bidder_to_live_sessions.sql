/*
  # Add current_high_bidder_id to live_auction_sessions

  Tracks which online bidder currently holds the high bid on the active lot.
  This is broadcast to all connected bidders so they can see their own bid status
  in real-time without waiting for a per-bid subscription update.

  ## Changes
  - `live_auction_sessions`: add `current_high_bidder_id` (uuid, nullable, references auth.users)
    Cleared to NULL when lot advances or auction ends.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'current_high_bidder_id'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN current_high_bidder_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
