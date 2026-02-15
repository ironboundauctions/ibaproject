# Next Steps - Worker Testing

**Status:** ✅ Railway worker can reach RAID (health check passed)

---

## Step 2: Test Authenticated RAID Download

From Railway worker shell (Dashboard → Worker Service → Shell or `railway run`):

```bash
curl -I -H "X-Auction-Publisher: $RAID_PUBLISHER_SECRET" \
  https://raid.ibaproject.bid/pub/download/test/fake-file.jpg
```

**What you should see:**
- ✅ **404 Not Found** = Auth works! (file doesn't exist, but auth passed)
- ❌ **401 Unauthorized** = Wrong secret in Railway env vars
- ❌ **403 Forbidden** = Wrong endpoint or secret

---

## Step 3: Test B2 Connection (Optional)

If you have Node.js available in Railway shell:

```bash
node -e "console.log('B2_ENDPOINT:', process.env.B2_ENDPOINT)"
node -e "console.log('B2_REGION:', process.env.B2_REGION)"
node -e "console.log('B2_BUCKET:', process.env.B2_BUCKET)"
```

Should output:
```
B2_ENDPOINT: s3.us-east-005.backblazeb2.com
B2_REGION: us-east-005
B2_BUCKET: IBA-Lot-Media
```

---

## Step 4: End-to-End Test with Real Image

### A. Upload image via admin panel

1. Login to your app as admin
2. Go to Global Inventory Management
3. Click "Add New Item"
4. Upload a test image (JPEG or PNG)
5. Fill in basic details
6. Save

### B. Watch Railway logs

Railway Dashboard → Worker Service → Logs

Within 15-30 seconds you should see:

```
[INFO] Polling for pending jobs...
[INFO] Found 1 pending jobs
[INFO] Processing job xxx...
[INFO] Downloading from RAID: https://raid.ibaproject.bid/pub/download/...
[INFO] Downloaded 2.5 MB in 1.2s
[INFO] Generating thumbnail...
[INFO] Generated thumb: 45 KB
[INFO] Generating display variant...
[INFO] Generated display: 320 KB
[INFO] Uploading to B2: assets/xxx/thumb.webp
[INFO] Upload complete: thumb.webp
[INFO] Uploading to B2: assets/xxx/display.webp
[INFO] Upload complete: display.webp
[INFO] Job completed successfully in 5.3s
```

### C. Verify in database

Supabase Dashboard → SQL Editor:

```sql
SELECT 
  variant,
  published_status,
  b2_key,
  cdn_url,
  file_size_bytes
FROM auction_files
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC, variant;
```

Should show 3 rows:
- `source`: published_status=published, b2_key=null
- `thumb`: published_status=published, b2_key=assets/{id}/thumb.webp
- `display`: published_status=published, b2_key=assets/{id}/display.webp

### D. Test CDN URL

Copy the `cdn_url` from the `display` row and paste in browser.

Should display the image from `https://cdn.ibaproject.bid/file/IBA-Lot-Media/...`

---

## If Something Goes Wrong

### Worker logs show "401 Unauthorized"
→ `RAID_PUBLISHER_SECRET` in Railway doesn't match RAID server
→ Double-check the secret value

### Worker logs show "403 Forbidden"
→ Check endpoint is `/pub/download` not just base URL
→ Verify `RAID_PUB_ENDPOINT=https://raid.ibaproject.bid/pub/download`

### Worker logs show "ENOTFOUND" or timeout
→ Railway can't reach RAID server
→ Check if RAID has IP whitelist/firewall blocking Railway

### Worker processes job but CDN URL returns 404
→ B2 upload succeeded but CDN can't find it
→ Check Cloudflare CNAME: `cdn.ibaproject.bid` → `IBA-Lot-Media.s3.us-east-005.backblazeb2.com`
→ Verify B2 bucket region matches (us-east-005)

### No logs appear at all
→ Worker may not be running
→ Check Railway Deployments tab shows "Active"
→ Check for startup errors in logs

---

## Success Checklist

- [x] Railway worker deployed
- [x] Health check passed (200 OK)
- [ ] Authenticated download test passed (404 response)
- [ ] Real image uploaded via admin panel
- [ ] Worker processed job successfully (logs show completion)
- [ ] Database shows 3 variants (source, thumb, display)
- [ ] CDN URL loads image in browser
- [ ] Image displays correctly in public auction view

**When all checked:** System is fully operational! 🎉
