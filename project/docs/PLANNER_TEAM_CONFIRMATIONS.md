# Planner Team Confirmations - Media Publishing System

## Date: February 14, 2026

---

## 1. RAID Download URL Construction ✅ CONFIRMED

**Question:** Does worker download using `RAID_PUB_ENDPOINT + "/" + source_key`?

**Answer:** YES - Exact match confirmed.

**Code Evidence:**
```typescript
// worker/src/services/raid.ts:6
const url = `${config.raid.endpoint}/${fileKey}`;

// worker/src/config.ts:45
endpoint: requireEnv('RAID_PUB_ENDPOINT')
```

**Actual Behavior:**
- Railway env var: `RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download`
- source_key from database: `userId/storedFilename` (from IronDrive picker)
- Final URL: `https://raid.ibaproject.bid/pub/download/userId/storedFilename`

**Example:**
```
RAID_PUB_ENDPOINT: https://raid.ibaproject.bid/pub/download
source_key: abc123/myimage.jpg
Final URL: https://raid.ibaproject.bid/pub/download/abc123/myimage.jpg
```

✅ **CONFIRMED** - No `/assets/{id}/original.jpg` pattern. Direct concatenation.

---

## 2. Variant Sizing Decision ⚠️ CORRECTION NEEDED

**Question:** Confirm thumb=800 and display=2000 are intentional.

**Answer:** NO - Documentation was INCORRECT. Actual sizes are different.

**Actual Code:**
```typescript
// worker/src/services/imageProcessor.ts:54
private async createThumbnail(buffer: Buffer): Promise<ImageVariant> {
  const image = sharp(buffer)
    .rotate()
    .resize(400, 400, {    // ← 400px, NOT 800px
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 });
}

// worker/src/services/imageProcessor.ts:73
private async createDisplay(buffer: Buffer): Promise<ImageVariant> {
  const image = sharp(buffer)
    .rotate()
    .resize(1600, 1600, {    // ← 1600px, NOT 2000px
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 });
}
```

**Actual Sizes:**
- **Thumbnail:** 400px × 400px (max, maintains aspect ratio)
- **Display:** 1600px × 1600px (max, maintains aspect ratio)
- **Format:** WebP @ 80% quality
- **Fit:** Inside (no cropping, maintains aspect ratio)
- **withoutEnlargement:** true (never upscales smaller images)

**Expected File Sizes:**
- **Thumbnail:** ~30-80 KB (depending on content)
- **Display:** ~150-400 KB (depending on content)

### Decision Required

Do you want to keep the current sizes (400/1600) or change to the originally documented sizes (800/2000)?

**Current sizes (400/1600):**
- ✅ Faster processing
- ✅ Smaller file sizes
- ✅ Lower bandwidth costs
- ✅ Faster page loads
- ⚠️ Smaller thumbnails

**Documented sizes (800/2000):**
- ✅ Larger thumbnails (better quality in grids)
- ✅ Higher resolution display images
- ⚠️ Slower processing
- ⚠️ Higher bandwidth costs
- ⚠️ Larger storage needs

**Recommendation:** Keep current 400/1600 unless you need larger thumbnails. Most modern auction sites use 300-500px thumbnails.

---

## 3. Environment Variable Name Match ✅ CONFIRMED

**Question:** Confirm worker code reads same variable name as Railway (RAID_PUB_ENDPOINT vs RAID_PUB_BASE).

**Answer:** YES - Exact match confirmed.

**Code Evidence:**
```typescript
// worker/src/config.ts:43-46
raid: {
  secret: requireEnv('RAID_PUBLISHER_SECRET'),
  endpoint: requireEnv('RAID_PUB_ENDPOINT'),    // ← Reads RAID_PUB_ENDPOINT
}
```

**Railway Environment Variables:**
```
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download  ✅ Matches
RAID_PUBLISHER_SECRET=***  ✅ Matches
```

**Validation:**
- Worker code reads: `RAID_PUB_ENDPOINT`
- Railway has set: `RAID_PUB_ENDPOINT`
- No mismatch with `RAID_PUB_BASE` or other variants

✅ **CONFIRMED** - Variable names match exactly.

---

## Summary

| Item | Status | Action Required |
|------|--------|-----------------|
| 1. RAID URL Construction | ✅ Confirmed | None - Correct as-is |
| 2. Variant Sizing | ⚠️ Documentation Error | **Decision needed: Keep 400/1600 or change to 800/2000?** |
| 3. Env Var Name Match | ✅ Confirmed | None - Correct as-is |

---

## Next Steps

**Option A: Keep Current Sizes (400/1600) - Recommended**
- Update documentation to reflect actual sizes
- Proceed with real image test
- **Estimated time:** 5 minutes

**Option B: Change to Documented Sizes (800/2000)**
- Update worker code (imageProcessor.ts)
- Rebuild and redeploy worker
- Update Railway deployment
- Then proceed with test
- **Estimated time:** 20-30 minutes

**Please confirm:** Which option do you prefer?

---

## Code Changes Required (If Option B Chosen)

```typescript
// worker/src/services/imageProcessor.ts

// Line 54 - Change from 400 to 800
.resize(800, 800, {

// Line 73 - Change from 1600 to 2000
.resize(2000, 2000, {
```

Then redeploy worker to Railway.

---

**Prepared by:** Implementation Team
**Date:** February 14, 2026
**Status:** Awaiting sizing decision before final test
