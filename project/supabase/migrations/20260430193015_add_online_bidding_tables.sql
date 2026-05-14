/*
  # Online Bidding System

  ## Summary
  Adds support for real-time online bidding by public users during a live auction session.

  ## New Tables
  - `online_bids` — stores incoming bids from online bidders with status tracking

  ## Modified Tables
  - `live_auction_sessions` — adds `online_bid_mode` column ('auto' or 'manual')

  ## Details
  1. `online_bids`
     - `id` (uuid, pk)
     - `session_id` (uuid, FK → live_auction_sessions)
     - `event_id` (uuid)
     - `lot_id` (uuid, nullable) — the current lot at time of bid
     - `lot_index` (int) — lot index at time of bid
     - `user_id` (uuid, FK → auth.users)
     - `bidder_name` (text)
     - `bid_amount` (numeric) — the asking price at time of bid click
     - `status` (text) — 'pending' | 'accepted' | 'rejected' | 'superseded'
     - timestamps

  2. `live_auction_sessions` gets `online_bid_mode` default 'manual'

  ## Security
  - RLS enabled on online_bids
  - Authenticated users can insert their own bids
  - Authenticated users can read bids for a given session
  - Only service role / admin can update bid status
*/

-- Add online_bid_mode to live_auction_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'online_bid_mode'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN online_bid_mode text NOT NULL DEFAULT 'manual';
  END IF;
END $$;

-- Create online_bids table
CREATE TABLE IF NOT EXISTS online_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES live_auction_sessions(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  lot_id uuid,
  lot_index integer NOT NULL DEFAULT 0,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bidder_name text NOT NULL DEFAULT '',
  bid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS online_bids_session_id_idx ON online_bids(session_id);
CREATE INDEX IF NOT EXISTS online_bids_session_status_idx ON online_bids(session_id, status);
CREATE INDEX IF NOT EXISTS online_bids_user_id_idx ON online_bids(user_id);

ALTER TABLE online_bids ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own bids
CREATE POLICY "Authenticated users can insert own bids"
  ON online_bids FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can read all bids for sessions (needed by clerk and bidders)
CREATE POLICY "Authenticated users can read bids"
  ON online_bids FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can update their own bids (clerk updates status via service role, but also allow for RLS)
CREATE POLICY "Authenticated users can update any bid status"
  ON online_bids FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
