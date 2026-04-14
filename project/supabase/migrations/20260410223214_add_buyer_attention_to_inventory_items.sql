/*
  # Add buyer_attention column to inventory_items

  ## Summary
  Adds a "Attention to Buyer" text field to inventory items so admins can
  flag important notes for public bidders (e.g. "Sells with bill of sale only",
  "Buyer responsible for removal", "AS-IS no returns").

  ## Changes
  - `inventory_items`: new nullable `buyer_attention` text column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'buyer_attention'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN buyer_attention text;
  END IF;
END $$;
