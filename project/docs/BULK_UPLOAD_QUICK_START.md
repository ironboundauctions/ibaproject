# Bulk Upload Quick Start

Upload multiple barcode-labeled images at once and automatically create inventory items grouped by barcode number.

## What This Should Do (Per Original Plan)

1. User selects images with barcodes
2. **Analysis Worker scans for barcodes FIRST (no upload yet)**
3. Files are automatically grouped by inventory number
4. User reviews/edits the groups in confirmation modal
5. **User confirms → THEN Processing Worker uploads to B2**
6. Creates inventory items with files attached

## Current Implementation Status

**WARNING: Current code uploads files BEFORE analysis, which is backwards!**

The plan specified:
- Analyze first (send file buffers to Analysis Worker)
- Show results for user confirmation
- Only upload confirmed files

Current code does:
- Upload to B2 first
- Then download from B2 to analyze
- Wastes bandwidth/storage for unconfirmed files

## How It Should Work (Per Plan)

```
Select Files → Analysis Worker Scans Barcodes → Group by Number → User Confirms → Upload to B2 → Create Items
```

**Step by step:**
1. **File Selection**: User picks images from disk
2. **Analysis Phase**: Send file buffers to Analysis Worker via POST /api/analyze-batch
3. **Barcode Scanning**: Worker uses @zxing/library to scan QR codes and extract inventory numbers
4. **Grouping**: Worker returns `{grouped: [...], ungrouped: [...], errors: [...]}`
5. **Confirmation Modal**: User reviews, reorganizes groups, removes unwanted files
6. **Upload Phase**: Send confirmed files to Processing Worker in chunks of 5
7. **Processing**: Worker uploads to B2 and creates all variants (source, display, thumb)
8. **Item Creation**: Create inventory_items and link auction_files

## Prerequisites

- Processing worker deployed on Railway
- Analysis worker deployed on Railway (lightweight, no Sharp - just barcode scanning)
- B2 storage configured
- Worker URLs in `.env`

## Configuration

```env
VITE_WORKER_URL=https://your-processing-worker.railway.app
VITE_ANALYSIS_WORKER_URL=https://your-analysis-worker.railway.app
```

## Key Differences from Current Implementation

| What Plan Says | What Code Does | Issue |
|----------------|----------------|-------|
| Send file buffers to analysis | Upload to B2, then analyze | Wastes storage |
| Analyze in memory | Download from B2 to analyze | Wastes bandwidth |
| Only upload confirmed files | Upload all, delete rejected | Inefficient |
| Fast feedback (seconds) | Slower (double transfer) | Poor UX |

## Correct Architecture (Per Plan)

**Analysis Worker:**
- Receives multipart form data with file buffers
- Uses @zxing/library for barcode scanning
- NO image processing (no Sharp dependency)
- NO B2 access needed
- Returns JSON with grouping results
- Lightweight: 256MB RAM sufficient

**Processing Worker:**
- Receives confirmed files ONLY
- Uploads to B2 in chunks of 5 parallel
- Creates variants using Sharp
- Returns CDN URLs
- Heavy lifting happens AFTER confirmation

## Benefits of Correct Flow

1. **Fast Feedback**: Barcode results in 5-10 seconds (no upload/download)
2. **Cost Efficient**: Only upload confirmed files
3. **Bandwidth**: No wasted transfers for rejected files
4. **Storage**: No temp files cluttering B2
5. **User Experience**: See results immediately

## What Needs Fixing

The `bulkUploadService.ts` flow needs to be reversed:

**Current (wrong):**
```typescript
uploadFiles() → analyzeBatch() → confirm → (files already uploaded)
```

**Correct:**
```typescript
analyzeBatch(fileBuffers) → confirm → uploadFiles(confirmedFiles)
```

## Testing (Once Fixed)

1. Open Global Inventory → Bulk Upload
2. Select 10 images with QR codes
3. **Verify**: Analysis starts immediately (no upload progress)
4. **Verify**: Grouped results appear in ~10 seconds
5. Reorganize groups as needed
6. Click confirm
7. **Verify**: NOW upload progress shows
8. Files appear attached to new inventory items

## Support

See full documentation:
- Original plan above (shows correct architecture)
- `docs/BULK_UPLOAD_IMPLEMENTATION_SUMMARY.md` - Current (incorrect) implementation
- `analysis-worker/` - Worker that should receive file buffers, not CDN URLs

## Next Steps

1. Fix `bulkUploadService.ts` to send file buffers to analysis worker BEFORE upload
2. Fix Analysis Worker endpoint to receive and scan file buffers directly
3. Move upload phase to AFTER confirmation
4. Test with 100+ images to verify efficiency gains

The plan was right - we just implemented it backwards!
