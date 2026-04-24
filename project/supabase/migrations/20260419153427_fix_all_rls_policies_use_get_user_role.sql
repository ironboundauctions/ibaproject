/*
  # Fix all RLS policies to use get_user_role() instead of inline user_roles subqueries

  ## Problem
  Many tables have RLS policies that do inline `EXISTS (SELECT 1 FROM user_roles WHERE ...)`
  checks. The user_roles table itself has a SELECT policy that calls get_user_role(), which
  reads user_roles again — creating infinite recursion. This causes all admin write operations
  to fail with a 400 error from the client.

  ## Fix
  Replace all inline user_roles subqueries with get_user_role(auth.uid()) calls, which is
  a SECURITY DEFINER function that bypasses RLS on user_roles, breaking the recursion.

  ## Tables fixed
  - inventory_items
  - auction_events
  - auction_files
  - consigners
  - file_uploads
  - pre_bids
  - profiles
  - publish_jobs
*/

-- ============================================================
-- inventory_items
-- ============================================================
DROP POLICY IF EXISTS "Admins can create inventory" ON inventory_items;
CREATE POLICY "Admins can create inventory"
  ON inventory_items FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can update inventory" ON inventory_items;
CREATE POLICY "Admins can update inventory"
  ON inventory_items FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can delete inventory" ON inventory_items;
CREATE POLICY "Admins can delete inventory"
  ON inventory_items FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Admins can view all inventory" ON inventory_items;
CREATE POLICY "Admins can view all inventory"
  ON inventory_items FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));

-- ============================================================
-- auction_events
-- ============================================================
DROP POLICY IF EXISTS "Admins can create events" ON auction_events;
CREATE POLICY "Admins can create events"
  ON auction_events FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can update events" ON auction_events;
CREATE POLICY "Admins can update events"
  ON auction_events FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can delete events" ON auction_events;
CREATE POLICY "Admins can delete events"
  ON auction_events FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Staff can view all events" ON auction_events;
CREATE POLICY "Staff can view all events"
  ON auction_events FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));

-- ============================================================
-- auction_files
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert media" ON auction_files;
CREATE POLICY "Admins can insert media"
  ON auction_files FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can update media" ON auction_files;
CREATE POLICY "Admins can update media"
  ON auction_files FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can delete media" ON auction_files;
CREATE POLICY "Admins can delete media"
  ON auction_files FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

-- ============================================================
-- consigners
-- ============================================================
DROP POLICY IF EXISTS "Admins can create consigners" ON consigners;
CREATE POLICY "Admins can create consigners"
  ON consigners FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can update consigners" ON consigners;
CREATE POLICY "Admins can update consigners"
  ON consigners FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can delete consigners" ON consigners;
CREATE POLICY "Admins can delete consigners"
  ON consigners FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can view consigners" ON consigners;
CREATE POLICY "Admins can view consigners"
  ON consigners FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));

-- ============================================================
-- file_uploads
-- ============================================================
DROP POLICY IF EXISTS "Admins and subadmins can upload" ON file_uploads;
CREATE POLICY "Admins and subadmins can upload"
  ON file_uploads FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));

DROP POLICY IF EXISTS "Admins and subadmins can delete" ON file_uploads;
CREATE POLICY "Admins and subadmins can delete"
  ON file_uploads FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));

-- ============================================================
-- pre_bids
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all pre-bids" ON pre_bids;
CREATE POLICY "Admins can view all pre-bids"
  ON pre_bids FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));

-- ============================================================
-- profiles
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all profiles based on permissions" ON profiles;
CREATE POLICY "Admins can view all profiles based on permissions"
  ON profiles FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));

-- ============================================================
-- publish_jobs
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert publish jobs" ON publish_jobs;
CREATE POLICY "Admins can insert publish jobs"
  ON publish_jobs FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

DROP POLICY IF EXISTS "Admins can view publish jobs" ON publish_jobs;
CREATE POLICY "Admins can view publish jobs"
  ON publish_jobs FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));

-- ============================================================
-- Fix stuck inventory items (status=assigned_to_auction but no assignment record)
-- ============================================================
UPDATE inventory_items
SET status = 'cataloged'
WHERE status = 'assigned_to_auction'
  AND deleted_at IS NULL
  AND id NOT IN (SELECT inventory_id FROM event_inventory_assignments);
