# Architecture Confirmed - Dual Path Media System

## Executive Summary

The system supports **TWO PATHS** for adding media to auction items:

1. **IronDrive Picker Path:** Select existing files from RAID storage
2. **PC Upload Path:** Upload new files from computer to RAID storage

Both paths converge at the same publishing pipeline, ensuring all files go through identical processing and end up on B2/CDN for web delivery.

---

## Critical Understanding

### What We Know Now

**BOTH paths are correct and needed:**

```
PATH 1 (Picker):
User → IronDrive Picker → Select RAID file → source_key → Publishing Pipeline

PATH 2 (PC Upload):
User → Select PC file → Upload to RAID → source_key → Publishing Pipeline

BOTH CONVERGE:
source_key → auction_files → media_publish_jobs → Worker → B2/CDN
```

### Key Insight

Once you have a `source_key` pointing to a RAID file, **the system doesn't care where it came from**. The publishing pipeline is identical for both paths.

---

## Architecture Components

### 1. Frontend (Auction Webapp)

**Responsibilities:**
- Provide TWO options for adding media:
  - "Select from IronDrive" (opens picker)
  - "Upload from Computer" (local file selection)
- Create `auction_files` records with source_keys
- Display processed images from B2/CDN

**Key Functions:**
- `IronDriveService.uploadInventoryImages()` - PC upload
- `IronDriveService.uploadImage()` - Single file PC upload
- IronDrive Picker integration - File selection
- Database operations - Create auction_files records

### 2. RAID Storage (IronDrive)

**Purpose:** Master archive, permanent storage

**Receives Files From:**
- IronDrive webapp (Path 1 - pre-upload)
- Auction webapp (Path 2 - PC upload)

**Provides Files To:**
- Railway worker (for processing)

**Characteristics:**
- Permanent storage (never deleted)
- High-quality originals
- Single source of truth

### 3. Worker Service (Railway)

**Purpose:** Process originals and publish variants

**Process:**
1. Poll for pending `media_publish_jobs`
2. Download original from RAID
3. Create optimized variants (thumb, display)
4. Upload variants to B2
5. Update database with published URLs

**Key Point:** Worker doesn't know or care if file came from picker or PC upload. It just downloads from RAID and processes.

### 4. B2 Storage + CDN

**Purpose:** Web delivery, optimized for speed

**Contains:**
- `thumb.webp` - 300px thumbnails
- `display.webp` - 1200px display images

**Characteristics:**
- Public-facing via CDN
- Optimized for web (WebP, compressed)
- Created by worker only

### 5. Database (Supabase)

**Tables:**

**`auction_files`:**
- Tracks all file records (source + variants)
- Links files to lots/inventory
- Contains status, URLs, metadata
- Soft delete via `detached_at`

**`media_publish_jobs`:**
- Queue for worker processing
- Status tracking (pending, processing, published)
- Auto-created by trigger when auction_files inserted

---

## The Complete Flows

### Path 1: IronDrive Picker

```
┌─────────────────────────────────────────────────┐
│ PRE-STEP: Files Already on RAID                │
│ - Uploaded via IronDrive webapp previously     │
│ - This happens OUTSIDE auction webapp          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 1. Admin Opens Picker                           │
│    - Clicks "Add Media" → "Select from Drive"  │
│    - IronDrive Picker modal opens               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Admin Selects Files                          │
│    - Browses RAID storage                       │
│    - Selects one or more files                  │
│    - Picker returns source_keys                 │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Create auction_files Records                 │
│    - Insert with source_key from picker        │
│    - variant='source', status='pending'         │
│    - Trigger creates media_publish_jobs         │
└─────────────────────────────────────────────────┘
                    ↓
        [Publishing Pipeline - Same for Both]
```

### Path 2: PC Upload

```
┌─────────────────────────────────────────────────┐
│ 1. Admin Selects Files from Computer            │
│    - Clicks "Add Media" → "Upload from PC"     │
│    - Browser file picker opens                  │
│    - Selects files from local drive             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Upload to RAID                               │
│    - IronDriveService.uploadInventoryImages()  │
│    - XHR with progress tracking                 │
│    - Files sent to IronDrive API                │
│    - Stored on RAID permanently                 │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Get source_keys from Upload Response         │
│    - Upload API returns file metadata           │
│    - Extract source_keys for uploaded files     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Create auction_files Records                 │
│    - Insert with source_key from upload        │
│    - variant='source', status='pending'         │
│    - Trigger creates media_publish_jobs         │
└─────────────────────────────────────────────────┘
                    ↓
        [Publishing Pipeline - Same for Both]
```

### Publishing Pipeline (Common to Both Paths)

```
┌─────────────────────────────────────────────────┐
│ 1. Database Trigger Fires                       │
│    - New auction_files record inserted          │
│    - Trigger creates media_publish_jobs         │
│    - Job status='pending'                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Worker Polls for Jobs                        │
│    - Checks media_publish_jobs table            │
│    - Finds pending jobs                         │
│    - Claims job (status='processing')           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Worker Downloads Original from RAID          │
│    - Uses source_key to build download URL      │
│    - GET request to RAID                        │
│    - Receives high-quality original             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Worker Creates Variants                      │
│    - Resize to 300px → thumb.webp              │
│    - Resize to 1200px → display.webp           │
│    - Optimize compression                       │
│    - Convert to WebP format                     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 5. Worker Uploads Variants to B2                │
│    - Upload thumb.webp                          │
│    - Upload display.webp                        │
│    - Get B2 object keys                         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 6. Worker Updates Database                      │
│    - Create auction_files records for variants │
│    - Set b2_key for each variant                │
│    - Set status='published'                     │
│    - Mark job as completed                      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 7. Frontend Displays Images                     │
│    - Query auction_files for published variants│
│    - Build CDN URLs from b2_keys                │
│    - Display thumb in lists                     │
│    - Display full image in detail view          │
└─────────────────────────────────────────────────┘
```

---

## Code Implementation

### ironDriveService.ts Functions

#### For Path 2 (PC Upload):

```typescript
// Upload multiple images with progress tracking
static async uploadInventoryImages(
  files: File[],
  inventoryNumber: string,
  mainImageIndex: number = 0,
  onProgress?: (progress) => void
): Promise<{
  mainImageUrl: string;
  additionalImageUrls: string[];
  errors: string[]
}>
```

```typescript
// Upload single image
static async uploadImage(
  file: File,
  inventoryNumber: string,
  imageIndex: number = 0,
  isMainImage: boolean = false
): Promise<{
  success: boolean;
  url?: string;
  filename?: string;
  error?: string
}>
```

```typescript
// Helper for XHR upload with progress
private static uploadWithProgress(
  url: string,
  formData: FormData,
  userId: string,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; status: number; data?: any; errorText?: string }>
```

#### For Path 1 (Picker):

IronDrive Picker is a separate integration (not in ironDriveService)

#### For Both Paths:

```typescript
// Check RAID availability
static async checkHealth(): Promise<{
  success: boolean;
  message: string;
  raidAvailable: boolean
}>

// Get CDN URL for B2 file
static getCdnUrl(b2_key: string): string

// Soft delete media
static async deleteFile(
  asset_group_id: string,
  item_id?: string
): Promise<{ success: boolean; error?: string }>

// Get reference count
static async getReferenceCount(source_key: string): Promise<number>

// Test connection
static async testConnection(): Promise<{
  success: boolean;
  message: string
}>

// Check if RAID available
static isRaidAvailable(): boolean

// Get RAID state
static getRaidState(): RaidState
```

---

## Storage Comparison

| Storage | Path 1 (Picker) | Path 2 (PC Upload) | Publishing | Display |
|---------|-----------------|-------------------|------------|---------|
| **RAID** | ✅ Pre-uploaded | ✅ Uploaded by auction webapp | ❌ Downloaded from | ❌ Not used |
| **B2/CDN** | ❌ Not involved | ❌ Not involved | ✅ Uploaded to | ✅ Served from |
| **Supabase** | ✅ Records created | ✅ Records created | ✅ Updated | ✅ Queried |

---

## UI/UX Design

### "Add Media" Button

Should provide BOTH options:

```
┌──────────────────────────────────────────┐
│         Add Media to Item                │
├──────────────────────────────────────────┤
│                                          │
│  📂 Select from IronDrive                │
│  Browse and select existing files        │
│                                          │
│  💻 Upload from Computer                 │
│  Upload new files from your device       │
│                                          │
└──────────────────────────────────────────┘
```

### Progress Indicators

**Path 1 (Picker):**
- "Opening file browser..."
- "Attaching files..."

**Path 2 (PC Upload):**
- "Uploading to storage... 45%"
- "Processing and publishing..."

---

## Important Rules

### 1. RAID is Permanent Archive
- All originals stored on RAID forever
- Never deleted, even after detachment
- Single source of truth for originals

### 2. Both Paths Use Same Pipeline
- After source_key obtained, flow is identical
- Worker doesn't distinguish between paths
- Publishing logic completely path-agnostic

### 3. B2/CDN for Web Delivery
- All public serving from B2/CDN only
- RAID never directly accessed by frontend
- Worker bridges RAID → B2

### 4. Soft Delete Only
- `detached_at` marks for cleanup
- B2 variants cleaned after 30 days
- RAID originals remain untouched

### 5. Status Tracking
- `auction_files.status`: pending → published
- `media_publish_jobs.status`: pending → processing → completed/failed
- Frontend shows appropriate states

---

## Benefits of Dual Path

### Path 1 (Picker) Benefits:
- No re-upload of existing files
- Faster workflow for pre-uploaded content
- Reuse files across multiple items
- Centralized file management in IronDrive

### Path 2 (PC Upload) Benefits:
- Quick one-step upload
- No need to switch to IronDrive webapp
- Integrated workflow within auction management
- Convenient for new content

### Why Both?
- Different use cases require different approaches
- Users can choose most efficient method
- Flexibility increases productivity
- Both converge to same reliable pipeline

---

## Summary

**Two ways IN:**
1. Picker selection (existing files)
2. PC upload (new files)

**One way THROUGH:**
- Publishing pipeline processes all files identically

**One way OUT:**
- B2/CDN delivers all variants

**The system is path-agnostic after source_key is obtained.**

---

## Documentation References

For more details, see:
- `DUAL_PATH_ARCHITECTURE.md` - Complete dual-path explanation
- `UPLOAD_FUNCTIONS_REMOVED.md` - Status of upload functions (restored)
- `MEDIA_PUBLISHING_SYSTEM.md` - Publishing pipeline details
- `RAID_INTEGRATION_RULES.md` - RAID interaction rules

---

## Status

✅ Upload functions restored to ironDriveService.ts
✅ Dual-path architecture documented
✅ Build successful
✅ Both paths understood and confirmed

**Next:** Implement IronDrive Picker integration alongside existing PC upload functionality.
