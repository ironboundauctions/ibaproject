# RAID Integration Implementation Checklist

## ✅ Completed Implementation

### Configuration
- [x] Environment variable `VITE_IRONDRIVE_API=https://raid.ibaproject.bid` added to `.env`
- [x] Service User ID constant: `e9478d39-cde3-4184-bf0b-0e198ef029d2`
- [x] RAID_BASE: `https://raid.ibaproject.bid`

### Headers (X-User-Id)
- [x] Health check includes `X-User-Id` header
- [x] Upload includes `X-User-Id` header
- [x] Delete includes `X-User-Id` header
- [x] Create folder includes `X-User-Id` header

### Health Check Flow
- [x] GET `/health` endpoint implemented
- [x] Extracts `download_base` from response
- [x] Checks for `raid` in storage provider sources
- [x] Logs: `[RAID] HEALTH OK (raid) download_base=...`
- [x] Periodic health check every 60 seconds
- [x] Caches health status to avoid excessive calls

### Upload Flow
- [x] Uses FormData with field name `"files"`
- [x] Never sends JSON to `/upload`
- [x] POST `/upload` endpoint implemented
- [x] Reads `files[i].filename` from response
- [x] Builds `file_key` as `${SERVICE_USER_ID}/${filename}`
- [x] Builds `download_url` as `${download_base}/${file_key}`
- [x] Only URL-encodes filename portion (not the UUID)
- [x] Logs: `[RAID] UPLOAD via RAID → file_key=... url=...`

### Database Integration
- [x] Migration file created: `20250118_auction_files_metadata.sql`
- [x] Table: `public.auction_files` with correct schema
- [x] Saves `storage_provider='raid'`
- [x] Saves exact `file_key` format: `<SERVICE_USER_ID>/<serverFilename>`
- [x] Saves full `download_url` from RAID
- [x] Saves `item_id`, `name`, `mime_type`, `size`, `uploaded_by`
- [x] Unique index on `file_key`
- [x] Index on `item_id`
- [x] RLS policies enabled

### Download Flow
- [x] Prefers `download_url` from database
- [x] Can rebuild from `file_key` + `download_base`
- [x] `getDownloadUrl()` method implemented
- [x] Only encodes filename portion, not UUID

### Delete Flow
- [x] Parses `serverFilename` from `file_key` (everything after first slash)
- [x] DELETE `/files/${SERVICE_USER_ID}/${encodeURIComponent(serverFilename)}`
- [x] Deletes from database after successful RAID deletion
- [x] Logs: `[RAID] DELETE via RAID → file_key=...`

### Create Folder Flow
- [x] POST `/create-folder` endpoint implemented
- [x] Headers: `X-User-Id` and `Content-Type: application/json`
- [x] Body: `{ "userId": SERVICE_USER_ID, "folder": "folderName" }`

### Error Handling
- [x] RAID unavailable error shown with retry/cancel options
- [x] Warning banner displayed when RAID is down
- [x] Upload blocked when RAID unavailable
- [x] Clear error messages for users

### UI Components
- [x] Test connection button updated for new configuration
- [x] Shows RAID status (connected/disconnected)
- [x] Displays configuration details
- [x] App-wide health banner when RAID unavailable

### Logging
- [x] Health check logs with download_base
- [x] Upload logs with file_key and url
- [x] Delete logs with file_key
- [x] All RAID operations prefixed with `[RAID]`

## 📋 Manual Steps Required

### Database Setup
1. Run the migration file in Supabase SQL Editor:
   ```
   supabase/migrations/20250118_auction_files_metadata.sql
   ```

### Network Configuration
1. Ensure port forwarding is configured for RAID server
2. Verify `raid.ibaproject.bid` resolves correctly
3. Test health endpoint: `https://raid.ibaproject.bid/health`

## 🔍 Verification Steps

### Test Health Check
1. Go to Admin Panel → Inventory Management
2. Click "Test Connection" button
3. Should show: "✅ RAID Storage Active"
4. Check browser console for: `[RAID] HEALTH OK (raid) download_base=...`

### Test Upload
1. Add/Edit an inventory item
2. Upload one or more images
3. Check browser console for upload logs
4. Verify files appear in RAID server
5. Check database `auction_files` table for metadata

### Test Download
1. View an inventory item with images
2. Images should load from RAID download URLs
3. Check Network tab to verify download URLs

### Test Delete
1. Delete an inventory item with images
2. Verify files removed from RAID
3. Verify metadata removed from database

## ⚠️ Forbidden Actions Checklist

- [ ] ❌ DO NOT remove or rename `X-User-Id` header
- [ ] ❌ DO NOT use email instead of `SERVICE_USER_ID`
- [ ] ❌ DO NOT send JSON to `/upload` (must be FormData)
- [ ] ❌ DO NOT save local file paths (use `files[i].filename`)
- [ ] ❌ DO NOT URL-encode entire `file_key`
- [ ] ❌ DO NOT change `file_key` format
- [ ] ❌ DO NOT skip `X-User-Id` header on any request
- [ ] ❌ DO NOT hardcode `download_base`

## 📚 Documentation

- [x] `RAID_INTEGRATION_RULES.md` - Complete rules document
- [x] `RAID_IMPLEMENTATION_CHECKLIST.md` - This checklist
- [x] Migration file with inline documentation
- [x] Code comments in `ironDriveService.ts`

## 🎯 Implementation Files

### Modified Files
- `/src/services/ironDriveService.ts` - Complete rewrite for RAID API
- `/src/components/InventoryItemForm.tsx` - Added RAID error handling
- `/src/components/IronDriveConnectionTest.tsx` - Updated UI for new config
- `/src/App.tsx` - Added health check and warning banner
- `/.env` - Updated with RAID API endpoint

### New Files
- `/supabase/migrations/20250118_auction_files_metadata.sql` - Database schema
- `/RAID_INTEGRATION_RULES.md` - Integration rules
- `/RAID_IMPLEMENTATION_CHECKLIST.md` - This file

## 🚀 Ready for Production

The RAID integration is fully implemented and ready for testing once:
1. Database migration is run
2. RAID server port is accessible
3. Health check returns success

All code follows the server AI's strict rules and includes proper error handling, logging, and user feedback.
