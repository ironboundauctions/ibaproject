# Upload Functions Status - RESTORED

## Update: Functions Were Restored

These functions were initially removed but have been **RESTORED** after clarification of the dual-path architecture.

## What Was Temporarily Removed (Now Restored)

The following functions were restored to `src/services/ironDriveService.ts` because they ARE needed for the PC upload path:

### Removed Functions:

1. **`uploadWithProgress()`**
   - Helper function for uploading files with XHR progress tracking
   - Used to upload files directly to RAID from auction webapp

2. **`uploadInventoryImages()`**
   - Uploaded multiple images to RAID storage
   - Returned main image URL and additional image URLs
   - Included progress callbacks

3. **`uploadImage()`**
   - Uploaded a single image to RAID storage
   - Wrapper around `uploadInventoryImages()`

4. **`createFolder()`**
   - Created folders in RAID storage
   - Used for organizing uploaded files

### Why Were They Initially Removed?

Initial misunderstanding: Thought ONLY picker selection was needed.

### Why Were They Restored?

The system actually supports **TWO paths** for adding media:

**Path 1: IronDrive Picker (Existing Files):**
```
IronDrive Webapp → Upload files → RAID storage
                                     ↓
Auction Webapp → Picker → Select existing files → Publishing pipeline
```

**Path 2: PC Upload (New Files):**
```
Auction Webapp → Upload from PC → RAID storage → Publishing pipeline
```

**Key Points:**
- BOTH paths are valid and needed
- BOTH paths upload originals to RAID storage
- BOTH paths go through the SAME publishing pipeline
- After getting source_key, the flow is IDENTICAL
- Difference is only WHERE the source_key comes from (picker vs upload)

---

## Components Status

The following components reference the upload functions and are **CORRECT AS-IS** for Path 2 (PC Upload):

### 1. `src/components/InventoryItemForm.tsx`

**Current Code (line ~151):**
```typescript
const uploadResult = await IronDriveService.uploadInventoryImages(
  filesToUpload,
  formData.inventory_number,
  mainFileIndex,
  // progress callback
);
```

**Status:** ✅ CORRECT - This handles PC upload (Path 2)

**Enhancement Needed:**
- Add option to use IronDrive Picker (Path 1) alongside PC upload
- Let user choose between "Select from IronDrive" or "Upload from PC"

---

### 2. `src/components/CreateAuctionModal.tsx`

**Current Code (line ~66):**
```typescript
const uploadPromise = IronDriveService.uploadInventoryImages(
  files,
  inventoryNumber,
  primaryImageIndex
);
```

**Status:** ✅ CORRECT - This handles PC upload (Path 2)

**Enhancement Needed:**
- Add IronDrive Picker option (Path 1)
- Both options should coexist

---

### 3. `src/components/BulkInventoryUploadForm.tsx`

**Current Code (line ~241):**
```typescript
const uploadResult = await IronDriveService.uploadInventoryImages(
  batch,
  item.inventoryNumber,
  isFirstBatch ? 0 : -1
);
```

**Status:** ✅ CORRECT - This handles bulk PC upload (Path 2)

**Enhancement Needed:**
- Consider adding bulk picker selection (Path 1)
- Could allow selecting multiple existing files for multiple items

---

## Remaining Functions (Still Available)

These functions were kept because they fit the new architecture:

### `checkHealth()`
```typescript
static async checkHealth(): Promise<{
  success: boolean;
  message: string;
  raidAvailable: boolean
}>
```
- Checks if RAID storage is available
- Verifies connection to IronDrive API

### `getReferenceCount()`
```typescript
static async getReferenceCount(source_key: string): Promise<number>
```
- Gets count of auction_files referencing a specific RAID file
- Useful for managing file references

### `deleteFile()`
```typescript
static async deleteFile(
  asset_group_id: string,
  item_id?: string
): Promise<{ success: boolean; error?: string }>
```
- Soft deletes media (sets detached_at timestamp)
- Never deletes RAID originals (they're permanent)
- Only marks as detached for cleanup

### `getCdnUrl()`
```typescript
static getCdnUrl(b2_key: string): string
```
- Generates CDN URL for B2-hosted files
- Used to get public URLs for thumb/display variants

### `testConnection()`
```typescript
static async testConnection(): Promise<{
  success: boolean;
  message: string
}>
```
- Convenience method that calls checkHealth()

### `isRaidAvailable()`
```typescript
static isRaidAvailable(): boolean
```
- Checks if RAID is currently available
- Returns cached state

### `getImageUrl()`
```typescript
static getImageUrl(productId: string, filename: string): string
```
- Gets display URL for a product image
- Returns CDN URL for display variant

### `getRaidState()`
```typescript
static getRaidState(): RaidState
```
- Returns current RAID state
- Includes provider, download base, last checked timestamp

---

## Recommended Actions

### Immediate (For Build Compatibility):
✅ **DONE** - Upload functions restored to ironDriveService.ts
✅ **DONE** - Build compiles successfully
✅ **DONE** - Dual-path architecture documented

### Next Steps (For Functionality):
1. **Add IronDrive Picker Option to InventoryItemForm.tsx**
   - Keep existing PC upload (Path 2) ✅
   - Add picker option (Path 1)
   - Let user choose between both methods

2. **Add IronDrive Picker Option to CreateAuctionModal.tsx**
   - Keep existing PC upload (Path 2) ✅
   - Add picker option (Path 1)
   - Support both workflows

3. **Review BulkInventoryUploadForm.tsx**
   - Keep bulk PC upload (Path 2) ✅
   - Consider adding bulk picker selection (Path 1)
   - Both methods valuable for different use cases

4. **Test Both Paths**
   - **Path 1:** Picker → source_key → auction_files → publish
   - **Path 2:** PC Upload → RAID → source_key → auction_files → publish
   - Verify both paths trigger publishing pipeline
   - Confirm worker processes files from both paths
   - Check B2 upload works for both paths

---

## The Dual-Path Flow (Reference)

### PATH 1: IronDrive Picker

```
┌──────────────────────────────────────────────────────┐
│ Step 1: Upload to RAID (IronDrive Webapp)           │
│ - Happens BEFORE using auction webapp               │
│ - Files stored on RAID permanently                  │
└──────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────┐
│ Step 2: Select Files (Auction Webapp - Picker)      │
│ - Admin clicks "Select from IronDrive"              │
│ - IronDrive Picker modal opens                      │
│ - Shows existing RAID files                         │
│ - Admin selects files                               │
│ - Picker returns source_keys                        │
└──────────────────────────────────────────────────────┘
                    ↓
         [COMMON PUBLISHING PIPELINE]
```

### PATH 2: PC Upload

```
┌──────────────────────────────────────────────────────┐
│ Step 1: Select Files from Computer                  │
│ - Admin clicks "Upload from Computer"               │
│ - Browser file picker opens                         │
│ - Admin selects files from local PC                 │
└──────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────┐
│ Step 2: Upload to RAID (via IronDrive API)          │
│ - IronDriveService.uploadInventoryImages()          │
│ - Files uploaded to RAID storage                    │
│ - Returns source_keys for uploaded files            │
└──────────────────────────────────────────────────────┘
                    ↓
         [COMMON PUBLISHING PIPELINE]
```

### COMMON PUBLISHING PIPELINE (Both Paths)

```
┌──────────────────────────────────────────────────────┐
│ Step 3: Create Database Records                     │
│ - Auction webapp creates auction_files records      │
│ - Uses source_keys (from picker OR upload)          │
│ - Triggers media_publish_jobs                       │
└──────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────┐
│ Step 4: Worker Processing                           │
│ - Downloads original FROM RAID                      │
│ - Processes image (resize, optimize)                │
│ - Uploads variants TO B2                            │
└──────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────┐
│ Step 5: Display                                      │
│ - Frontend loads from CDN URLs                      │
│ - Fast, optimized delivery                          │
└──────────────────────────────────────────────────────┘
```

---

## Storage Summary

| Storage | Contains | Updated By | Purpose |
|---------|----------|------------|---------|
| **RAID** | Original files | IronDrive webapp OR Auction webapp (PC upload) | Permanent archive |
| **B2/CDN** | Optimized variants | Railway worker | Web delivery |
| **Supabase** | Metadata & references | Auction webapp | Track relationships |

**Critical:** Auction webapp can BOTH select from RAID (picker) AND upload to RAID (PC upload). Both paths are valid!
