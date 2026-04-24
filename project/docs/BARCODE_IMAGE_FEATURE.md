# Barcode Image Feature

## Overview
Added a dedicated barcode/inventory sticker image field to inventory items, separate from the main media gallery.

## Database Changes

### Migration: `add_barcode_image_to_inventory_items`
- Added `barcode_image_url` column to `inventory_items` table
- Stores the CDN URL of the barcode/inventory number sticker image
- Separate from `auction_files` media gallery

## Frontend Changes

### Inventory Item Form (`InventoryItemFormNew.tsx`)

**New UI Section:**
- Located next to the Inventory Number field
- Upload button with barcode icon when no image is present
- Preview of uploaded barcode image with remove option
- Shows upload status (uploading, published)

**Workflow for Manual Entry:**
1. User enters inventory number manually
2. User uploads a barcode sticker image
3. Image is uploaded to worker and processed
4. CDN URL is saved to `barcode_image_url` field

**Workflow for Editing:**
- Loads existing barcode image if present
- User can remove and replace the barcode image
- Changes are saved on form submission

### Bulk Upload Integration (`bulkUploadService.ts`)

**Automatic Population:**
- During bulk upload, the barcode scanner identifies barcode images
- The first file in each group (the one with the barcode) is used as the barcode image
- When creating inventory items, `barcode_image_url` is automatically populated with the barcode image CDN URL

## Type Updates

### `inventoryService.ts`
- Added `barcode_image_url?: string` to `InventoryItem` interface
- Added `barcode_image_url?: string` to `CreateInventoryItemData` interface

## Storage Location

Barcode images are uploaded directly to B2 storage via the `upload-to-b2` Supabase Edge Function. This is different from the media gallery workflow:

- **Barcode Images**: Direct B2 upload (no processing, no variants)
  - Path: `{itemId}/barcode_{timestamp}.{ext}`
  - CDN URL stored in `inventory_items.barcode_image_url`
  - Uses `StorageService.uploadFile()`

- **Media Gallery**: Goes through processing worker
  - Creates variants (source, display, thumb, video)
  - Stored in `auction_files` table
  - Uses `FileUploadService.uploadPCFileToWorker()`

## Usage

### Manual Item Entry
1. Fill in inventory number
2. Click "Upload Barcode" button next to inventory number field
3. Select barcode image from your computer
4. Image uploads directly to B2 (no processing needed)
5. Preview displays with upload status
6. Save item - barcode CDN URL is stored in database

### Bulk Upload
1. Upload images with barcodes
2. System automatically identifies barcode images
3. Each group's first image (barcode) is set as `barcode_image_url`
4. Other images go to the media gallery

## Visual Design
- Compact barcode preview (42px height)
- Inline with inventory number field
- Clear visual distinction from media gallery
- Green checkmark when successfully uploaded
- Red X button to remove (appears on hover)
