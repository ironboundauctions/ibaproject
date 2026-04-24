# Barcode Scanner Feature

## Changes Made

### 1. Fixed Barcode Image Upload
- **Problem**: Barcode images were being uploaded through the B2 edge function designed for media processing, causing errors
- **Solution**: Changed to use Supabase storage bucket (`auction-files`) for direct, simple uploads
- **Path**: Barcode images are stored in `barcodes/{itemId}/{filename}`

### 2. Added Barcode Scanner
- **Library**: Installed `@zxing/library` - a lightweight JavaScript barcode scanning library
- **Functionality**: Scans Code 128 and other common barcode formats from images
- **Auto-fill**: Automatically fills the inventory number field when barcode is detected

### 3. UI Changes
- **Barcode field** now spans 2 columns for better layout
- **Scan button** appears next to barcode image after upload
- **Visual feedback**: Shows "Scanning..." state while processing
- **Error handling**: Clear error messages if barcode cannot be detected

## How to Use

1. **Upload a barcode image**: Click "Upload Barcode Image" and select an image containing a barcode
2. **Scan the barcode**: Click the "Scan" button next to the barcode image
3. **Auto-fill**: The inventory number field will automatically populate with the scanned barcode value
4. **Manual entry**: If scan fails or is incorrect, manually edit the inventory number field

## Technical Details

### New Files
- `src/utils/barcodeScanner.ts` - Barcode scanning utility using ZXing library

### Modified Files
- `src/components/InventoryItemFormNew.tsx` - Added scan button and updated upload logic
- Created new migration for `auction-files` storage bucket with proper RLS policies

### Storage Bucket
- **Name**: `auction-files`
- **Public**: Yes (for CDN access)
- **Size limit**: 50MB
- **Allowed types**: Images (JPEG, PNG, GIF, WebP) and Videos (MP4, MOV, AVI, WebM)
- **RLS**: Authenticated users can upload/update/delete, public can read

## Supported Barcode Formats

ZXing library supports:
- Code 128 (most common for inventory)
- QR Code
- EAN-13
- UPC-A
- Code 39
- And many more...

## Notes

- Barcode scanning happens client-side (no server required)
- Works with both uploaded files and existing URLs
- Fast and lightweight
- No additional API costs
