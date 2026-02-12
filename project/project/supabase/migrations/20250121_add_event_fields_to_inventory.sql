/*
  # Add Event Fields to Inventory Items

  Adds event_id, lot_number, and sale_order directly to inventory_items table
  for simpler event-inventory relationship management.

  ## Changes
  - Add event_id column to inventory_items
  - Add lot_number column to inventory_items
  - Add sale_order column to inventory_items
  - Add indexes for performance
*/

-- Add event fields to inventory_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE public.inventory_items ADD COLUMN event_id UUID REFERENCES public.auction_events(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'lot_number'
  ) THEN
    ALTER TABLE public.inventory_items ADD COLUMN lot_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'sale_order'
  ) THEN
    ALTER TABLE public.inventory_items ADD COLUMN sale_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_event ON public.inventory_items(event_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sale_order ON public.inventory_items(event_id, sale_order);
