# Important Clarifications

## 1. No RAID Fallback in Frontend

**Question:** Does the MediaImage component fall back to RAID when CDN fails?

**Answer:** **NO** - There is currently no RAID fallback implemented.

### Current Behavior:
```typescript
// MediaImage.tsx
if (publishStatus === 'published' && cdnUrl && !imageError) {
  return <img src={cdnUrl} />;  // Show CDN image
}

// Show placeholder (no RAID fallback)
return <div>Processing... / Image Unavailable</div>;
```

**When CDN image fails:**
- Component shows "Image Unavailable" placeholder
- Does NOT attempt to load from RAID
- User sees placeholder until image is successfully published to CDN

**Why no fallback?**
- RAID is not designed for public web serving
- RAID requires authentication headers (`X-Auction-Publisher` secret)
- CDN is the only public delivery method
- Images should always go through the publishing pipeline

### Original Plan:
The original architecture had RAID fallback, but current implementation does NOT include it. If RAID fallback is needed, it would require:

1. Adding RAID URL construction in frontend
2. Implementing authentication for RAID requests (secure secret handling)
3. CORS configuration on RAID endpoint
4. Logic to retry with RAID URL on CDN failure

---

## 2. File Upload Location: IronDrive Webapp vs Auction Webapp

**Question:** Where do users upload files?

**Answer:** Files are uploaded in **IronDrive webapp** (separate application), NOT in the auction webapp.

### How It Works:

#### IronDrive Webapp (Separate App)
- **Purpose:** File management and upload system
- **Users:** Anyone with IronDrive access
- **Actions:**
  - Upload files to RAID storage
  - Organize files in folders
  - Manage file permissions
  - Delete files
- **URL:** Separate domain/app (e.g., `irondrive.example.com`)

#### Auction Webapp (This Project)
- **Purpose:** Auction and inventory management
- **Users:** Auction admins and staff
- **Actions:**
  - Opens IronDrive Picker (file browser)
  - Selects **existing** files from RAID
  - Associates files with lots/inventory
  - Triggers publishing to CDN
- **URL:** `auction.ibaproject.bid` (or similar)

### The Complete Flow:

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Upload to RAID (happens in IronDrive Webapp)           │
└─────────────────────────────────────────────────────────────────┘
  Admin opens IronDrive Webapp → Uploads file → Stored in RAID
  File location: "abc123/photo.jpg" on RAID storage
  ↓

┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Select File (happens in Auction Webapp)                │
└─────────────────────────────────────────────────────────────────┘
  Admin opens Auction Webapp → Clicks "Add Media"
  ↓
  IronDrive Picker opens (modal/iframe)
  Shows existing RAID files
  ↓
  Admin selects file → Picker returns: source_key "abc123/photo.jpg"
  ↓

┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Database Record (happens in Supabase)                  │
└─────────────────────────────────────────────────────────────────┘
  Auction webapp creates auction_files record:
  {
    source_key: "abc123/photo.jpg",  ← Points to RAID file
    publish_status: "pending",
    variant: "source"
  }
  ↓
  Database trigger creates media_publish_jobs record
  ↓

┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Worker Processing (happens on Railway)                 │
└─────────────────────────────────────────────────────────────────┘
  Worker polls database → Finds new job
  ↓
  Downloads original FROM RAID (source_key: "abc123/photo.jpg")
  ↓
  Processes image:
    - Creates thumbnail (400px)
    - Creates display version (1200px)
    - Optimizes/compresses
  ↓

┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Upload to B2/CDN (happens in Worker)                   │
└─────────────────────────────────────────────────────────────────┘
  Worker uploads to Backblaze B2:
    - thumb.webp → B2 bucket
    - display.webp → B2 bucket
  ↓
  Updates auction_files record:
  {
    source_key: "abc123/photo.jpg",  ← Still on RAID (unchanged)
    thumb_url: "https://cdn.../thumb.webp",  ← New B2 CDN URL
    display_url: "https://cdn.../display.webp",  ← New B2 CDN URL
    publish_status: "published"
  }
```

### Key Points:

1. **Files are ALREADY on RAID before picker opens**
   - Uploaded via IronDrive webapp
   - Picker just selects them (doesn't upload)

2. **Worker downloads FROM RAID**
   - Fetches original using source_key
   - Processes it
   - Uploads variants to B2

3. **Original stays on RAID forever**
   - RAID = permanent archive
   - Never deleted
   - B2 = optimized variants for web delivery

4. **Two copies exist:**
   - **RAID:** Original file (master copy)
   - **B2/CDN:** Processed variants (web-optimized)

5. **Picker does NOT upload to RAID**
   - Picker is read-only
   - Only selects existing files
   - Returns source_key reference

---

## What Gets Uploaded Where

This is the critical distinction:

### Files Selected in Picker:
❌ **DO NOT** get uploaded to RAID
✅ **DO** get downloaded FROM RAID by worker
✅ **DO** get processed and uploaded to B2 by worker

### The Data Flow:

```
Original File Location:
  RAID Storage (already there)
  ↓
Picker Action:
  Returns reference: "abc123/photo.jpg"
  (No upload happens here)
  ↓
Worker Action:
  1. Downloads FROM RAID: "abc123/photo.jpg"
  2. Processes image (resize, optimize, convert)
  3. Uploads TO B2: "thumb.webp" + "display.webp"
  ↓
Final State:
  - RAID still has: "abc123/photo.jpg" (original, unchanged)
  - B2 now has: "thumb.webp" + "display.webp" (new variants)
```

### Storage Locations:

| Storage | What's There | How It Got There | Purpose |
|---------|--------------|------------------|---------|
| **RAID** | Original files | Uploaded via IronDrive webapp | Master archive, source of truth |
| **B2/CDN** | Processed variants | Uploaded by worker after processing | Fast web delivery |
| **Supabase DB** | Metadata & references | Created by auction webapp | Tracks relationships and status |

The worker acts as a bridge:
- **Input:** Downloads original from RAID
- **Process:** Converts/optimizes
- **Output:** Uploads variants to B2

### Key Points:

1. **No Upload in Auction Webapp**
   - Auction webapp ONLY selects existing files
   - No file upload UI in auction webapp
   - All uploads happen in IronDrive webapp

2. **IronDrive Picker is a Browser**
   - Think of it like Windows Explorer or Finder
   - Browses files on RAID storage
   - Returns file reference (source_key), not file data

3. **Separation of Concerns**
   - IronDrive: File storage and management
   - Auction webapp: Business logic and publishing

### Current Code Confusion:

**The auction webapp currently has upload code that should NOT be used:**
```typescript
// ironDriveService.ts - lines 181-283
async uploadInventoryImages(files: File[], ...) {
  // This uploads files to RAID via IronDrive API
  // ⚠️ Should NOT be used with picker workflow
}
```

**Based on clarified requirements:**
- ✅ IronDrive Picker should be the ONLY way to select files
- ❌ Auction webapp should NOT upload to RAID
- ✅ All uploads to RAID happen in IronDrive webapp
- ✅ Picker just selects existing files

**This upload code should be:**
1. **Removed** - if picker is the only intended method
2. **Or kept** - if there's a valid use case for uploading directly from auction webapp (e.g., quick convenience feature)

**The correct workflow is:**
```
IronDrive Webapp → Upload → RAID storage
                              ↓
Auction Webapp → Picker → Select existing → Get source_key → Publish to B2
```

**NOT:**
```
❌ Auction Webapp → Upload → RAID storage
```

---

## Summary

| Feature | Status | Details |
|---------|--------|---------|
| RAID Fallback | ❌ Not Implemented | Shows placeholder on CDN failure |
| File Upload Location | 🤔 Unclear | Code exists but workflow suggests IronDrive webapp |
| IronDrive Picker | ✅ Correct | Selects existing RAID files |
| CDN Serving | ✅ Correct | Primary delivery method |
| Publishing Pipeline | ✅ Correct | Worker processes images to CDN |

---

## Questions to Resolve:

1. **Should RAID fallback be implemented?**
   - Pros: Images always display (slower but functional)
   - Cons: Requires authentication, not designed for web serving

2. **Should auction webapp have upload capability?**
   - Option A: Remove upload code, only use picker (cleaner separation)
   - Option B: Keep upload code for convenience (allows upload without leaving app)
   - Option C: Keep both, let admin choose

3. **What happens if CDN fails during page load?**
   - Currently: User sees "Image Unavailable"
   - Alternative: Could show loading state longer
   - Alternative: Could add RAID fallback
