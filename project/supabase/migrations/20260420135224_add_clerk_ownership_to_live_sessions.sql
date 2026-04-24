/*
  # Add Clerk Ownership to Live Auction Sessions

  ## Purpose
  Enables multi-clerk support so that two clerking pages can be open simultaneously.
  One clerk is "active" (controlling the auction) while others are in "observer" mode
  and can take over at any time with a single click.

  ## Changes

  ### Modified Tables
  - `live_auction_sessions`
    - `active_clerk_id` (uuid, nullable) - auth.uid() of the currently active clerk
    - `active_clerk_name` (text, nullable) - display name of the active clerk
    - `active_clerk_since` (timestamptz, nullable) - when the current clerk claimed the session

  - `live_auction_history_log`
    - `clerk_id` (uuid, nullable) - which clerk performed this action (for audit trail)
    - `clerk_name` (text, nullable) - display name of the clerk who performed the action

  ## Notes
  - active_clerk_id is nullable: NULL means no one has claimed the session
  - Any authenticated admin can claim the session (take over)
  - When a clerk closes their tab, the session stays claimed until another clerk takes over or resets
  - This is intentional: if a clerk's browser crashes, a second clerk can immediately take over
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'active_clerk_id'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN active_clerk_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'active_clerk_name'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN active_clerk_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'active_clerk_since'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN active_clerk_since timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_history_log' AND column_name = 'clerk_id'
  ) THEN
    ALTER TABLE live_auction_history_log ADD COLUMN clerk_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_history_log' AND column_name = 'clerk_name'
  ) THEN
    ALTER TABLE live_auction_history_log ADD COLUMN clerk_name text;
  END IF;
END $$;
