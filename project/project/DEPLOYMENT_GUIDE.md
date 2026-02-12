# Deployment Guide - Option A Integration

This guide walks you through deploying the auction website with IronDrive integration using Option A (clean separation).

## Architecture Overview

**Option A: Clean Separation**
- **Auction Website Supabase** (`sbhdjnchafboizbnqsmp`): Stores user roles and file upload metadata
- **IronDrive Supabase** (`utrmoxkjpviruijfjgps`): Stores images and hosts edge functions

## Step 1: Setup Auction Website Database

1. Go to auction website SQL editor: https://supabase.com/dashboard/project/sbhdjnchafboizbnqsmp/sql/new

2. Copy the SQL from `supabase/migrations/20250110_option_a_integration.sql`

3. Run the SQL to create:
   - `user_roles` table
   - `file_uploads` table
   - RLS policies
   - Helper functions

4. Get your user ID:
   ```sql
   SELECT id, email FROM auth.users;
   ```

5. Make yourself admin (replace YOUR_USER_ID):
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('YOUR_USER_ID', 'admin');
   ```

6. Verify:
   ```sql
   SELECT * FROM public.user_roles;
   ```

## Step 2: Setup IronDrive Storage

1. Go to IronDrive storage: https://supabase.com/dashboard/project/utrmoxkjpviruijfjgps/storage/buckets

2. Click "New bucket"

3. Configure:
   - Name: `ecommerce-images`
   - Public: **Yes**
   - Click "Create bucket"

## Step 3: Deploy IronDrive Edge Functions

Open your **IronDrive AI assistant** and tell it:

```
I need to deploy three edge functions. Please read the file DEPLOY_EDGE_FUNCTIONS.md from my auction website project and deploy:

1. ecommerce-auth
2. ecommerce-upload
3. ecommerce-images

Deploy them to my Supabase project.
```

The AI will deploy all three functions for you.

## Step 4: Test the Integration

1. Open your auction website admin panel

2. Navigate to the "IronDrive" tab

3. Click "Test Connection"

4. You should see: "Successfully connected to IronDrive!"

## Step 5: Test Image Upload

1. In admin panel, go to "Inventory" tab

2. Click "Add Inventory Item"

3. Fill out the form and upload an image

4. The image should upload successfully and display

5. Check IronDrive storage to verify the image was stored:
   https://supabase.com/dashboard/project/utrmoxkjpviruijfjgps/storage/buckets/ecommerce-images

6. Check auction website database to verify metadata was saved:
   ```sql
   SELECT * FROM public.file_uploads ORDER BY uploaded_at DESC LIMIT 10;
   ```

## Troubleshooting

### Connection Test Fails

1. Verify edge functions are deployed:
   - Go to: https://supabase.com/dashboard/project/utrmoxkjpviruijfjgps/functions
   - Should see: ecommerce-auth, ecommerce-upload, ecommerce-images

2. Check function logs for errors

3. Verify environment variables in `.env`:
   ```
   VITE_IRONDRIVE_SUPABASE_URL=https://utrmoxkjpviruijfjgps.supabase.co
   VITE_IRONDRIVE_SUPABASE_ANON_KEY=<your-key>
   ```

### Upload Fails

1. Check storage bucket exists and is public

2. Check edge function logs for errors

3. Verify user has admin or subadmin role:
   ```sql
   SELECT * FROM user_roles WHERE user_id = 'YOUR_USER_ID';
   ```

4. Check browser console for error messages

### Images Don't Display

1. Verify the image URL is accessible in browser

2. Check CORS headers are set correctly in edge functions

3. Verify storage bucket is public

## Next Steps

Once everything is working:

1. Add more users and assign roles
2. Upload inventory items with images
3. Create auctions with inventory
4. Monitor upload stats in admin panel

## Support

If you encounter issues:

1. Check function logs in Supabase dashboard
2. Check browser console for errors
3. Review `TESTING_CHECKLIST.md` for common issues
4. Verify all steps were completed in order
