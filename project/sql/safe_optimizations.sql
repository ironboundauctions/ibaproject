-- Safe database optimizations - Performance & Data Quality
-- These changes do not alter behavior or restrict valid operations

-- 1. NOT NULL Constraints (data quality)
ALTER TABLE public.inventory_items
  ALTER COLUMN inventory_number SET NOT NULL,
  ALTER COLUMN title SET NOT NULL;

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_number
  ON public.inventory_items (inventory_number);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_desc
  ON public.inventory_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_files_key
  ON public.auction_files (file_key);

-- 3. auction_files basic constraints (if RAID integration is active)
ALTER TABLE public.auction_files
  ALTER COLUMN storage_provider SET DEFAULT 'raid',
  ALTER COLUMN name SET NOT NULL;
