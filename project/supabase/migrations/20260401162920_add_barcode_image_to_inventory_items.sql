/*
  # Add Barcode Image to Inventory Items

  1. Changes
    - Add `barcode_image_url` column to `inventory_items` table
    - This field will store the CDN URL of the barcode/inventory number image
    - Separate from main media gallery images
  
  2. Use Cases
    - Manual entry: User uploads a barcode image and enters inventory number
    - Bulk upload: System auto-fills this with the barcode sticker image after analysis
*/

-- Add barcode_image_url column
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS barcode_image_url text;

-- Add comment for documentation
COMMENT ON COLUMN inventory_items.barcode_image_url IS 'CDN URL of the barcode/inventory number sticker image - separate from gallery images';