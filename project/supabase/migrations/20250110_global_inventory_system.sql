/*
  # Global Inventory System

  ## Overview
  Creates a complete inventory management system where inventory items exist independently
  and can be assigned to auction events when needed.

  ## New Tables

  ### consigners
  - Stores consigner/seller information
  - Independent of items and events

  ### inventory_items
  - Global inventory pool - items exist independently of events
  - Stores all item details (title, description, pricing, images, etc.)
  - Tracks consigner information
  - Can be assigned to events later

  ### auction_events
  - Auction events that can contain multiple items
  - Stores event details (title, dates, location, terms, etc.)
  - Independent of inventory items

  ### event_inventory_assignments
  - Junction table linking inventory items to events
  - Tracks which items are assigned to which events
  - Stores lot numbers and order within events

  ## Security
  - RLS enabled on all tables
  - Admins and subadmins can manage all data
  - Public read access for published items/events

  ## Important Notes
  1. Inventory items can exist without being assigned to an event
  2. Items can be reassigned between events
  3. Lot numbers are assigned when items are added to events
  4. Items maintain their identity across events
*/

-- 1. CREATE CONSIGNERS TABLE
CREATE TABLE IF NOT EXISTS public.consigners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  nickname TEXT,
  company TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  tax_id TEXT,
  payment_terms TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consigners_customer_number ON public.consigners(customer_number);
CREATE INDEX IF NOT EXISTS idx_consigners_full_name ON public.consigners(full_name);
CREATE INDEX IF NOT EXISTS idx_consigners_email ON public.consigners(email);

-- 2. CREATE AUCTION EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.auction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  auction_type TEXT NOT NULL CHECK (auction_type IN ('live', 'timed', 'hybrid')) DEFAULT 'live',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  registration_start TIMESTAMPTZ,
  location TEXT,
  auctioneer TEXT,
  event_terms TEXT DEFAULT '',
  main_image_url TEXT DEFAULT '',
  buyers_premium DECIMAL(5,2) DEFAULT 10.00,
  cc_card_fees DECIMAL(5,2) DEFAULT 3.00,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_events_status ON public.auction_events(status);
CREATE INDEX IF NOT EXISTS idx_auction_events_start_date ON public.auction_events(start_date);

-- 3. CREATE GLOBAL INVENTORY ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_number TEXT UNIQUE NOT NULL,
  consigner_customer_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  additional_description TEXT,
  category TEXT NOT NULL,
  starting_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  reserve_price DECIMAL(10,2),
  estimated_value_low DECIMAL(10,2),
  estimated_value_high DECIMAL(10,2),
  image_url TEXT DEFAULT '',
  additional_images TEXT[] DEFAULT '{}',
  condition TEXT,
  dimensions TEXT,
  weight TEXT,
  manufacturer TEXT,
  year_made TEXT,
  notes TEXT,
  specifications JSONB DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('cataloged', 'assigned_to_auction', 'live', 'sold', 'paid', 'picked_up', 'returned')) DEFAULT 'cataloged',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory_number ON public.inventory_items(inventory_number);
CREATE INDEX IF NOT EXISTS idx_inventory_items_consigner ON public.inventory_items(consigner_customer_number);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);

-- 4. CREATE EVENT-INVENTORY ASSIGNMENT TABLE
CREATE TABLE IF NOT EXISTS public.event_inventory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.auction_events(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  sale_order INTEGER NOT NULL DEFAULT 0,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, inventory_id),
  UNIQUE(event_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_event_assignments_event ON public.event_inventory_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_inventory ON public.event_inventory_assignments(inventory_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_order ON public.event_inventory_assignments(event_id, sale_order);

-- 5. ENABLE RLS ON ALL TABLES
ALTER TABLE public.consigners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_inventory_assignments ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR CONSIGNERS

-- Admins and subadmins can view all consigners
CREATE POLICY "Admins can view consigners" ON public.consigners
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins and subadmins can create consigners
CREATE POLICY "Admins can create consigners" ON public.consigners
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins and subadmins can update consigners
CREATE POLICY "Admins can update consigners" ON public.consigners
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins can delete consigners
CREATE POLICY "Admins can delete consigners" ON public.consigners
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 7. RLS POLICIES FOR AUCTION EVENTS

-- Anyone can view published events
CREATE POLICY "Anyone can view published events" ON public.auction_events
  FOR SELECT
  USING (status = 'published' OR status = 'active');

-- Admins and subadmins can view all events
CREATE POLICY "Admins can view all events" ON public.auction_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins and subadmins can create events
CREATE POLICY "Admins can create events" ON public.auction_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins and subadmins can update events
CREATE POLICY "Admins can update events" ON public.auction_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins can delete events
CREATE POLICY "Admins can delete events" ON public.auction_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 8. RLS POLICIES FOR INVENTORY ITEMS

-- Anyone can view available items
CREATE POLICY "Anyone can view available inventory" ON public.inventory_items
  FOR SELECT
  USING (status = 'available' OR status = 'assigned');

-- Admins and subadmins can view all items
CREATE POLICY "Admins can view all inventory" ON public.inventory_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins and subadmins can create items
CREATE POLICY "Admins can create inventory" ON public.inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins and subadmins can update items
CREATE POLICY "Admins can update inventory" ON public.inventory_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins can delete items
CREATE POLICY "Admins can delete inventory" ON public.inventory_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 9. RLS POLICIES FOR EVENT ASSIGNMENTS

-- Anyone can view assignments for published events
CREATE POLICY "Anyone can view event assignments" ON public.event_inventory_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.auction_events
      WHERE id = event_id
      AND (status = 'published' OR status = 'active')
    )
  );

-- Admins and subadmins can view all assignments
CREATE POLICY "Admins can view all assignments" ON public.event_inventory_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins and subadmins can create assignments
CREATE POLICY "Admins can create assignments" ON public.event_inventory_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins and subadmins can update assignments
CREATE POLICY "Admins can update assignments" ON public.event_inventory_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- Admins can delete assignments
CREATE POLICY "Admins can delete assignments" ON public.event_inventory_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- 10. ADD HELPFUL COMMENTS
COMMENT ON TABLE public.consigners IS 'Consigners/sellers who provide items for auction';
COMMENT ON TABLE public.auction_events IS 'Auction events - independent of inventory items';
COMMENT ON TABLE public.inventory_items IS 'Global inventory pool - items exist independently and can be assigned to events';
COMMENT ON TABLE public.event_inventory_assignments IS 'Links inventory items to auction events with lot numbers and sale order';
