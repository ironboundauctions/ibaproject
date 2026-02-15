# Planner Team Verification Checklist

## Status: ✅ Architecture Correct, ⚠️ Requires Configuration Verification

The planner team has reviewed the implementation and confirmed it aligns with the authoritative architecture. Three critical items require verification before production deployment.

---

## ✅ What's Confirmed Correct

### 1. Database Schema
- ✅ `auction_files` with `asset_group_id`, `variant`, `source_key`, `b2_key`, `cdn_url`, `detached_at`
- ✅ UNIQUE constraint on `(asset_group_id, variant)`
- ✅ `publish_jobs` table with auto-trigger on source insert
- ✅ Proper RLS policies

### 2. IronDrive Contract
- ✅ Picker returns identifiers only: `source_key` and `original_name`
- ✅ No URLs returned from picker
- ✅ No CDN URL generation in IronDrive

### 3. Worker B2 Key Tracking
- ✅ Worker uploads to B2 and stores `b2_key` in database
- ✅ Enables cleanup and idempotency
- ✅ Upsert pattern with unique constraint

### 4. RAID Endpoint
- ✅ Using `https://raid.ibaproject.bid/pub/download`
- ✅ Worker authenticates with `X-Auction-Publisher` header
- ✅ **CRITICAL NOTE**: Ignore `/download` in health JSON - only `/pub/download` is valid

### 5. Frontend Security
- ✅ Frontend uses Supabase ANON key only
- ✅ No `service_role` key in frontend code
- ✅ No `VITE_SUPABASE_SERVICE_ROLE_KEY` in environment
- ✅ Direct database calls with proper RLS policies

---

## ⚠️ Critical Items Requiring Verification

### 1. 🔴 CRITICAL: Cloudflare ↔ B2 Region Must Match

**Current Configuration:**
```
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media
```

**The Problem:**
If Cloudflare's `cdn.ibaproject.bid` CNAME points to a **different B2 region** than `us-west-004`, you will get:
- ✅ Uploads succeed to B2
- ❌ CDN URLs return 404

**ACTION REQUIRED:**

1. **Check Cloudflare DNS:**
   ```bash
   # What is the CNAME target for cdn.ibaproject.bid?
   dig cdn.ibaproject.bid CNAME
   ```

   Expected result should show a B2 endpoint hostname.

2. **Verify it matches your B2 bucket region:**
   - Log into Backblaze B2 console
   - Find bucket `IBA-Lot-Media`
   - Check which endpoint it uses (us-west-004, us-east-005, etc.)
   - **If different from us-west-004**, update `.env` and worker `.env`:
     ```bash
     B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com  # Example
     B2_REGION=us-east-005
     ```

3. **Test upload and CDN access:**
   ```bash
   # Upload a test file (do this after worker is running)
   # Then try to access:
   curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/test.txt
   # Should return 200 OK, not 404
   ```

---

### 2. 🔴 CRITICAL: Railway Worker Must Reach RAID

**The Problem:**
We tested RAID authentication from your PC and it works. But the worker running on Railway must also be able to reach `raid.ibaproject.bid`. If Railway has firewall/routing issues, publish will never work.

**ACTION REQUIRED:**

1. **Access Railway worker container shell:**
   - Railway Dashboard → Your Worker Service → Shell tab

2. **Run connectivity tests:**
   ```bash
   # Test 1: Can reach RAID at all?
   curl -I https://raid.ibaproject.bid/health
   # Expected: 200 OK

   # Test 2: Can authenticate?
   curl -I -H "X-Auction-Publisher: YOUR_ACTUAL_SECRET" \
     https://raid.ibaproject.bid/pub/download/test/test
   # Expected: 404 (not 401) - proves auth works, file just doesn't exist

   # Test 3: Download a REAL file (use actual source_key from database)
   curl -I -H "X-Auction-Publisher: YOUR_ACTUAL_SECRET" \
     https://raid.ibaproject.bid/pub/download/REAL_SOURCE_KEY_HERE
   # Expected: 200 OK with content-length header
   ```

3. **If any test fails:**
   - 401 = Wrong secret, check `RAID_PUBLISHER_SECRET` matches RAID server
   - Timeout/DNS error = Railway can't reach RAID (firewall/DNS issue)
   - 403 = RAID may be blocking Railway IPs

---

### 3. ⚠️ RECOMMENDED: End-to-End Smoke Test

**After fixing items 1 & 2, run this complete test:**

**Step 1: Upload to IronDrive**
- Upload one test image (JPEG/PNG) to IronDrive
- Note the filename

**Step 2: Attach via Auction Admin**
- Create or edit an inventory item
- Click "Pick from IronDrive"
- Select the test image
- Save

**Step 3: Verify Database**
```sql
-- Check source file created
SELECT * FROM auction_files
WHERE variant = 'source'
ORDER BY created_at DESC LIMIT 1;

-- Check publish job created
SELECT * FROM publish_jobs
ORDER BY created_at DESC LIMIT 1;

-- Note the asset_group_id
```

**Step 4: Wait for Worker (15-30 seconds)**
```sql
-- Check job completed
SELECT status, completed_at, error_message
FROM publish_jobs
WHERE id = 'JOB_ID_FROM_ABOVE';

-- Check variants created
SELECT variant, cdn_url, b2_key, width, height, published_status
FROM auction_files
WHERE asset_group_id = 'ASSET_GROUP_ID_FROM_ABOVE';

-- Should see 3 rows:
-- variant='source', published_status='pending'
-- variant='thumb', cdn_url='https://cdn...', published_status='published'
-- variant='display', cdn_url='https://cdn...', published_status='published'
```

**Step 5: Verify CDN URLs Work**
```bash
# Copy the display variant cdn_url from above query
curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/display.webp
# Expected: 200 OK, content-type: image/webp

# Open in browser - should display the image
```

**Step 6: Verify Frontend Display**
- View the inventory item in the public auction interface
- Image should display using CDN URL
- Right-click → Copy Image Address
- Verify URL is `https://cdn.ibaproject.bid/...` (NOT `raid.ibaproject.bid`)

---

## 📋 Configuration Checklist for Railway Worker

Update Railway environment variables to match these requirements:

```bash
# Database (from Supabase)
DATABASE_URL=postgresql://postgres.xxx:xxx@xxx.supabase.co:5432/postgres

# RAID Publisher
RAID_PUBLISHER_SECRET=<get from RAID server AUCTION_PUBLISHER_SECRET>
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download

# B2 Storage (VERIFY REGION MATCHES CLOUDFLARE!)
B2_KEY_ID=<from Backblaze dashboard>
B2_APP_KEY=<from Backblaze dashboard>
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com  # ⚠️ VERIFY THIS REGION
B2_REGION=us-west-004                        # ⚠️ VERIFY THIS REGION

# CDN
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media

# Worker Settings (optional)
WORKER_POLL_INTERVAL=15000
MAX_RETRIES=5
LOG_LEVEL=info
CONCURRENCY=1  # Start with 1, increase if needed
```

---

## 🎯 Quick Win: Test B2 Region Now

**If you want to verify the B2 region issue immediately:**

1. Log into Cloudflare Dashboard
2. Find DNS record for `cdn.ibaproject.bid`
3. Check what the CNAME target is
4. Log into Backblaze B2 Dashboard
5. Check bucket `IBA-Lot-Media` endpoint region
6. If they don't match, update `.env` files before deploying

---

## ✅ Pre-Deployment Checklist

- [ ] Cloudflare CNAME region matches B2_ENDPOINT region
- [ ] Railway worker can reach `raid.ibaproject.bid/health`
- [ ] Railway worker can authenticate to `/pub/download` endpoint
- [ ] Worker environment variables configured correctly
- [ ] Ran smoke test and all CDN URLs load
- [ ] Frontend displays CDN images (not RAID URLs)
- [ ] Soft delete works (detached_at set, 30-day retention)

---

## 📞 If Something Doesn't Work

**Job stuck in pending:**
- Check Railway logs for worker errors
- Verify worker is running (`heroku ps` or Railway dashboard)
- Check `RAID_PUBLISHER_SECRET` matches RAID server

**CDN URLs return 404:**
- B2 region mismatch (see Critical Item #1)
- Object not actually uploaded (check B2 dashboard)
- Cloudflare cache not configured correctly

**Worker can't download from RAID:**
- Railway firewall blocking access
- DNS resolution issue
- Wrong RAID_PUB_ENDPOINT (must be `/pub/download` not `/download`)

**Frontend shows RAID URLs instead of CDN:**
- Check `MediaImage.tsx` or wherever images render
- Should use `cdn_url` field from database
- Never construct URLs with `raid.ibaproject.bid`

---

## 📝 Summary for Planner Team

**Architecture Status:** ✅ Correct and aligned with authoritative guide

**Implementation Status:** ✅ Complete with proper patterns

**Deployment Blockers:**
1. ⚠️ Must verify B2 region matches Cloudflare CNAME
2. ⚠️ Must verify Railway → RAID connectivity
3. ⚠️ Must configure real secrets in Railway

**Risk Level:** Low - architecture is sound, only configuration verification needed

**Estimated Time to Production Ready:** 30 minutes (assuming no connectivity issues)
