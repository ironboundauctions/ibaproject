/*
  # Add Has Title/Ownership Document field to Inventory Items

  1. Changes
    - Add `has_title` boolean column to `inventory_items` table
      - Indicates whether the item comes with ownership documents (car title, deed, certificate, etc.)
      - Defaults to false
      - Not nullable

  2. Notes
    - This field helps track items that include legal ownership documentation
    - Examples: car title, deed, certificate of authenticity, registration papers
    - Important for items where proof of ownership transfers with the sale
*/

-- Add has_title column to inventory_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'has_title'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN has_title boolean DEFAULT false NOT NULL;
  END IF;
END $$;
