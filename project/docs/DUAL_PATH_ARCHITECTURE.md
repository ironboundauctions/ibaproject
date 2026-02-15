# Dual-Path Media Architecture

## Overview

The system supports **TWO ways** to add media to auction items. Both paths converge at the same publishing pipeline, ensuring consistent processing and delivery.

---

## Path 1: IronDrive Picker (Existing RAID Files)

**Use Case:** Files already uploaded to RAID via IronDrive webapp

**Flow:**
```
┌─────────────────────────────────────────────────────────┐
│ 1. Admin clicks "Add Media" in Auction Webapp          │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 2. IronDrive Picker Modal Opens                        │
│    - Shows files from RAID storage                     │
│    - Admin browses and selects files                   │
│    - Picker returns source_keys                        │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Create auction_files Records                        │
│    - Insert records with source_keys from picker       │
│    - Trigger media_publish_jobs                        │
└─────────────────────────────────────────────────────────┘
                      ↓
                [Publishing Pipeline]
                      ↓
                   [B2/CDN]
```

**Key Functions:**
- IronDrive Picker integration
- `auction_files` table insert
- Auto-trigger publish jobs

---

## Path 2: PC Upload (New Files from Computer)

**Use Case:** Admin has new files on their computer to upload

**Flow:**
```
┌─────────────────────────────────────────────────────────┐
│ 1. Admin clicks "Add Media" in Auction Webapp          │
│    - Selects "Upload from Computer"                    │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 2. File Picker Dialog Opens                            │
│    - Admin selects files from local computer           │
│    - Files loaded into browser                         │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Upload to RAID Storage                              │
│    - IronDriveService.uploadInventoryImages()          │
│    - Files uploaded to RAID via IronDrive API          │
│    - Returns source_keys for uploaded files            │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Create auction_files Records                        │
│    - Insert records with source_keys from upload       │
│    - Trigger media_publish_jobs                        │
└─────────────────────────────────────────────────────────┘
                      ↓
                [Publishing Pipeline]
                      ↓
                   [B2/CDN]
```

**Key Functions:**
- `IronDriveService.uploadInventoryImages()`
- `IronDriveService.uploadImage()`
- `auction_files` table insert
- Auto-trigger publish jobs

---

## The Common Publishing Pipeline

**Both paths converge here:**

```
┌─────────────────────────────────────────────────────────┐
│ auction_files Record Created                           │
│ - source_key: points to RAID file                     │
│ - variant: 'source'                                    │
│ - status: 'pending'                                    │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ media_publish_jobs Created (automatic trigger)         │
│ - References auction_files record                      │
│ - status: 'pending'                                    │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Railway Worker Picks Up Job                            │
│ - Polls for pending jobs                               │
│ - Finds job with status='pending'                      │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Worker Downloads Original from RAID                    │
│ - GET request to RAID download URL                     │
│ - Downloads full-quality original                      │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Worker Processes Image                                  │
│ - Creates 'thumb' variant (300px, WebP)               │
│ - Creates 'display' variant (1200px, WebP)            │
│ - Optimizes quality and size                          │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Worker Uploads Variants to B2                          │
│ - Uploads thumb.webp to B2                             │
│ - Uploads display.webp to B2                           │
│ - Gets B2 object keys                                  │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Worker Updates auction_files Records                   │
│ - Creates new rows for 'thumb' and 'display'          │
│ - Sets b2_key for each variant                         │
│ - Sets status='published'                              │
│ - Updates original record status                       │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Frontend Displays Images                                │
│ - Loads thumb/display from CDN                         │
│ - Fast delivery, optimized for web                     │
└─────────────────────────────────────────────────────────┘
```

---

## Key Differences Between Paths

| Aspect | Path 1: Picker | Path 2: PC Upload |
|--------|----------------|-------------------|
| **Source** | RAID (already there) | Local computer |
| **Upload Step** | None (file exists) | Upload to RAID |
| **source_key Origin** | From picker selection | From upload response |
| **Upload Function** | N/A | `uploadInventoryImages()` |
| **RAID Storage** | Already uploaded | Uploaded during flow |
| **After source_key** | **IDENTICAL** | **IDENTICAL** |

---

## Storage Architecture

### RAID Storage (IronDrive)
- **Purpose:** Master archive, permanent storage
- **Contains:** Original high-quality files
- **Uploaded By:**
  - IronDrive webapp (Path 1)
  - Auction webapp (Path 2)
- **Accessed By:** Railway worker for processing
- **Retention:** Permanent (never deleted)

### B2 Storage + CDN
- **Purpose:** Web delivery, optimized variants
- **Contains:** thumb.webp, display.webp
- **Uploaded By:** Railway worker only
- **Accessed By:** Public via CDN
- **Retention:** Until detached + 30 days

### Supabase Database
- **Purpose:** Metadata and relationships
- **Contains:** File references, status, relationships
- **Tables:** `auction_files`, `media_publish_jobs`

---

## Code Examples

### Path 1: Using IronDrive Picker

```typescript
// Open picker modal
const pickerResult = await openIronDrivePicker({
  multiSelect: true,
  fileTypes: ['image/*']
});

// Get source_keys from picker
const sourceKeys = pickerResult.files.map(f => f.source_key);

// Create auction_files records
for (const sourceKey of sourceKeys) {
  await supabase.from('auction_files').insert({
    lot_id: lotId,
    source_key: sourceKey,
    variant: 'source',
    status: 'pending',
    asset_group_id: uuidv4()
  });
}

// Publishing jobs auto-created by trigger
```

### Path 2: Uploading from PC

```typescript
// User selects files from computer
const files: File[] = await selectFilesFromPC();

// Upload to RAID
const uploadResult = await IronDriveService.uploadInventoryImages(
  files,
  inventoryNumber,
  0, // main image index
  (progress) => {
    console.log(`Upload progress: ${progress.percent}%`);
  }
);

// Get source_keys from upload response
const mainSourceKey = uploadResult.mainImageUrl;
const additionalSourceKeys = uploadResult.additionalImageUrls;

// Create auction_files records (same as Path 1)
await supabase.from('auction_files').insert({
  lot_id: lotId,
  source_key: mainSourceKey,
  variant: 'source',
  status: 'pending',
  asset_group_id: uuidv4()
});

// Publishing jobs auto-created by trigger
```

---

## Important Rules

### Rule 1: RAID is Master Archive
- All originals stored on RAID permanently
- Whether from picker or PC upload
- Never deleted, even after detachment

### Rule 2: Both Paths Use Same Pipeline
- After getting source_key, flow is identical
- Worker processes all files the same way
- Publishing pipeline doesn't care about origin

### Rule 3: B2/CDN for Web Delivery
- All public serving from B2/CDN
- RAID not directly accessed by frontend
- Worker downloads from RAID, uploads to B2

### Rule 4: Soft Delete Only
- Setting `detached_at` marks for cleanup
- B2 variants cleaned after 30 days
- RAID originals never touched

---

## UI Considerations

### "Add Media" Button Options

When admin clicks "Add Media", they should see:

```
┌─────────────────────────────────────────┐
│          Add Media to Item              │
├─────────────────────────────────────────┤
│                                         │
│  [📁 Select from IronDrive]            │
│  Opens picker to browse existing files  │
│                                         │
│  [💻 Upload from Computer]             │
│  Select new files from your device      │
│                                         │
└─────────────────────────────────────────┘
```

### Progress Indicators

**Path 1 (Picker):**
- Selection modal
- "Attaching files..." after selection

**Path 2 (PC Upload):**
- File selection dialog
- Upload progress bar
- "Uploading to storage..."
- "Processing and publishing..."

---

## Summary

**The Big Picture:**
- Two ways IN (picker or PC upload)
- One way THROUGH (publishing pipeline)
- One way OUT (B2/CDN delivery)

**Storage Flow:**
```
PC Files → RAID → Worker Processing → B2/CDN → Frontend
          ↑
    Picker Files
```

**Key Insight:**
The system doesn't care WHERE the source_key came from. Once you have a source_key pointing to a RAID file, the rest is automatic and identical for both paths.
