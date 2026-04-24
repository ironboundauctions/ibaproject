# Barcode Scanner Setup Instructions

## Installation Required

The barcode scanner feature requires the `@zxing/library` package. This package is already added to `package.json`, but you need to install it on your local machine.

## Steps to Fix

1. **Stop your dev server** (if it's running) by pressing `Ctrl+C`

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Restart your dev server**:
   ```bash
   npm run dev
   ```

That's it! The barcode scanner should now work.

## What Was Added

- ✅ `@zxing/library` added to package.json
- ✅ BarcodeScanner utility created
- ✅ Scan button added to barcode field
- ✅ Barcode images now upload to Supabase storage bucket
- ✅ Auto-fill inventory number from scanned barcode

## Testing the Feature

1. Edit or create an inventory item
2. Upload a barcode image to the "Barcode/Inventory Sticker" field
3. Click the "Scan" button
4. The inventory number should auto-fill with the decoded barcode value

## Troubleshooting

If you still see the error after running `npm install`:
- Make sure you're in the project directory
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again
- Clear browser cache and restart dev server
