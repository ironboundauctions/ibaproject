# Barcode Analysis Worker

REST API service for scanning barcodes and QR codes from images during bulk upload.

## Purpose

This worker scans images for barcodes/QR codes BEFORE they are uploaded to storage. It helps automatically group images by inventory number during the bulk upload process.

**Important**: IronDrive is just a file picker (like Dropbox or PC upload) - NOT an API service. All barcode scanning happens locally in this worker using ZXing and jsQR libraries.

## Features

- Scans images for barcodes and QR codes
- Supports multiple barcode formats (CODE_128, CODE_39, EAN, UPC, QR, etc.)
- Multiple detection strategies for better accuracy
- Processes batches of images efficiently
- Returns grouping suggestions based on detected inventory numbers

## Environment Variables

Optional environment variables:

```env
PORT=8080
```

## Railway Deployment

1. Create a new Railway project
2. Add the `PORT` environment variable (optional, defaults to 8080)
3. Deploy from the `analysis-worker` directory

## Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## API Endpoints

### POST /api/analyze-batch

Analyzes a batch of images for barcodes.

**Request**: multipart/form-data with files
**Response**:
```json
{
  "grouped": [
    {
      "inv_number": "ABC123",
      "files": [
        { "fileName": "img1.jpg", "assetGroupId": "temp_123_0" },
        { "fileName": "img2.jpg", "assetGroupId": "temp_123_1" }
      ]
    }
  ],
  "ungrouped": [
    { "fileName": "img3.jpg", "assetGroupId": "temp_123_2" }
  ],
  "errors": []
}
```

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-31T...",
  "service": "barcode-analysis-worker"
}
```

## How It Works

1. Frontend sends image file buffers to `/api/analyze-batch`
2. Worker scans each image using:
   - ZXing library (for various 1D/2D barcodes)
   - jsQR library (QR code fallback)
   - Multiple preprocessing strategies (original, grayscale, enhanced)
3. Groups images by detected barcode value
4. Returns grouping suggestions to frontend
5. User reviews and confirms groups before upload
