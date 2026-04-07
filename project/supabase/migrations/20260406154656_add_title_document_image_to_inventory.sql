/*
  # Add Title/Ownership Document Image fields to Inventory Items

  1. Changes
    - Add `title_document_image_url` text column to `inventory_items` table
      - Stores the CDN URL of the uploaded ownership document image
      - Nullable (optional field)
    - Add `title_document_asset_group_id` text column to `inventory_items` table
      - Stores the asset group ID for tracking the document image
      - Nullable (optional field)

  2. Notes
    - This field stores images of ownership documents (car title, deed, certificate, etc.)
    - Users can upload, view, and remove these images just like barcode images
    - Important for keeping digital records of legal ownership documentation
*/

-- Add title document image fields to inventory_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'title_document_image_url'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN title_document_image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'title_document_asset_group_id'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN title_document_asset_group_id text;
  END IF;
END $$;
