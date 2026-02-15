# B2 Setup Guide - Quick Start

## What You Need to Do

Your system now uploads **directly to YOUR Backblaze B2 bucket**. To make it work, you need to add your B2 credentials.

## Step 1: Get Your B2 Credentials

1. **Log into Backblaze B2:** https://www.backblaze.com/b2/sign-in.html

2. **Create an Application Key:**
   - In the left menu, click "App Keys"
   - Click "Add a New Application Key"
   - Name: `auction-webapp`
   - Select your bucket (or "All")
   - Click "Create New Key"
   - **IMPORTANT:** Copy the credentials immediately (you can't see the key again!)
     - `keyID` - this is your `B2_KEY_ID`
     - `applicationKey` - this is your `B2_APP_KEY`

3. **Get Your Bucket Information:**
   - In the left menu, click "Buckets"
   - Find your bucket name (e.g., `iba-lot-media`)
   - Click on the bucket
   - Look for the endpoint information:
     - Example: `s3.us-west-004.backblazeb2.com`
     - The region is the part after `s3.` (e.g., `us-west-004`)

4. **Get Your CDN URL:**
   - In your bucket settings, look for "Friendly URL" or "CDN URL"
   - Example: `https://f004.backblazeb2.com/file/iba-lot-media`

## Step 2: Update Your .env File

Open your `.env` file and update these values:

```bash
# Replace with your actual values:
B2_KEY_ID=your_actual_key_id_here
B2_APP_KEY=your_actual_application_key_here
B2_BUCKET=your-bucket-name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
VITE_CDN_BASE_URL=https://f004.backblazeb2.com/file/your-bucket-name
```

### Example with Real Values:

```bash
B2_KEY_ID=0041234567890abcdef
B2_APP_KEY=K001a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r
B2_BUCKET=iba-lot-media
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
VITE_CDN_BASE_URL=https://f004.backblazeb2.com/file/iba-lot-media
```

## Step 3: Test It

1. **Delete all items** in your webapp
2. **Empty your B2 bucket** (so you start clean)
3. **Create a new item** and add 2 pictures
4. **Check your B2 bucket:**
   - You should see exactly 2 files
   - Located at: `items/{item_id}/filename1.jpg` and `items/{item_id}/filename2.jpg`
   - No extra folders, no duplicates

5. **Check the webapp:**
   - Both images should display immediately
   - No "Processing..." messages
   - Images load from your B2 CDN

## What Happens Now

```
User uploads file
    ↓
Edge Function receives it
    ↓
Edge Function uploads to YOUR B2 bucket
    ↓
Returns CDN URL
    ↓
Webapp saves URL to database
    ↓
Image displays immediately
```

**No intermediary storage. No worker. No delays. Just YOUR B2 bucket.**

## Troubleshooting

### Problem: "B2 configuration missing" error

**Solution:** Make sure all B2 variables are set in `.env`:
- `B2_KEY_ID`
- `B2_APP_KEY`
- `B2_BUCKET`
- `B2_ENDPOINT`
- `B2_REGION`
- `VITE_CDN_BASE_URL`

### Problem: "Access Denied" error

**Solution:**
- Check that your Application Key has write permissions
- Verify the bucket name is correct
- Make sure the key is for the correct bucket (or "All" buckets)

### Problem: Images not displaying

**Solution:**
- Check that your bucket is set to "Public" (not private)
- Verify the CDN URL is correct
- Check browser console for CORS errors

### Problem: Still seeing old worker/RAID behavior

**Solution:**
- Make sure you're using the new `GlobalInventoryManagement` component
- Clear browser cache
- Check that the Edge Function is deployed

## Edge Function Status

The Edge Function `upload-to-b2` has been deployed to your Supabase project. It automatically has access to your environment variables through Supabase's secrets system.

You don't need to manually configure secrets - they're pulled from your `.env` file automatically.

## Need Help?

Check the full documentation in `DIRECT_B2_STORAGE_MIGRATION.md`
