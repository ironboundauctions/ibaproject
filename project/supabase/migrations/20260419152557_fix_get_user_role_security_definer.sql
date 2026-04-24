/*
  # Fix get_user_role infinite recursion

  ## Problem
  The `get_user_role` function reads from `user_roles`, but the `user_roles` SELECT
  policy calls `get_user_role()` to check access. This creates infinite recursion,
  causing all RLS policies that check user roles via `EXISTS (SELECT FROM user_roles)`
  to fail with a 400 error when called from the client (not service role).

  ## Fix
  Recreate `get_user_role` with SECURITY DEFINER so it bypasses RLS when reading
  the `user_roles` table, breaking the recursion.

  Also fix the `event_inventory_assignments` INSERT/UPDATE/DELETE policies to use
  this function directly instead of an inline subquery on `user_roles`, which would
  still hit the same recursion.
*/

-- Recreate get_user_role as SECURITY DEFINER to bypass RLS on user_roles
CREATE OR REPLACE FUNCTION get_user_role(user_id_input uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = user_id_input LIMIT 1;
$$;

-- Fix event_inventory_assignments INSERT policy to use get_user_role instead of inline subquery
DROP POLICY IF EXISTS "Admins can create assignments" ON event_inventory_assignments;
CREATE POLICY "Admins can create assignments"
  ON event_inventory_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Admins can update assignments" ON event_inventory_assignments;
CREATE POLICY "Admins can update assignments"
  ON event_inventory_assignments
  FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin']));

-- Fix DELETE policy
DROP POLICY IF EXISTS "Admins can delete assignments" ON event_inventory_assignments;
CREATE POLICY "Admins can delete assignments"
  ON event_inventory_assignments
  FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'super_admin');

-- Fix SELECT policies too
DROP POLICY IF EXISTS "Admins can view all assignments" ON event_inventory_assignments;
DROP POLICY IF EXISTS "Admins can view assignments" ON event_inventory_assignments;

CREATE POLICY "Admins can view assignments"
  ON event_inventory_assignments
  FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin', 'admin', 'subadmin']));
