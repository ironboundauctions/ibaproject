# Send This to Planner Team

Copy/paste this entire message to your planner team:

---

## Media Publishing Worker - Critical Questions

We've built the media publishing worker and need answers to these questions before deployment:

### 1. Worker Runtime
**Where does the worker run?**
- Supabase Edge Functions?
- Node.js server (Railway/Render/VPS)?
- How is it scheduled every 30-60 seconds?

### 2. Queue Table Spec
**Does the `publish_jobs` table exist with these fields?**
- `status` (pending/processing/completed/failed)
- `retry_count` and `max_retries` (defaults to 5)
- `error_message` for debugging
- `file_id` reference to `auction_files`

If not, should we create it?

### 3. Reachability Tests
**FROM THE WORKER ENVIRONMENT (not local machine), run these:**

```bash
# Test 1: Health check
curl -v https://raid.ibaproject.bid/health

# Test 2: Download with auth
curl -v \
  -H "X-Auction-Publisher: ${RAID_PUBLISHER_SECRET}" \
  "https://raid.ibaproject.bid/pub/download/{userId}/{storedFilename}"
```

Both must return `200 OK`. Network/firewall rules may block the worker even if your local machine works.

### 4. Idempotency
**Does `auction_files` have this unique constraint?**
```sql
CREATE UNIQUE INDEX idx_auction_files_asset_variant
ON auction_files(asset_group_id, variant);
```

This ensures reruns overwrite (not duplicate). Does it exist?

### 5. B2 Key + CDN Format
**Confirm exact formats:**

B2 Key: `assets/{asset_group_id}/thumb.webp`
CDN URL: `https://cdn.ibaproject.bid/file/IBA-Lot-Media/assets/{asset_group_id}/thumb.webp`

Must include `/file/` in path. Test:
```bash
curl -I https://cdn.ibaproject.bid/file/IBA-Lot-Media/
```
Should return `200 OK` or `403` (not `404`).

### 6. Video is v1 Rehost-Only
**Confirm v1 does NOT transcode video:**
- Download MP4 from RAID
- Upload MP4 to B2 as-is
- Extract metadata only
- No transcoding, no thumbnail generation from frames

Is this correct?

### 7. Cleanup Safety
**Confirm cleanup logic:**
- Deletes B2 objects + DB rows after 30 days
- NEVER touches RAID masters
- "Unused" means: `detached_at IS NOT NULL` AND no active references

30-day retention acceptable? Definition of "unused" correct?

---

## Required to Deploy

Please provide:
1. `RAID_PUBLISHER_SECRET` (API key)
2. `B2_KEY_ID` and `B2_APP_KEY` (Backblaze credentials with delete permission)
3. Confirmation that RAID endpoints are reachable from worker environment

---

## Deployment Blockers

Cannot deploy until:
- [ ] Worker environment decided
- [ ] RAID tested from worker (not local)
- [ ] `publish_jobs` table exists
- [ ] B2 credentials provided
- [ ] CDN URL format confirmed
- [ ] Idempotency constraint exists

Once we have answers, deployment takes 10 minutes via Railway.

---

**Reply with answers to all 7 questions + credentials, and we'll proceed with deployment and testing.**
