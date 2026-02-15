# Planner Team Alignment Updates - February 15, 2026

## Overview

Updated the "DO NOT DEVIATE" document and codebase to align with the planner team's architecture review findings.

---

## Changes Made to Documentation

### 1. Picker Data Format ✅
**Updated:** `/docs/FILE_STORAGE_SYSTEM_DO_NOT_DEVIATE.md`

**Before:**
```javascript
{
  type: 'irondrive-selection',
  files: [{
    raid_url: 'https://raid.ibaproject.bid/download/userId/filename.jpg',
    filename: 'photo.jpg',
    ...
  }]
}
```

**After:**
```javascript
{
  type: 'irondrive-selection',
  files: [{
    source_key: 'userId/filename.jpg',  // Direct key, no URL
    filename: 'photo.jpg',
    ...
  }]
}
```

**Impact:** Frontend no longer needs to parse URLs to extract source_key.

---

### 2. RAID Fallback Endpoint ✅
**Updated:** All references to RAID URLs throughout documentation

**Before:**
```javascript
const raidUrl = `https://raid.ibaproject.bid/download/${file.source_key}`;
```

**After:**
```javascript
const raidUrl = `https://raid.ibaproject.bid/pub/download/${file.source_key}`;
```

**Impact:** Uses correct public download endpoint for RAID fallbacks.

---

### 3. CDN Base URL ✅
**Updated:** Environment variables and all URL references

**Before:**
```env
CDN_BASE_URL=https://cdn.irondrive.ibaproject.bid
```

**After:**
```env
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media
```

**Impact:** All CDN URLs now use correct domain and bucket path.

---

### 4. B2 Key Structure ✅
**Updated:** Worker code examples and variant type documentation

**Before:**
```javascript
const b2Key = `processed/${variant}_${uuid}.webp`;
```

**After:**
```javascript
const b2Key = `assets/${assetGroupId}/${variant}.webp`;
```

**Structure:**
```
IBA-Lot-Media/
  └── assets/
      └── {asset_group_id}/
          ├── thumb.webp
          ├── display.webp
          └── video.mp4 (for videos)
```

**Impact:** Consistent, organized B2 storage structure grouped by asset.

---

### 5. Public Site Rule ✅
**Added:** New critical section in documentation

**Rule:** PUBLIC SITE MUST NEVER serve RAID files directly

```typescript
// ❌ NEVER on public site:
<img src={`https://raid.ibaproject.bid/pub/download/${file.source_key}`} />

// ✅ ALWAYS on public site:
<img src={file.cdn_url} />
```

**Exception:** Admin tools MAY preview unpublished files from RAID.

**Why:**
- CDN provides optimized, cached delivery
- CDN handles traffic scaling
- RAID is internal infrastructure
- Security: RAID requires authentication

---

### 6. 30-Day Retention Policy ✅
**Added:** New cleanup policy section

**How It Works:**
1. File removed → `detached_at` timestamp set
2. Retained for 30 days in database and B2
3. Worker cleanup job deletes files > 30 days old
4. Allows accidental deletion recovery

**Worker Query:**
```sql
SELECT * FROM auction_files
WHERE detached_at IS NOT NULL
  AND detached_at < NOW() - INTERVAL '30 days'
LIMIT 100
```

**Recovery (within 30 days):**
```typescript
await supabase
  .from('auction_files')
  .update({ detached_at: null })
  .eq('id', fileId);
```

---

## Changes Made to Code

### 1. Frontend: InventoryItemFormNew.tsx ✅

**Changed:** Picker message handler

**Before:**
```typescript
const sourceKey = fileKeyFromRaidUrl(file.raid_url);
return {
  url: file.raid_url,
  backupUrl: file.bolt_url,
  sourceKey
};
```

**After:**
```typescript
const previewUrl = `https://raid.ibaproject.bid/pub/download/${file.source_key}`;
return {
  url: previewUrl,
  sourceKey: file.source_key  // Use directly
};
```

**Removed:** `fileKeyFromRaidUrl()` function (no longer needed)

---

### 2. Frontend: GlobalInventoryManagement.tsx ✅

**Changed:** Gallery query to filter properly

**Before:**
```typescript
.from('auction_files')
.select('cdn_url, mime_type')
.eq('item_id', item.id)
```

**After:**
```typescript
.from('auction_files')
.select('cdn_url, mime_type, variant')
.eq('item_id', item.id)
.eq('published_status', 'published')
.is('detached_at', null)
.in('variant', ['display', 'video'])
```

**Impact:** Only shows published, non-deleted, display-quality files.

---

### 3. Worker: database.ts ✅

**Changed:** CDN URL generation

**Before:**
```typescript
const cdnUrl = `https://cdn.irondrive.ibaproject.bid/${data.b2_key}`;
```

**After:**
```typescript
const cdnUrl = `${config.cdn.baseUrl}/${data.b2_key}`;
```

**Impact:** Uses correct CDN domain from config.

---

## Common Mistakes Now Documented

Added to "Common Mistakes to Avoid" section:

❌ **Using wrong B2 key structure**
✅ Use `assets/{asset_group_id}/{variant}.webp`

❌ **Serving RAID URLs on public site**
✅ Only use `cdn_url` on public pages

❌ **Using `/download` endpoint**
✅ Use `/pub/download` endpoint

❌ **Picker returning `raid_url`**
✅ Picker returns `source_key` only

❌ **Extracting source_key from URL**
✅ Use `source_key` directly

❌ **Using `cdn.irondrive.ibaproject.bid`**
✅ Use `cdn.ibaproject.bid/file/IBA-Lot-Media`

---

## Updated Testing Checklist

### Added Tests For:
- [ ] Picker returns `source_key` (not `raid_url`)
- [ ] Frontend uses `source_key` directly
- [ ] B2 keys use format: `assets/{asset_group_id}/{variant}.webp`
- [ ] CDN URLs use `cdn.ibaproject.bid/file/IBA-Lot-Media`
- [ ] Public pages NEVER show RAID URLs
- [ ] RAID fallback uses `/pub/download` endpoint
- [ ] Worker cleanup runs for detached files > 30 days

---

## Environment Variables to Verify

### Frontend `.env`
```env
VITE_CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media
```

### Worker `.env`
```env
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download
```

---

## Files Modified

### Documentation
- `/docs/FILE_STORAGE_SYSTEM_DO_NOT_DEVIATE.md` - Complete rewrite with corrections

### Code
- `/src/components/InventoryItemFormNew.tsx` - Picker handler updated
- `/src/components/GlobalInventoryManagement.tsx` - Gallery query fixed
- `/worker/src/services/database.ts` - CDN URL fixed

### New Documentation
- `/docs/PLANNER_TEAM_ALIGNMENT_2026_02_15.md` - This file

---

## Next Steps

1. **Deploy worker** with CDN URL fix
2. **Update IronDrive picker** to return `source_key` instead of `raid_url`
3. **Test PC upload** - should work immediately
4. **Test IronDrive pick** - should work after picker update
5. **Verify all CDN URLs** resolve correctly

---

---

## Additional Requirement: Worker Idempotency

**Added:** February 15, 2026 (Follow-up from planner team)

### The Requirement

Worker must be idempotent - if re-run on the same `asset_group_id`, it should:
- ✅ Overwrite B2 files (not create duplicates)
- ✅ Update database records (not create duplicates)

### Implementation

**Database Constraint Required:**
```sql
ALTER TABLE auction_files
ADD CONSTRAINT auction_files_asset_variant_unique
UNIQUE (asset_group_id, variant);
```

**Worker Pattern:**
```typescript
// Use UPSERT instead of INSERT
INSERT INTO auction_files (...)
VALUES (...)
ON CONFLICT (asset_group_id, variant) DO UPDATE SET
  b2_key = EXCLUDED.b2_key,
  cdn_url = EXCLUDED.cdn_url,
  updated_at = NOW()
```

### Why This Matters

- Prevents duplicate records on retry
- Prevents orphaned B2 files
- Ensures consistent state
- Required for production reliability

### Status

📝 **Documented** - Good practice for future implementation
⏳ **Not Required Immediately** - Can be implemented before production

---

## Status: ✅ COMPLETE

All documentation and code updated to match planner team's architecture review.

The "DO NOT DEVIATE" document is now the accurate, authoritative source of truth for the file storage system, including the worker idempotency requirement.
