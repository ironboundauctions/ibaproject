# RAID Storage Integration - DO NOT DEVIATE

## ⚠️ CRITICAL: These rules MUST be followed exactly to maintain RAID connectivity

---

## Quick Reference for Frontend (TL;DR)

**Keep doing exactly what's implemented:**
1. ✅ Always send `X-User-Id: e9478d39-cde3-4184-bf0b-0e198ef029d2` header (exact UUID, no angle brackets, no email)
2. ✅ Use `https://raid.ibaproject.bid` (never change this host)
3. ✅ URL-encode filenames/paths when building RAID URLs
4. ✅ Use `download_base` from `/health` response when present
5. ✅ Upload via multipart/form-data with "files" key (never JSON)
6. ✅ Build `file_key` as `${SERVICE_USER_ID}/${serverFilename}`
7. ✅ Build `download_url` as `${download_base}/${file_key}`
8. ✅ nginx guarantees large uploads: client_max_body_size 2G and 30-min timeouts (client/proxy/send/read/connect). Don't assume FE needs to chunk; server is configured to accept big files.

**If CORS error appears:**
- It's likely your origin is not on the server allow-list
- Contact server ops to add origin to nginx CORS configuration
- Currently allowed: `https://ibaproject.bid`, `https://www.ibaproject.bid`, `https://irondrive.ibaproject.bid`

**If RAID is offline:**
- Show "RAID unavailable" banner
- Block uploads until RAID is back online
- Do NOT silently fall back to cloud storage (by design)

**X-User-Id semantics:**
- Must be the service account UUID from Auction Supabase
- Shared storage identity for all auction users
- Don't switch to per-user UUIDs without coordinated server + DB change

**Request formats:**
- **Health:** `GET /health` (no body, read `download_base`)
- **Upload:** `POST /upload` multipart/form-data with `X-User-Id` header
- **Delete:** `DELETE /files/<serviceUserId>/<encodedFilename>` with `X-User-Id`
- **Create folder:** `POST /create-folder` JSON `{ userId, folder }` + `X-User-Id`

**Dev/Preview environments:**
- For temporary preview domains, ask server to allow-list the origin
- Alternative: Use local proxy/split-DNS pointing raid.ibaproject.bid to server

---

### Constants (NEVER CHANGE)
```javascript
SERVICE_USER_ID = "e9478d39-cde3-4184-bf0b-0e198ef029d2"
RAID_BASE = "https://raid.ibaproject.bid"
AUCTION_ORIGINS = ["https://ibaproject.bid", "https://www.ibaproject.bid", "https://irondrive.ibaproject.bid"]
```

### Required Header on ALL RAID Requests
```javascript
X-User-Id: "e9478d39-cde3-4184-bf0b-0e198ef029d2"
```

**EVERY** request to RAID must include this header. No exceptions.

**CRITICAL:** The `X-User-Id` value must be the exact UUID string above:
- ✅ Correct: `"e9478d39-cde3-4184-bf0b-0e198ef029d2"`
- ❌ Wrong: `<e9478d39-cde3-4184-bf0b-0e198ef029d2>` (no angle brackets)
- ❌ Wrong: Email addresses (never use email)
- ❌ Wrong: Per-user UUIDs (must use the service account UUID)

**DO NOT** switch to per-user UUIDs without a coordinated server + database change.

---

---

## CORS and Origins

### Allowed Origins (Server Allow-List)
The RAID server has a strict CORS policy. Only these origins are allowed:
- `https://ibaproject.bid`
- `https://www.ibaproject.bid`
- `https://irondrive.ibaproject.bid`

### Adding New Origins
If the frontend moves to a new domain, subdomain, or preview URL:
1. **DO NOT** attempt to change the RAID host or work around CORS
2. Contact server operations to add the new origin to nginx CORS allow-list
3. Wait for server configuration update before deploying to new origin

### CORS Error Handling
If you encounter a CORS error:
- ✅ Assume the origin is not on the server allow-list
- ✅ Contact server ops to add the origin
- ❌ DO NOT try to proxy requests through your own backend
- ❌ DO NOT change the RAID host URL
- ❌ DO NOT disable or work around CORS checks

### Dev/Preview Environments
For temporary preview domains, choose one option:
1. **Preferred:** Ask server ops to allow-list the preview origin
2. **Alternative:** Use a local proxy/split-DNS pointing `raid.ibaproject.bid` to the server

**NEVER** use a different RAID host. Always use `https://raid.ibaproject.bid`.

---

## Upload Flow

### 1. Health Check
```javascript
GET /health
Headers: { "X-User-Id": SERVICE_USER_ID }
Response: { download_base: "https://raid.ibaproject.bid/download", ... }

// ALWAYS use download_base from health response when present
// DO NOT hardcode the download base URL
```

### 2. Upload Files
```javascript
POST /upload
Headers: { "X-User-Id": SERVICE_USER_ID }
Body: multipart/form-data with key "files" (NOT JSON!)

// Example:
const formData = new FormData();
files.forEach(file => formData.append('files', file));

// CRITICAL: Must be multipart/form-data, NOT application/json
// DO NOT set Content-Type header manually - browser sets it with boundary
```

### 3. Process Response
```javascript
// Response structure:
{
  success: true,
  files: [
    {
      filename: "abc123.jpg",        // Server-assigned name
      originalName: "photo.jpg",
      size: 12345,
      mimeType: "image/jpeg"
    }
  ]
}

// Build metadata:
for (let i = 0; i < response.files.length; i++) {
  const file_key = `${SERVICE_USER_ID}/${response.files[i].filename}`;
  const download_url = `${download_base}/${file_key}`;

  // URL encoding: Only encode the filename portion, NOT the UUID
  // Correct: https://raid.ibaproject.bid/download/e9478d39.../my%20file.jpg
  // Wrong:   https://raid.ibaproject.bid/download/e9478d39...%2Fmy%20file.jpg
}
```

### 4. Save to Database
```sql
INSERT INTO public.auction_files (
  storage_provider,
  file_key,
  download_url,
  item_id,
  name,
  mime_type,
  size,
  uploaded_by
) VALUES (
  'raid',
  'e9478d39-cde3-4184-bf0b-0e198ef029d2/abc123.jpg',
  'https://raid.ibaproject.bid/download/e9478d39-cde3-4184-bf0b-0e198ef029d2/abc123.jpg',
  <item_uuid>,
  'photo.jpg',
  'image/jpeg',
  12345,
  <user_uuid>
);
```

---

## Download Flow

### Preferred Method (Use DB)
```javascript
const { data } = await supabase
  .from('auction_files')
  .select('download_url')
  .eq('file_key', file_key)
  .single();

// Use data.download_url directly
```

### Rebuild Method (If Needed)
```javascript
// Parse file_key: "e9478d39-cde3-4184-bf0b-0e198ef029d2/abc123.jpg"
const [userId, ...filenameParts] = file_key.split('/');
const filename = filenameParts.join('/');

// Build URL with proper encoding
const download_url = `https://raid.ibaproject.bid/download/${userId}/${encodeURIComponent(filename)}`;
```

**NEVER encode the entire file_key!**

---

## Delete Flow

### 1. Parse file_key
```javascript
// file_key = "e9478d39-cde3-4184-bf0b-0e198ef029d2/abc123.jpg"
const [userId, ...parts] = file_key.split('/');
const serverFilename = parts.join('/');
```

### 2. Send DELETE request
```javascript
DELETE /files/${SERVICE_USER_ID}/${encodeURIComponent(serverFilename)}
Headers: { "X-User-Id": SERVICE_USER_ID }

// Example:
// DELETE /files/e9478d39-cde3-4184-bf0b-0e198ef029d2/abc123.jpg
// For files with spaces: /files/e9478d39.../my%20file.jpg

// ALWAYS URL-encode the filename portion
// DO NOT URL-encode the service user ID
```

### 3. Delete from database
```javascript
await supabase
  .from('auction_files')
  .delete()
  .eq('file_key', file_key);
```

---

## Create Folder Flow

```javascript
POST /create-folder
Headers: {
  "X-User-Id": SERVICE_USER_ID,
  "Content-Type": "application/json"
}
Body: {
  "userId": SERVICE_USER_ID,
  "folder": "folderName"
}
```

---

## Database Invariants (public.auction_files)

### Schema
```sql
CREATE TABLE auction_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_provider text NOT NULL DEFAULT 'raid',
  file_key text NOT NULL,                    -- EXACT: <SERVICE_USER_ID>/<serverFilename>
  download_url text NOT NULL,                 -- Full URL from RAID
  item_id uuid REFERENCES inventory_items(id),
  name text NOT NULL,                         -- Original filename
  mime_type text,
  size bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_auction_files_file_key ON auction_files(file_key);
```

### Critical Rules
- `file_key` format: **EXACTLY** `<SERVICE_USER_ID>/<serverFilename>`
- `storage_provider` must be `'raid'`
- `download_url` must be the full URL returned from RAID
- **NEVER** store local paths
- **NEVER** modify file_key format

---

---

## Error Handling

### CORS Errors
```javascript
// If fetch fails with CORS error:
try {
  const response = await fetch(raidUrl, options);
} catch (error) {
  if (error.message.includes('CORS') || error.name === 'TypeError') {
    // Assume origin not allowed
    console.error('[RAID] CORS error - origin not on allow-list');
    // Contact server ops to add origin
    // DO NOT attempt workarounds
  }
}
```

**Action:** Contact server operations to add your origin to the nginx CORS allow-list.

### RAID Offline/Timeout
```javascript
// If RAID is offline or times out:
const health = await IronDriveService.checkHealth();
if (!health.raidAvailable) {
  // Show "RAID unavailable" banner
  // Block uploads until RAID is back online
  // DO NOT fall back to cloud storage
}
```

**Critical:** By design, this app does NOT fall back to cloud storage when RAID is offline. Show users a clear message that RAID storage is unavailable.

### Network Errors
```javascript
// Handle timeouts and network issues
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
  const response = await fetch(raidUrl, {
    signal: controller.signal,
    ...options
  });
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('[RAID] Request timeout');
  } else {
    console.error('[RAID] Network error:', error);
  }
  // Show appropriate error to user
} finally {
  clearTimeout(timeoutId);
}
```

### Server Error Responses
- **4xx errors:** Client-side issue (bad request, unauthorized, not found)
  - Check `X-User-Id` header is present and correct
  - Verify file_key format
  - Check URL encoding
- **5xx errors:** Server-side issue
  - Log error and show "RAID server error" to user
  - Retry after delay if appropriate
  - Contact server ops if persistent

---

## FORBIDDEN Actions

### ❌ DO NOT:
1. Remove or rename the `X-User-Id` header
2. Use email instead of `SERVICE_USER_ID`
3. Use angle brackets around the UUID (`<UUID>`)
4. Switch to per-user UUIDs without coordinated server/DB changes
5. Send JSON to `/upload` (must be multipart/form-data with key "files")
6. Save local file paths instead of `files[i].filename`
7. URL-encode the entire `file_key` (only encode filename portion)
8. Change the `file_key` format from `<UUID>/<filename>`
9. Skip the `X-User-Id` header on ANY request
10. Hardcode the `download_base` (always get from `/health`)
11. Change the RAID host URL from `https://raid.ibaproject.bid`
12. Work around CORS errors (contact server ops instead)
13. Fall back to cloud storage when RAID is offline
14. Proxy RAID requests through your own backend
15. Deploy to new origins without getting them allow-listed first

---

## Required Logging

Add these console logs for debugging:

```javascript
// Health check
console.log('[RAID] HEALTH OK (raid) download_base=...', downloadBase);

// Upload
console.log('[RAID] UPLOAD via RAID → file_key=...', file_key, 'url=...', download_url);

// Delete
console.log('[RAID] DELETE via RAID → file_key=...', file_key);
```

---

## Quick Guards (Add to Tests/Linting)

### Assert X-User-Id Header
```javascript
// Before every RAID request
if (!headers['X-User-Id'] || headers['X-User-Id'] !== SERVICE_USER_ID) {
  throw new Error('X-User-Id header missing or incorrect');
}
```

### Assert FormData Usage
```javascript
// Upload must use FormData
if (!(body instanceof FormData)) {
  throw new Error('Upload body must be FormData');
}
if (!body.has('files')) {
  throw new Error('FormData must have "files" key');
}
```

### Assert Delete Path Format
```javascript
// Delete path must match pattern
const expectedPath = `/files/${SERVICE_USER_ID}/${encodeURIComponent(serverFilename)}`;
if (path !== expectedPath) {
  throw new Error(`Delete path incorrect. Expected: ${expectedPath}, Got: ${path}`);
}
```

---

## Implementation Checklist

- [x] `X-User-Id` header on health check
- [x] `X-User-Id` header on upload
- [x] `X-User-Id` header on delete
- [x] `X-User-Id` header on create-folder
- [x] Upload uses FormData with "files" key
- [x] Build `file_key` as `${SERVICE_USER_ID}/${filename}`
- [x] Build `download_url` as `${download_base}/${file_key}`
- [x] Only encode filename portion of URL
- [x] Save to `auction_files` with `storage_provider='raid'`
- [x] Delete uses correct path format
- [x] Prefer DB `download_url` for downloads
- [x] Logging for health, upload, delete

---

## If Something Breaks

**BEFORE making ANY changes:**
1. Review this document
2. Verify ALL rules are being followed
3. Check that `X-User-Id` header is present on ALL requests
4. Verify FormData usage on upload
5. Check file_key format in database
6. Verify URL encoding (only filename, not UUID)
7. Review console logs for RAID operations

**THEN** make changes while maintaining these rules.

---

## Service Configuration

### Environment Variables
```bash
VITE_IRONDRIVE_API=https://raid.ibaproject.bid
```

### Service User ID
```
e9478d39-cde3-4184-bf0b-0e198ef029d2
```

This UUID is hardcoded and must NEVER change without coordinating with RAID server configuration.

---

## Contact

If RAID integration breaks and you cannot resolve it by following these rules, contact the server AI team before making structural changes to the integration code.
