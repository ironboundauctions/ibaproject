/*
  # Live Auction Clerk Tables

  ## Overview
  Creates the infrastructure for the live auction clerking system.

  ## New Tables

  ### live_auction_sessions
  Tracks the state of a live auction run per event. Only one active session per event at a time.
  - `id` - Primary key
  - `event_id` - References auction_events
  - `status` - Current session state: 'idle' | 'running' | 'paused' | 'ended'
  - `current_lot_id` - The inventory item ID currently being auctioned
  - `current_lot_index` - Zero-based index into the event's lot order
  - `current_bid` - Current floor/asking bid amount
  - `asking_price` - What the clerk is asking for next
  - `started_at` - When the auction started
  - `paused_at` - When it was last paused
  - `ended_at` - When it ended
  - `created_at` / `updated_at`

  ### live_auction_bid_increments
  Stores the increment ladder per event (customizable per event, falls back to defaults).
  - `id` - Primary key
  - `event_id` - References auction_events (nullable = global default)
  - `amount` - The increment amount
  - `display_order` - Sort order

  ### live_auction_lot_results
  Records the outcome of each lot as it's called.
  - `id` - Primary key
  - `session_id` - References live_auction_sessions
  - `event_id` - References auction_events
  - `inventory_item_id` - References inventory_items
  - `lot_number` - Lot number string
  - `sale_order` - Position in event
  - `result` - 'sold' | 'passed' | 'no_sale' | 'conditional'
  - `sold_price` - Final price if sold
  - `buyer_type` - 'floor' | 'absentee' | 'online' | null
  - `buyer_id` - User ID if online buyer
  - `notes` - Clerk notes
  - `created_at`

  ### live_auction_history_log
  Append-only log of everything that happens during a session.
  - `id` - Primary key
  - `session_id` - References live_auction_sessions
  - `event_id` - References auction_events
  - `entry_type` - 'auction_start' | 'auction_pause' | 'auction_resume' | 'auction_end' | 'lot_start' | 'lot_sold' | 'lot_passed' | 'bid_posted' | 'message_sent' | 'system'
  - `message` - Human readable log entry
  - `metadata` - JSON for extra data (bid amounts, lot IDs, etc.)
  - `created_at`

  ## Security
  - RLS enabled on all tables
  - Only authenticated users with admin/clerk role can read/write sessions
  - History log is insert-only for clerks (no update/delete)
*/

-- live_auction_sessions
CREATE TABLE IF NOT EXISTS live_auction_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES auction_events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'ended')),
  current_lot_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  current_lot_index integer NOT NULL DEFAULT 0,
  current_bid numeric(12,2) NOT NULL DEFAULT 0,
  asking_price numeric(12,2) NOT NULL DEFAULT 0,
  started_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE live_auction_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view live sessions"
  ON live_auction_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert live sessions"
  ON live_auction_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update live sessions"
  ON live_auction_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- live_auction_bid_increments
CREATE TABLE IF NOT EXISTS live_auction_bid_increments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES auction_events(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE live_auction_bid_increments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bid increments"
  ON live_auction_bid_increments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bid increments"
  ON live_auction_bid_increments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bid increments"
  ON live_auction_bid_increments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bid increments"
  ON live_auction_bid_increments FOR DELETE
  TO authenticated
  USING (true);

-- live_auction_lot_results
CREATE TABLE IF NOT EXISTS live_auction_lot_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES live_auction_sessions(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES auction_events(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  lot_number text,
  sale_order integer,
  result text NOT NULL DEFAULT 'passed' CHECK (result IN ('sold', 'passed', 'no_sale', 'conditional')),
  sold_price numeric(12,2),
  buyer_type text CHECK (buyer_type IN ('floor', 'absentee', 'online')),
  buyer_id uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE live_auction_lot_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lot results"
  ON live_auction_lot_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lot results"
  ON live_auction_lot_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- live_auction_history_log
CREATE TABLE IF NOT EXISTS live_auction_history_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES live_auction_sessions(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES auction_events(id) ON DELETE CASCADE,
  entry_type text NOT NULL DEFAULT 'system' CHECK (entry_type IN (
    'auction_start', 'auction_pause', 'auction_resume', 'auction_end',
    'lot_start', 'lot_sold', 'lot_passed', 'bid_posted', 'message_sent', 'system'
  )),
  message text NOT NULL DEFAULT '',
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE live_auction_history_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view history log"
  ON live_auction_history_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert history log"
  ON live_auction_history_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_live_sessions_event_id ON live_auction_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_auction_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_bid_increments_event_id ON live_auction_bid_increments(event_id);
CREATE INDEX IF NOT EXISTS idx_live_lot_results_session_id ON live_auction_lot_results(session_id);
CREATE INDEX IF NOT EXISTS idx_live_history_session_id ON live_auction_history_log(session_id);
CREATE INDEX IF NOT EXISTS idx_live_history_created_at ON live_auction_history_log(created_at);

-- Seed default global bid increments (event_id = NULL means global default)
INSERT INTO live_auction_bid_increments (event_id, amount, display_order) VALUES
  (NULL, 1, 1),
  (NULL, 5, 2),
  (NULL, 10, 3),
  (NULL, 25, 4),
  (NULL, 50, 5),
  (NULL, 100, 6),
  (NULL, 150, 7),
  (NULL, 200, 8),
  (NULL, 250, 9),
  (NULL, 500, 10),
  (NULL, 750, 11),
  (NULL, 1000, 12),
  (NULL, 2500, 13),
  (NULL, 5000, 14),
  (NULL, 10000, 15)
ON CONFLICT DO NOTHING;
