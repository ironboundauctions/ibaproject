# Railway Worker Configuration - CONFIRMED

**Date:** 2026-02-14
**Status:** ✅ Configured with correct B2 region

---

## B2 Configuration (Verified from Screenshot)

```bash
# From Backblaze Dashboard - IBA-Lot-Media bucket
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-east-005.backblazeb2.com
B2_REGION=us-east-005

# User-provided credentials (already added to Railway)
B2_KEY_ID=<from_backblaze_app_keys>
B2_APP_KEY=<from_backblaze_app_keys>
```

**Bucket Details:**
- Bucket ID: `8cc9c2cd977e3b3390ce0d17`
- Type: Public
- Endpoint: `s3.us-east-005.backblazeb2.com`
- File Lifecycle: Keep prior versions for days

---

## Complete Railway Environment Variables

User confirms all these are set on Railway:

```bash
# Database
DATABASE_URL=postgresql://postgres.sbhdjnchafboizbnqsmp:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# RAID Configuration
RAID_PUBLISHER_SECRET=<user_provided>
RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download

# B2 Storage (CONFIRMED CORRECT REGION)
B2_KEY_ID=<user_provided>
B2_APP_KEY=<user_provided>
B2_BUCKET=IBA-Lot-Media
B2_ENDPOINT=s3.us-east-005.backblazeb2.com
B2_REGION=us-east-005

# CDN
CDN_BASE_URL=https://cdn.ibaproject.bid/file/IBA-Lot-Media

# Worker Settings (optional)
WORKER_POLL_INTERVAL=15000
MAX_RETRIES=5
LOG_LEVEL=info
CONCURRENCY=1
```

---

## Next Steps: Production Testing

### 1. Test Railway → RAID Connectivity

From Railway shell:
```bash
curl -I https://raid.ibaproject.bid/health
# Expected: 200 OK
```

### 2. Test Railway → RAID Download with Auth

```bash
# Use actual RAID_PUBLISHER_SECRET from Railway
curl -I -H "X-Auction-Publisher: YOUR_SECRET" \
  https://raid.ibaproject.bid/pub/download/test/test
# Expected: 404 (auth works, file doesn't exist)
# NOT Expected: 401 (wrong secret) or timeout (can't reach)
```

### 3. Upload Test Image

1. Admin panel → Upload image to RAID
2. Create inventory item
3. Attach uploaded image
4. Wait 15-30 seconds

### 4. Verify Worker Processing

Check Railway logs for:
```
[INFO] Processing job...
[INFO] Downloading from RAID...
[INFO] Generating thumbnail...
[INFO] Generating display variant...
[INFO] Uploading to B2...
[INFO] Job completed successfully
```

### 5. Check Database

```sql
-- Check variants created
SELECT variant, cdn_url, b2_key, published_status
FROM auction_files
WHERE asset_group_id = '<from_test_image>'
ORDER BY variant;
```

Should show:
- `source` - published, b2_key=null, cdn_url=null
- `thumb` - published, b2_key=assets/{id}/thumb.webp, cdn_url=https://cdn...
- `display` - published, b2_key=assets/{id}/display.webp, cdn_url=https://cdn...

### 6. Test CDN URL

```bash
curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{id}/display.webp
# Expected: 200 OK, content-type: image/webp
```

### 7. View in Frontend

- Open item in public auction interface
- Verify image displays from `cdn.ibaproject.bid`
- Not from `raid.ibaproject.bid`

---

## Cloudflare CDN Verification

**Critical:** Verify Cloudflare CDN points to correct B2 bucket

```bash
# Check DNS
dig cdn.ibaproject.bid CNAME

# Should resolve to something like:
# cdn.ibaproject.bid -> IBA-Lot-Media.s3.us-east-005.backblazeb2.com
```

If CDN configuration is incorrect:
1. Login to Cloudflare dashboard
2. Navigate to DNS settings for ibaproject.bid
3. Find CNAME record for `cdn`
4. Should point to: `IBA-Lot-Media.s3.us-east-005.backblazeb2.com`

---

## Troubleshooting

### Worker Can't Download from RAID
**Symptom:** Worker logs show 401 or timeout errors

**Solutions:**
1. Verify `RAID_PUBLISHER_SECRET` matches RAID server config
2. Check Railway can reach raid.ibaproject.bid (firewall rules)
3. Verify endpoint is `/pub/download` not `/download`

### Images Upload to B2 but CDN 404
**Symptom:** B2 bucket has files, CDN returns 404

**Solutions:**
1. Check Cloudflare CNAME points to `us-east-005` region
2. Verify bucket name in CNAME: `IBA-Lot-Media`
3. Check B2 bucket CORS rules allow Cloudflare

### Worker Not Processing Jobs
**Symptom:** Jobs stay pending forever

**Solutions:**
1. Check Railway worker is running (not crashed)
2. Check Railway logs for errors
3. Verify `DATABASE_URL` is correct
4. Test database connection from Railway shell:
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM publish_jobs WHERE status='pending'"
   ```

---

## Status Checklist

- [x] B2 region confirmed: `us-east-005`
- [x] Railway environment variables configured
- [x] All secrets added to Railway
- [ ] Test Railway → RAID connectivity
- [ ] Test Railway → B2 upload
- [ ] Verify Cloudflare CDN configuration
- [ ] End-to-end test with real image
- [ ] Monitor Railway logs during test
- [ ] Verify CDN URLs work in browser

**Estimated Time to First Upload:** 5 minutes (after connectivity tests pass)
