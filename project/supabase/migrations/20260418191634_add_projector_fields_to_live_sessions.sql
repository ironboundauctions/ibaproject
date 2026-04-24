/*
  # Add Projector Fields to Live Auction Sessions

  ## Overview
  Adds two new columns to live_auction_sessions to support the audience projector display
  and the image controller feature.

  ## Changes to live_auction_sessions
  - `projector_message` (text, nullable) - The current message displayed on the audience projector.
    Updated by the clerk via the Floor Projector messages panel. Replaces previous message
    when a new one is sent (one message at a time).
  - `projector_image_index` (integer, default 0) - The index of the image currently displayed
    on the audience projector for the current lot. Updated by the clerk via image navigation
    (prev/next buttons or the image controller page).

  ## Notes
  - Both fields are nullable / have defaults so existing rows are unaffected.
  - The projector page and image controller page subscribe to live_auction_sessions via
    Supabase Realtime, so any update to these fields propagates instantly to all open tabs.
  - No RLS changes needed - existing policies on live_auction_sessions already cover
    authenticated reads and writes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'projector_message'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN projector_message text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'projector_image_index'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN projector_image_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;
