/*
  # Fix RLS Policies for New Role Names

  ## Problem
  The admin management system migration changed role names from:
  - 'admin' → 'super_admin'
  - 'subadmin' → 'admin'

  But existing RLS policies on inventory_items, auction_events, consigners, and
  event_inventory_assignments still check for the old role names ('admin', 'subadmin').

  ## Solution
  Update all RLS policies to check for new role names ('super_admin', 'admin').

  ## Changes
  1. Drop all existing RLS policies that check for old role names
  2. Recreate them with correct role checks
*/

-- ============================================================================
-- CONSIGNERS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view consigners" ON public.consigners;
DROP POLICY IF EXISTS "Admins can create consigners" ON public.consigners;
DROP POLICY IF EXISTS "Admins can update consigners" ON public.consigners;
DROP POLICY IF EXISTS "Admins can delete consigners" ON public.consigners;

CREATE POLICY "Admins can view consigners" ON public.consigners
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can create consigners" ON public.consigners
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update consigners" ON public.consigners
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete consigners" ON public.consigners
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- AUCTION EVENTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view events" ON public.auction_events;
DROP POLICY IF EXISTS "Admins can create events" ON public.auction_events;
DROP POLICY IF EXISTS "Admins can update events" ON public.auction_events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.auction_events;

CREATE POLICY "Admins can view events" ON public.auction_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can create events" ON public.auction_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update events" ON public.auction_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete events" ON public.auction_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- INVENTORY ITEMS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins can create inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins can update inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins can delete inventory" ON public.inventory_items;

CREATE POLICY "Admins can view all inventory" ON public.inventory_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can create inventory" ON public.inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update inventory" ON public.inventory_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete inventory" ON public.inventory_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- EVENT INVENTORY ASSIGNMENTS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view assignments" ON public.event_inventory_assignments;
DROP POLICY IF EXISTS "Admins can create assignments" ON public.event_inventory_assignments;
DROP POLICY IF EXISTS "Admins can update assignments" ON public.event_inventory_assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON public.event_inventory_assignments;

CREATE POLICY "Admins can view assignments" ON public.event_inventory_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can create assignments" ON public.event_inventory_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update assignments" ON public.event_inventory_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete assignments" ON public.event_inventory_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );
