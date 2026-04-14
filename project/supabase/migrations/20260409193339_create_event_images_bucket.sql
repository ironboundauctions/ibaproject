/*
  # Create event-images Storage Bucket

  ## Summary
  Creates a dedicated Supabase Storage bucket for auction event cover images.

  ## Details
  - New bucket: `event-images`
    - Public read access (images are displayed on the public-facing auction site)
    - Authenticated users with admin role can upload
    - One image per event, stored at path: `{eventId}/cover.{ext}`
    - Max file size: 10MB
    - Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

  ## Security
  - Public SELECT: anyone can view event images
  - INSERT/UPDATE/DELETE: only authenticated users (admins manage events)
*/

-- Create the event-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Allow anyone to read event images (public bucket)
CREATE POLICY "Public can view event images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-images');

-- Allow authenticated users to upload event images
CREATE POLICY "Authenticated users can upload event images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-images');

-- Allow authenticated users to update event images
CREATE POLICY "Authenticated users can update event images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-images')
  WITH CHECK (bucket_id = 'event-images');

-- Allow authenticated users to delete event images
CREATE POLICY "Authenticated users can delete event images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-images');
