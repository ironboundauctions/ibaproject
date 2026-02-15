# Complete Image Flow - From Upload to Display

**Every step in the media publishing pipeline**

---

## Visual Flow Diagram

```
┌──────────────────────────────────────┐
│  IronDrive Webapp (Separate App)    │
│  User uploads files here first       │
│  https://irondrive.example.com       │
└──────────────────────────────────────┘
                ↓
         Files stored in RAID
                ↓
┌─────────────────┐
│ Auction Webapp  │ (Admin selecting existing files)
└────────┬────────┘
         │
         │ 1. Opens IronDrive Picker (selects file)
         ▼
┌─────────────────────────────────────┐
│   RAID Storage System               │
│   https://raid.ibaproject.bid       │
│                                     │
│   File already exists here          │
│   Picker returns: source_key        │
│   Example: "abc123/photo.jpg"       │
└────────┬────────────────────────────┘
         │
         │ 2. Source key returned to frontend
         ▼
┌─────────────────────────────────────┐
│   Frontend (React)                  │
│                                     │
│   Creates database record:          │
│   - file_key = "abc123/photo.jpg"   │
│   - file_name = "photo.jpg"         │
│   - file_type = "image/jpeg"        │
│   - publish_status = "pending"      │
└────────┬────────────────────────────┘
         │
         │ 3. INSERT into auction_files
         ▼
┌──────────────────────────────────────────────────────┐
│   Supabase Database (Postgres)                       │
│                                                       │
│   auction_files table:                               │
│   ┌────────────────────────────────────────────┐    │
│   │ id: uuid-1234                              │    │
│   │ file_key: "abc123/photo.jpg"               │    │
│   │ publish_status: "pending"                  │    │
│   │ thumb_url: NULL                            │    │
│   │ display_url: NULL                          │    │
│   └────────────────────────────────────────────┘    │
│                                                       │
│   ↓ (Automatic Trigger Fires)                        │
│                                                       │
│   publish_jobs table:                                │
│   ┌────────────────────────────────────────────┐    │
│   │ id: job-uuid-5678                          │    │
│   │ file_id: uuid-1234                         │    │
│   │ status: "pending"                          │    │
│   │ priority: 10                               │    │
│   └────────────────────────────────────────────┘    │
└────────┬─────────────────────────────────────────────┘
         │
         │ 4. Worker polls database every 15 seconds
         ▼
┌──────────────────────────────────────────────────────┐
│   Railway Worker (Node.js)                           │
│   Deployed at: railway.app                           │
│                                                       │
│   Continuously running:                              │
│   - SELECT * FROM publish_jobs                       │
│     WHERE status='pending'                           │
│     ORDER BY priority DESC, created_at               │
│     LIMIT 3                                          │
└────────┬─────────────────────────────────────────────┘
         │
         │ 5. Found pending job! Update status to "processing"
         ▼
┌──────────────────────────────────────────────────────┐
│   Worker Step 1: Download from RAID                  │
│                                                       │
│   URL: RAID_PUB_ENDPOINT + "/" + source_key          │
│   https://raid.ibaproject.bid/pub/download/          │
│         abc123/photo.jpg                             │
│                                                       │
│   Headers:                                           │
│   X-Auction-Publisher: {RAID_PUBLISHER_SECRET}       │
│                                                       │
│   Downloads: Original file to memory                 │
│   Example: 2.5 MB JPEG                               │
└────────┬─────────────────────────────────────────────┘
         │
         │ 6. Original file downloaded successfully
         ▼
┌──────────────────────────────────────────────────────┐
│   Worker Step 2: Image Processing (Sharp)            │
│                                                       │
│   Input: Original JPEG (2.5 MB, 4000×3000)           │
│                                                       │
│   Process Thumbnail:                                 │
│   - Resize to max 400×400 (maintains aspect)         │
│   - Convert to WebP format                           │
│   - Quality: 80%                                     │
│   - No upscaling (small images stay small)           │
│   Output: thumb.webp (~50 KB, 400×300)               │
│                                                       │
│   Process Display:                                   │
│   - Resize to max 1600×1600 (maintains aspect)       │
│   - Convert to WebP format                           │
│   - Quality: 80%                                     │
│   - No upscaling                                     │
│   Output: display.webp (~250 KB, 1600×1200)          │
└────────┬─────────────────────────────────────────────┘
         │
         │ 7. Both variants created in memory
         ▼
┌──────────────────────────────────────────────────────┐
│   Worker Step 3: Upload to Backblaze B2             │
│                                                       │
│   Bucket: IBA-Lot-Media                              │
│   Endpoint: s3.us-west-004.backblazeb2.com           │
│   Region: us-west-004                                │
│                                                       │
│   Upload 1:                                          │
│   Key: assets/uuid-1234/thumb.webp                   │
│   Size: 50 KB                                        │
│   Content-Type: image/webp                           │
│   ACL: public-read                                   │
│                                                       │
│   Upload 2:                                          │
│   Key: assets/uuid-1234/display.webp                 │
│   Size: 250 KB                                       │
│   Content-Type: image/webp                           │
│   ACL: public-read                                   │
└────────┬─────────────────────────────────────────────┘
         │
         │ 8. Both files uploaded to B2
         ▼
┌──────────────────────────────────────────────────────┐
│   Backblaze B2 Bucket                                │
│   Name: IBA-Lot-Media                                │
│                                                       │
│   Files stored:                                      │
│   📁 assets/                                         │
│      📁 uuid-1234/                                   │
│         📄 thumb.webp (50 KB)                        │
│         📄 display.webp (250 KB)                     │
│                                                       │
│   Direct URLs:                                       │
│   https://s3.us-west-004.backblazeb2.com/            │
│         IBA-Lot-Media/assets/uuid-1234/thumb.webp    │
└────────┬─────────────────────────────────────────────┘
         │
         │ 9. B2 serves files through CloudFlare CDN
         ▼
┌──────────────────────────────────────────────────────┐
│   CloudFlare CDN                                     │
│   Domain: cdn.ibaproject.bid                         │
│                                                       │
│   CDN URLs (what users actually access):             │
│   https://cdn.ibaproject.bid/file/IBA-Lot-Media/     │
│         assets/uuid-1234/thumb.webp                  │
│   https://cdn.ibaproject.bid/file/IBA-Lot-Media/     │
│         assets/uuid-1234/display.webp                │
│                                                       │
│   Benefits:                                          │
│   - Global edge caching                              │
│   - Faster delivery worldwide                        │
│   - Reduced B2 bandwidth costs                       │
└────────┬─────────────────────────────────────────────┘
         │
         │ 10. Worker updates database with CDN URLs
         ▼
┌──────────────────────────────────────────────────────┐
│   Supabase Database - UPDATED                        │
│                                                       │
│   auction_files table:                               │
│   ┌────────────────────────────────────────────┐    │
│   │ id: uuid-1234                              │    │
│   │ file_key: "abc123/photo.jpg"               │    │
│   │ publish_status: "published" ✅             │    │
│   │ thumb_url: "https://cdn.ibaproject.bid/    │    │
│   │   file/IBA-Lot-Media/assets/uuid-1234/     │    │
│   │   thumb.webp"                              │    │
│   │ display_url: "https://cdn.ibaproject.bid/  │    │
│   │   file/IBA-Lot-Media/assets/uuid-1234/     │    │
│   │   display.webp"                            │    │
│   │ published_at: 2026-02-14 15:30:45 ✅       │    │
│   │ cdn_key_prefix: "assets/uuid-1234"         │    │
│   └────────────────────────────────────────────┘    │
│                                                       │
│   publish_jobs table:                                │
│   ┌────────────────────────────────────────────┐    │
│   │ id: job-uuid-5678                          │    │
│   │ file_id: uuid-1234                         │    │
│   │ status: "completed" ✅                     │    │
│   │ completed_at: 2026-02-14 15:30:45          │    │
│   │ error_message: NULL                        │    │
│   └────────────────────────────────────────────┘    │
└────────┬─────────────────────────────────────────────┘
         │
         │ 11. Frontend queries database
         ▼
┌──────────────────────────────────────────────────────┐
│   Frontend - MediaImage Component                    │
│                                                       │
│   React component receives props:                    │
│   - thumbUrl: "https://cdn.ibaproject.bid/..."       │
│   - displayUrl: "https://cdn.ibaproject.bid/..."     │
│   - raidUrl: "abc123/photo.jpg" (fallback)           │
│   - publishStatus: "published"                       │
│                                                       │
│   Logic:                                             │
│   1. Check if publishStatus === "published"          │
│   2. Try to load thumbUrl from CDN                   │
│   3. On error, fallback to RAID URL                  │
└────────┬─────────────────────────────────────────────┘
         │
         │ 12. Browser fetches image from CDN
         ▼
┌──────────────────────────────────────────────────────┐
│   User's Browser                                     │
│                                                       │
│   GET https://cdn.ibaproject.bid/file/IBA-Lot-Media/ │
│       assets/uuid-1234/thumb.webp                    │
│                                                       │
│   Response:                                          │
│   HTTP 200 OK                                        │
│   Content-Type: image/webp                           │
│   Content-Length: 51200 (50 KB)                      │
│   Cache-Control: public, max-age=31536000            │
│                                                       │
│   ✅ Image displays on auction website!              │
└──────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step

### Step 1: User Selects File from IronDrive

**Who:** Admin user in your auction system

**Action:**
- Opens inventory or lot management page in **Auction webapp**
- Clicks "Add Media" button
- IronDrive picker opens (modal/iframe showing IronDrive webapp)
- User browses files **already uploaded to IronDrive/RAID**
- User selects existing file(s)
- IronDrive picker returns `source_key`: `"abc123/photo.jpg"`

**Result:**
- No upload happens in auction webapp
- File already exists in RAID at: `{userId}/{filename}.jpg`
- Auction webapp receives `source_key` reference only

**Important:**
- File upload to RAID happens in **IronDrive webapp** (separate application)
- Auction webapp ONLY selects/browses existing files via picker
- Think of it like opening Windows Explorer to choose a file, except browsing RAID storage

**Technologies:**
- IronDrive webapp: Separate app for file management & upload
- IronDrive picker: File browser embedded in auction webapp
- RAID: Your organization's file storage system

---

### Step 2: Frontend Creates Database Record

**Who:** Your React frontend application

**Action:**
```typescript
// Frontend creates record
const { data: file, error } = await supabase
  .from('auction_files')
  .insert({
    file_key: 'abc123/photo.jpg',  // source_key from IronDrive
    file_name: 'photo.jpg',
    file_type: 'image/jpeg',
    file_size: 2500000,
    lot_id: currentLotId,
    publish_status: 'pending'
  })
  .select()
  .single();
```

**Result:**
- New row in `auction_files` table
- `publish_status` = 'pending'
- `thumb_url` = NULL (not processed yet)
- `display_url` = NULL (not processed yet)

**Technologies:**
- React frontend
- Supabase client library

---

### Step 3: Database Trigger Creates Job

**Who:** Postgres database (automatic)

**Action:**
Database trigger fires automatically:

```sql
-- This happens automatically when auction_files row is inserted
CREATE TRIGGER auto_create_publish_job
AFTER INSERT ON auction_files
FOR EACH ROW
WHEN (NEW.publish_status = 'pending')
EXECUTE FUNCTION create_publish_job();
```

**Result:**
- New row in `publish_jobs` table
- `status` = 'pending'
- `file_id` = links to auction_files row
- `priority` = 10 (default)

**Technologies:**
- Postgres triggers
- Supabase database

---

### Step 4: Railway Worker Polls Database

**Who:** Node.js worker running on Railway

**Action:**
Worker runs continuously in a loop:

```typescript
// Runs every 15 seconds
async function pollForJobs() {
  while (true) {
    const jobs = await database.getPendingJobs(CONCURRENCY);

    for (const job of jobs) {
      await processJob(job);
    }

    await sleep(POLL_INTERVAL); // 15 seconds
  }
}
```

**SQL Query:**
```sql
SELECT j.id, j.file_id, f.file_key, f.file_type
FROM publish_jobs j
JOIN auction_files f ON j.file_id = f.id
WHERE j.status = 'pending'
ORDER BY j.priority DESC, j.created_at ASC
LIMIT 3;  -- Process 3 at a time
```

**Result:**
- Worker finds pending job
- Updates job status to 'processing'
- Updates `started_at` timestamp

**Technologies:**
- Node.js 20
- TypeScript
- Railway (hosting platform)

---

### Step 5: Worker Downloads from RAID

**Who:** Railway worker

**Action:**
```typescript
// worker/src/services/raid.ts
const url = `${config.raid.endpoint}/${fileKey}`;
// https://raid.ibaproject.bid/pub/download/abc123/photo.jpg

const response = await fetch(url, {
  headers: {
    'X-Auction-Publisher': config.raid.secret
  }
});

const buffer = await response.arrayBuffer();
```

**Environment Variables Used:**
- `RAID_PUB_ENDPOINT` = `https://raid.ibaproject.bid/pub/download`
- `RAID_PUBLISHER_SECRET` = `AqjbEb6TAvejA2o7eSXXv2J6gf8mlDk9WUg1cJvZZvnnRcG/SfME/Cyu+oHLr0m6`

**Result:**
- Original file downloaded to worker's memory
- Example: 2.5 MB JPEG, 4000×3000 pixels

**Technologies:**
- Node.js fetch API
- RAID publisher endpoint

---

### Step 6: Worker Processes Image

**Who:** Railway worker using Sharp library

**Action:**
```typescript
// worker/src/services/imageProcessor.ts

// Create thumbnail
const thumbBuffer = await sharp(originalBuffer)
  .resize(400, 400, {
    fit: 'inside',        // Maintain aspect ratio
    withoutEnlargement: true  // Don't upscale small images
  })
  .webp({ quality: 80 })  // Convert to WebP
  .toBuffer();

// Create display variant
const displayBuffer = await sharp(originalBuffer)
  .resize(1600, 1600, {
    fit: 'inside',
    withoutEnlargement: true
  })
  .webp({ quality: 80 })
  .toBuffer();
```

**Processing Details:**
- **Input:** Original JPEG (2.5 MB, 4000×3000)
- **Thumbnail:** 400×300 WebP (~50 KB)
- **Display:** 1600×1200 WebP (~250 KB)
- **Compression:** 93% smaller total size
- **Format:** WebP (better than JPEG/PNG)

**Result:**
- Two buffers in memory ready for upload
- Both maintain original aspect ratio
- Significant file size reduction

**Technologies:**
- Sharp (Node.js image processing)
- WebP format

---

### Step 7: Worker Uploads to B2

**Who:** Railway worker using AWS S3 SDK

**Action:**
```typescript
// worker/src/services/storage.ts

// Upload thumbnail
await s3Client.send(new PutObjectCommand({
  Bucket: 'IBA-Lot-Media',
  Key: 'assets/uuid-1234/thumb.webp',
  Body: thumbBuffer,
  ContentType: 'image/webp',
  ACL: 'public-read'
}));

// Upload display
await s3Client.send(new PutObjectCommand({
  Bucket: 'IBA-Lot-Media',
  Key: 'assets/uuid-1234/display.webp',
  Body: displayBuffer,
  ContentType: 'image/webp',
  ACL: 'public-read'
}));
```

**Environment Variables Used:**
- `B2_KEY_ID` = `005c92d7eb30ed70000000003`
- `B2_APP_KEY` = `K005oIdG4RFnenPK5IU33SrIw+ymN1E`
- `B2_BUCKET` = `IBA-Lot-Media`
- `B2_ENDPOINT` = `s3.us-west-004.backblazeb2.com`
- `B2_REGION` = `us-west-004`

**Result:**
- Two files stored in B2 bucket
- Files are publicly accessible
- S3 paths: `assets/uuid-1234/thumb.webp` and `assets/uuid-1234/display.webp`

**Technologies:**
- Backblaze B2 (S3-compatible storage)
- AWS SDK for JavaScript v3

---

### Step 8: B2 Serves Through CloudFlare

**Who:** Backblaze B2 + CloudFlare CDN (automatic)

**How It Works:**
1. B2 bucket is configured with CloudFlare CDN
2. CloudFlare mirrors the bucket domain
3. Files accessible via: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/{key}`

**Direct B2 URL:**
```
https://s3.us-west-004.backblazeb2.com/IBA-Lot-Media/assets/uuid-1234/thumb.webp
```

**CDN URL (what's actually used):**
```
https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/uuid-1234/thumb.webp
```

**CDN Benefits:**
- Global edge caching (faster worldwide)
- Reduced B2 egress costs (CloudFlare is free)
- DDoS protection
- Better performance

**Technologies:**
- Backblaze B2 storage
- CloudFlare CDN

---

### Step 9: Worker Updates Database

**Who:** Railway worker

**Action:**
```typescript
// worker/src/services/database.ts

await supabase
  .from('auction_files')
  .update({
    thumb_url: 'https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/uuid-1234/thumb.webp',
    display_url: 'https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/uuid-1234/display.webp',
    cdn_key_prefix: 'assets/uuid-1234',
    publish_status: 'published',
    published_at: new Date().toISOString()
  })
  .eq('id', fileId);

await supabase
  .from('publish_jobs')
  .update({
    status: 'completed',
    completed_at: new Date().toISOString()
  })
  .eq('id', jobId);
```

**Result:**
- `auction_files` row updated with CDN URLs
- `publish_status` changed from 'pending' to 'published'
- `publish_jobs` row marked as 'completed'

**Technologies:**
- Supabase client library
- Postgres database

---

### Step 10: Frontend Displays Image

**Who:** Your React application

**Action:**
```tsx
// Frontend component
<MediaImage
  thumbUrl={file.thumb_url}
  displayUrl={file.display_url}
  raidUrl={file.file_key}
  alt={file.file_name}
  variant="thumb"
  publishStatus={file.publish_status}
/>
```

**Component Logic:**
```typescript
// src/components/MediaImage.tsx
// If published and CDN URL exists, show image
if (publishStatus === 'published' && cdnUrl && !imageError) {
  return <img src={cdnUrl} />;
}

// Otherwise show placeholder
return <div>Processing... / Image Unavailable</div>;
```

**Result:**
- Component shows CDN image if published
- Shows placeholder if not published or CDN fails
- **No RAID fallback** - images are only served from CDN after publishing

**Technologies:**
- React
- MediaImage component

---

### Step 11: Browser Loads from CDN

**Who:** End user's web browser

**Action:**
Browser makes HTTP request:
```http
GET https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/uuid-1234/thumb.webp
```

**Response:**
```http
HTTP/2 200 OK
content-type: image/webp
content-length: 51200
cache-control: public, max-age=31536000
cf-cache-status: HIT
```

**Result:**
- Image loads in ~100-300ms (cached at edge)
- Browser caches image locally
- Subsequent loads are instant

**Technologies:**
- HTTP/2
- WebP image format
- CloudFlare edge caching

---

## Summary: Complete Path

```
[Files already uploaded to RAID via IronDrive webapp]
              ↓
Auction Webapp → Opens IronDrive Picker
              ↓
          User Selects File (no upload)
              ↓
          Frontend (creates DB record)
              ↓
          Database (trigger creates job)
              ↓
          Railway Worker (polls every 15s)
              ↓
          Download from RAID (original)
              ↓
          Sharp Processing (create 400px + 1600px WebP)
              ↓
          Upload to Backblaze B2 (2 files)
              ↓
          CloudFlare CDN (global distribution)
              ↓
          Database Updated (CDN URLs stored)
              ↓
          Frontend MediaImage (displays from CDN)
              ↓
          User's Browser (fast WebP image)
```

---

## Timing

**Total Processing Time:** ~10-20 seconds

- Database trigger: Instant
- Worker picks up job: 0-15 seconds (polling interval)
- Download from RAID: 1-3 seconds
- Image processing: 2-5 seconds
- Upload to B2: 2-5 seconds
- Database update: < 1 second

---

## File Size Comparison

**Example for 4000×3000 JPEG:**

| Version | Format | Size | Dimensions | Quality |
|---------|--------|------|------------|---------|
| Original | JPEG | 2.5 MB | 4000×3000 | 100% |
| Thumbnail | WebP | 50 KB | 400×300 | 80% |
| Display | WebP | 250 KB | 1600×1200 | 80% |

**Total Savings:** 93% smaller (300 KB vs 2.5 MB)

---

## What Gets Stored Where

### RAID Storage
- **Stores:** Original uploaded files (uploaded via IronDrive webapp)
- **Format:** Whatever user uploaded (JPEG, PNG, etc.)
- **Size:** Original file size (no compression)
- **Purpose:** Source of truth, master archive (not used for web display after publishing)

### Backblaze B2 Bucket
- **Stores:** Optimized WebP variants
- **Format:** WebP only
- **Size:** Highly compressed (80% quality)
- **Purpose:** Fast delivery through CDN

### Supabase Database
- **Stores:** Metadata and URLs
- **Data:**
  - `file_key`: RAID source key
  - `thumb_url`: CDN URL for thumbnail
  - `display_url`: CDN URL for display
  - `publish_status`: Processing state

### CloudFlare CDN
- **Stores:** Cached copies at edge locations
- **Purpose:** Ultra-fast global delivery
- **Cache Duration:** 1 year (images don't change)

---

## Checking Each Part

### 1. Check RAID Upload
```bash
# Test if file exists in RAID
curl -H "X-Auction-Publisher: {SECRET}" \
  "https://raid.ibaproject.bid/pub/download/abc123/photo.jpg" \
  --head
```

### 2. Check Database Record
```sql
SELECT id, file_key, publish_status, thumb_url, display_url
FROM auction_files
WHERE file_key = 'abc123/photo.jpg';
```

### 3. Check Job Status
```sql
SELECT status, retry_count, error_message
FROM publish_jobs
WHERE file_id = '{file-uuid}';
```

### 4. Check Railway Worker Logs
```
Railway Dashboard → media-worker → Logs
Look for: "Processing job" and "Job completed successfully"
```

### 5. Check B2 Storage
```bash
# Test CDN URLs directly
curl -I "https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{uuid}/thumb.webp"
curl -I "https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{uuid}/display.webp"
```

### 6. Check Frontend Display
```
Browser DevTools → Network tab → Filter by "webp"
Should see requests to cdn.ibaproject.bid with 200 status
```

---

## Key Points

1. **Original stays in RAID** - Never deleted, always available as fallback
2. **Worker is asynchronous** - Upload happens immediately, processing takes 10-20 seconds
3. **CDN is primary** - Frontend always tries CDN first for speed
4. **RAID is fallback** - If CDN fails, images still work (slower but functional)
5. **WebP saves bandwidth** - 93% smaller files = faster page loads
6. **Processing is automatic** - Database trigger → Worker picks up → No manual intervention

---

**Next Step:** Run real image test using `/docs/REAL_IMAGE_TEST_PLAN.md`
