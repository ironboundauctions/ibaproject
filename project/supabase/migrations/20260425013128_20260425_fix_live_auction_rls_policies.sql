/*
  # Fix Live Auction Tables RLS Policies

  ## Summary
  Replaces open `USING (true)` / `WITH CHECK (true)` policies on live auction tables
  with policies that restrict write access to admin and super_admin roles only.
  Read access (SELECT) stays open to all authenticated users so the projector/audience
  views and any future public bidding features can read session state.

  ## Changes

  ### live_auction_sessions
  - DROP: open INSERT and UPDATE policies
  - ADD: INSERT/UPDATE restricted to admin/super_admin via get_user_role()

  ### live_auction_bid_increments
  - DROP: open INSERT, UPDATE, DELETE policies
  - ADD: INSERT/UPDATE/DELETE restricted to admin/super_admin

  ### live_auction_lot_results
  - DROP: open INSERT, UPDATE, DELETE policies
  - ADD: INSERT/UPDATE/DELETE restricted to admin/super_admin

  ### live_auction_history_log
  - DROP: open INSERT policy
  - ADD: INSERT restricted to admin/super_admin

  ## Notes
  - SELECT policies are intentionally left open (authenticated) so projector/clerk
    views can read data without additional permissions
  - get_user_role() is SECURITY DEFINER and safe from RLS recursion
*/

-- ── live_auction_sessions ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert live sessions" ON live_auction_sessions;
DROP POLICY IF EXISTS "Authenticated users can update live sessions" ON live_auction_sessions;

CREATE POLICY "Admins can insert live sessions"
  ON live_auction_sessions FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can update live sessions"
  ON live_auction_sessions FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- ── live_auction_bid_increments ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert bid increments" ON live_auction_bid_increments;
DROP POLICY IF EXISTS "Authenticated users can update bid increments" ON live_auction_bid_increments;
DROP POLICY IF EXISTS "Authenticated users can delete bid increments" ON live_auction_bid_increments;

CREATE POLICY "Admins can insert bid increments"
  ON live_auction_bid_increments FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can update bid increments"
  ON live_auction_bid_increments FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can delete bid increments"
  ON live_auction_bid_increments FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- ── live_auction_lot_results ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert lot results" ON live_auction_lot_results;
DROP POLICY IF EXISTS "Authenticated users can update lot results" ON live_auction_lot_results;
DROP POLICY IF EXISTS "Authenticated users can delete lot results" ON live_auction_lot_results;

CREATE POLICY "Admins can insert lot results"
  ON live_auction_lot_results FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can update lot results"
  ON live_auction_lot_results FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can delete lot results"
  ON live_auction_lot_results FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- ── live_auction_history_log ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert history log" ON live_auction_history_log;

CREATE POLICY "Admins can insert history log"
  ON live_auction_history_log FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));
