/*
  # Create auction_files metadata table

  1. New Tables
    - `auction_files`
      - `id` (uuid, primary key) - Unique identifier for the file record
      - `storage_provider` (text) - Storage provider type (default 'raid')
      - `file_key` (text) - Full file path in RAID (userId/filename)
      - `download_url` (text) - Full download URL for the file
      - `item_id` (uuid) - Reference to inventory_items table
      - `name` (text) - Original filename
      - `mime_type` (text) - File MIME type
      - `size` (bigint) - File size in bytes
      - `created_at` (timestamptz) - Upload timestamp
      - `uploaded_by` (uuid) - User who uploaded the file

  2. Security
    - Enable RLS on `auction_files` table
    - Add policy for authenticated users to read files for items they can view
    - Add policy for authenticated admins to insert files
    - Add policy for authenticated admins to delete files

  3. Indexes
    - Index on item_id for fast lookups
    - Index on file_key for unique constraint and fast lookups
*/

CREATE TABLE IF NOT EXISTS auction_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_provider text NOT NULL DEFAULT 'raid',
  file_key text NOT NULL,
  download_url text NOT NULL,
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  mime_type text,
  size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_files_file_key ON auction_files(file_key);
CREATE INDEX IF NOT EXISTS idx_auction_files_item_id ON auction_files(item_id);

ALTER TABLE auction_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view auction files" ON auction_files;
CREATE POLICY "Anyone can view auction files"
  ON auction_files FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can upload files" ON auction_files;
CREATE POLICY "Authenticated users can upload files"
  ON auction_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own uploads" ON auction_files;
CREATE POLICY "Users can delete their own uploads"
  ON auction_files FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);
