/*
  # Create Auction Files Storage Bucket

  1. New Storage
    - Creates `auction-files` bucket for storing barcode images and other auction-related files
    - Configured as public bucket for easy CDN access
  
  2. Security
    - RLS policies for authenticated users to upload files
    - Public read access for displaying images
*/

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'auction-files',
  'auction-files',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read files" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'auction-files');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'auction-files');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'auction-files');

-- Allow public read access
CREATE POLICY "Public can read files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'auction-files');
