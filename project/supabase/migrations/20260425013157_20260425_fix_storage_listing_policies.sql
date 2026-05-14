/*
  # Fix Storage Bucket Listing Policies

  ## Summary
  Removes broad SELECT policies on public storage buckets that allow clients to
  enumerate (list) all files. Public buckets serve files by direct URL without
  needing a SELECT policy — the listing capability only exposes more data than
  necessary.

  ## Changes
  - DROP broad SELECT ("Public can read files") on auction-files bucket
  - DROP broad SELECT ("Anyone can view avatars") on avatars bucket
  - DROP broad SELECT ("Public read consigner docs") on consigner-documents bucket
  - DROP broad SELECT ("Public can view event images") on event-images bucket

  ## Notes
  - Dropping these SELECT policies does NOT break image/file loading via direct CDN
    URLs — public buckets serve objects by URL regardless of storage RLS policies
  - This only prevents clients from calling storage.list() to enumerate all filenames
  - Upload, update, and delete policies on these buckets are NOT changed
*/

DROP POLICY IF EXISTS "Public can read files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read consigner docs" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;
