/*
  # Rename and enhance document storage for inventory items

  1. Changes
    - Drop `title_document_image_url` and `title_document_asset_group_id` columns
    - Add `document_urls` jsonb column to store multiple document image URLs
      - Stores an array of objects with url and assetGroupId for each document
      - Allows unlimited document attachments per item
    
  2. Notes
    - This field stores any type of document images (titles, receipts, certificates, etc.)
    - Users can upload, view, and remove multiple documents
    - Each document tracks its CDN URL and asset group ID for management
*/

-- Drop old single-document columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'title_document_image_url'
  ) THEN
    ALTER TABLE inventory_items DROP COLUMN title_document_image_url;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'title_document_asset_group_id'
  ) THEN
    ALTER TABLE inventory_items DROP COLUMN title_document_asset_group_id;
  END IF;
END $$;

-- Add new multi-document storage column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'document_urls'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN document_urls jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
