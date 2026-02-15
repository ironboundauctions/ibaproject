# Complete Correct Flow - Confirmed

## The Architecture (Confirmed Understanding)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAID STORAGE                                    │
│                   (Permanent Master Archive)                            │
│                                                                         │
│  Files live here permanently after upload via IronDrive webapp         │
│  Example: "abc123/photo1.jpg", "abc123/photo2.jpg"                     │
│                                                                         │
│  ↑ Upload (IronDrive Webapp)    ↓ Download (Worker for processing)    │
└─────────────────────────────────────────────────────────────────────────┘
         │                                    │
         │                                    │
         │ 1. Upload                          │ 4. Download original
         │    (via IronDrive Webapp)          │    (for processing)
         │                                    │
         ↓                                    ↓
┌──────────────────────┐           ┌──────────────────────────┐
│  IronDrive Webapp    │           │  Railway Worker          │
│                      │           │                          │
│  - User uploads      │           │  - Polls database        │
│  - Manages files     │           │  - Downloads from RAID   │
│  - Organizes folders │           │  - Processes images      │
│                      │           │  - Uploads to B2         │
└──────────────────────┘           └──────────────────────────┘
                                             │
                                             │ 5. Upload variants
                                             │    (thumb.webp, display.webp)
                                             ↓
                              ┌──────────────────────────────┐
                              │  Backblaze B2 Bucket         │
                              │  (CDN Delivery)              │
                              │                              │
                              │  - thumb.webp files          │
                              │  - display.webp files        │
                              │  - Served via CDN URL        │
                              └──────────────────────────────┘
                                             ↑
                                             │ 6. Load images
                                             │    (via CDN)
┌──────────────────────┐                     │
│  Auction Webapp      │ ←───────────────────┘
│                      │
│  2. Opens Picker     │
│     (selects files)  │ ──→ Returns source_key
│                      │
│  3. Creates DB record│ ──→ Supabase (triggers worker)
│                      │
│  7. Displays images  │ ←── Loads from CDN URLs
└──────────────────────┘
```

## Step-by-Step Breakdown

### 🔴 Step 1: Upload to RAID (IronDrive Webapp)
**Location:** IronDrive webapp (separate application)
**Actor:** Admin/User
**Action:**
- User browses to IronDrive webapp
- Drags and drops files or clicks upload
- Files are uploaded to RAID storage
- Each file gets a unique path: `userId/filename.jpg`

**Result:** Files are now on RAID storage permanently

---

### 🟡 Step 2: Select Files (Auction Webapp - IronDrive Picker)
**Location:** Auction webapp
**Actor:** Admin
**Action:**
- Admin clicks "Add Media" button
- IronDrive Picker modal opens
- Shows all files already on RAID
- Admin selects one or more files
- Picker returns source_key for each file

**What Picker Returns:**
```javascript
{
  source_key: "abc123/photo1.jpg",
  original_name: "photo1.jpg",
  mime_type: "image/jpeg",
  size: 2458394
}
```

**Key Point:** NO UPLOAD HAPPENS HERE - Just file selection!

---

### 🟢 Step 3: Create Database Record (Auction Webapp)
**Location:** Auction webapp
**Action:**
- Auction webapp receives source_key from picker
- Creates record in `auction_files` table:
```sql
INSERT INTO auction_files (
  asset_group_id,
  source_key,
  original_name,
  mime_type,
  file_size,
  variant,
  publish_status
) VALUES (
  'group-uuid',
  'abc123/photo1.jpg',
  'photo1.jpg',
  'image/jpeg',
  2458394,
  'source',
  'pending'
);
```

**Database Trigger Fires:**
- Automatically creates `media_publish_jobs` record
- Job status: `pending`
- Worker will pick this up next

---

### 🔵 Step 4: Worker Downloads from RAID
**Location:** Railway worker
**Action:**
```typescript
// Worker code
const sourceBuffer = await this.raid.downloadFile(file.source_key);
// Downloads "abc123/photo1.jpg" FROM RAID
```

**Key Point:** Worker DOWNLOADS from RAID (doesn't upload to it)

---

### 🟣 Step 5: Process and Upload to B2
**Location:** Railway worker
**Action:**
```typescript
// Process the image
const variants = await this.imageProcessor.processImage(sourceBuffer);
// Creates: thumb (400px) + display (1200px)

// Upload to B2
const { thumbUrl, displayUrl } = await this.storage.uploadVariants(
  assetGroupId,
  variants.thumb.buffer,
  variants.display.buffer
);
// Uploads to Backblaze B2 bucket
```

**Files Created on B2:**
- `assets/[asset_group_id]/thumb.webp`
- `assets/[asset_group_id]/display.webp`

**CDN URLs:**
- `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/[id]/thumb.webp`
- `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/[id]/display.webp`

**Database Updated:**
```sql
UPDATE auction_files SET
  thumb_url = 'https://cdn.../thumb.webp',
  display_url = 'https://cdn.../display.webp',
  thumb_b2_key = 'assets/[id]/thumb.webp',
  display_b2_key = 'assets/[id]/display.webp',
  publish_status = 'published',
  published_at = NOW()
WHERE id = '...';
```

---

### 🟠 Step 6 & 7: Frontend Displays Image
**Location:** Auction webapp (MediaImage component)
**Action:**
```typescript
// Component checks publish status
if (publishStatus === 'published' && displayUrl) {
  return <img src={displayUrl} />; // Load from CDN
}

// If not published, show placeholder
return <div>Processing...</div>;
```

**User sees:** Image loaded from CDN (fast, optimized)

---

## What Gets Uploaded Where - Clear Summary

| Action | Source | Destination | When | Who |
|--------|--------|-------------|------|-----|
| **Upload Original** | User's device | RAID storage | Before using auction webapp | IronDrive webapp |
| **Select File** | RAID storage | Database (source_key) | In auction webapp | IronDrive Picker |
| **Download Original** | RAID storage | Worker memory | During processing | Railway Worker |
| **Upload Variants** | Worker memory | B2/CDN | After processing | Railway Worker |
| **Display Image** | B2/CDN | User's browser | On page load | Auction webapp |

---

## Critical Confirmations

### ✅ Confirmed Correct:
1. **IronDrive Picker = Read-Only**
   - Only selects existing files
   - Does NOT upload to RAID
   - Returns source_key references

2. **Files Already on RAID**
   - Uploaded via IronDrive webapp BEFORE picker opens
   - Picker just browses existing files

3. **Worker Downloads FROM RAID**
   - Fetches original using source_key
   - Processes it
   - Uploads variants to B2

4. **Two Storage Systems:**
   - **RAID:** Original files (permanent archive)
   - **B2/CDN:** Processed variants (web delivery)

5. **Original Stays on RAID Forever**
   - Never deleted
   - Always available as source of truth

### ❌ Incorrect Understanding:
1. ~~Files uploaded to RAID through auction webapp~~
   - Files are uploaded via IronDrive webapp ONLY

2. ~~Picker uploads files~~
   - Picker only selects, doesn't upload

3. ~~Worker uploads to RAID~~
   - Worker downloads FROM RAID, uploads TO B2

4. ~~CDN falls back to RAID~~
   - No fallback implemented (shows placeholder on failure)

---

## The Upload Code in ironDriveService.ts

### Current State:
```typescript
// ironDriveService.ts - lines 181-283
async uploadInventoryImages(files: File[], ...) {
  // This uploads files to RAID
}
```

### Should This Exist?
Based on the confirmed workflow: **NO**

**Reasons:**
- IronDrive Picker should be the only integration point
- All uploads happen in IronDrive webapp
- Auction webapp should only SELECT files, not upload them

**Options:**
1. **Remove it** - Clean separation of concerns (recommended)
2. **Keep it** - If there's a valid convenience use case
3. **Disable it** - Comment out but keep for reference

**Recommended Action:** Remove upload functions and only keep:
- Picker integration
- File selection
- Database record creation
- Publishing pipeline trigger

---

## Summary Diagram

```
User → IronDrive Webapp → Upload → RAID ✓ (Original stored)
                                     ↓
Admin → Auction Webapp → Picker → Select ✓ (source_key returned)
                           ↓
                    Create DB Record ✓ (Triggers job)
                           ↓
Worker → Download from RAID ✓ (Fetches original)
         ↓
Worker → Process Image ✓ (Resize, optimize)
         ↓
Worker → Upload to B2 ✓ (thumb.webp, display.webp)
         ↓
Frontend → Load from CDN ✓ (Fast delivery)
```

**End result:**
- RAID has: `abc123/photo1.jpg` (original, unchanged)
- B2 has: `thumb.webp` + `display.webp` (optimized variants)
- User sees: Optimized image from CDN
