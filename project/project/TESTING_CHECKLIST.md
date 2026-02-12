# RAID Integration Testing Checklist

## Quick In-Browser Tests (DevTools Console)

### 1. Health Check Test
Open DevTools Console and run:

```javascript
fetch('https://raid.ibaproject.bid/health', {
  headers: { 'Origin': location.origin }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

**Expected Response:**
```json
{
  "status": "ok",
  "provider": "raid",
  "download_base": "https://raid.ibaproject.bid/download"
}
```

### 2. Upload Smoke Test
```javascript
const svc='e9478d39-cde3-4184-bf0b-0e198ef029d2';
const fd=new FormData();
fd.append('files', new Blob(['hello-from-auction-fe'], {type:'text/plain'}), 'hello.txt');
fetch('https://raid.ibaproject.bid/upload', {
  method:'POST',
  headers:{'X-User-Id':svc},
  body:fd
})
  .then(r=>r.json())
  .then(console.log)
  .catch(console.error);
```

**Expected Response:**
```json
{
  "success": true,
  "files": [{
    "filename": "abc123.txt",
    "originalName": "hello.txt",
    "size": 22,
    "mimeType": "text/plain"
  }]
}
```

### 3. Check Global RAID State
```javascript
// Access via browser console when on site
// IronDriveService.getRaidState() - if exported to window for debugging
```

---

## Console Logs to Watch For

### On Page Load
```
[RAID] SERVICE_USER_ID e9478d39-cde3-4184-bf0b-0e198ef029d2
[RAID] Checking health at: https://raid.ibaproject.bid/health
[RAID] Health response: { status: 'ok', provider: 'raid', ... }
[RAID] HEALTH OK (raid) download_base=https://raid.ibaproject.bid/download
```

### Before Upload
```
[RAID] upload gate check {
  ok: true,
  provider: 'raid',
  downloadBase: 'https://raid.ibaproject.bid/download',
  lastChecked: 1234567890
}
```

### During Upload
```
[RAID] UPLOAD via RAID → Uploading 2 files for inventory ABC123
[RAID] Upload response: { success: true, files: [...] }
[RAID] UPLOAD via RAID → file_key=e9478d39.../abc.jpg url=https://raid.ibaproject.bid/download/...
```

### If Upload Blocked
```
[RAID] upload gate check { ok: false, provider: null, ... }
[RAID] Gate refused. last health: { ok: false, provider: null, ... }
```

## Success Criteria

All of the following should be true:
- Console shows `[RAID] SERVICE_USER_ID` on page load
- Test connection button reports RAID active
- Can upload images through inventory form
- `[RAID] upload gate check` shows `ok: true, provider: 'raid'`
- No CORS errors in console
