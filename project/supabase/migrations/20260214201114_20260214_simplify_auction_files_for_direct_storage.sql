/*
  # Simplify auction_files for Direct B2 Storage

  ## Changes
  1. Remove all worker/processing related columns
     - Remove: storage_provider, file_key, download_url, download_url_backup
     - Remove: source_user_id, thumb_url, display_url, publish_status, published_at
     - Remove: deleted_at, cdn_key_prefix, asset_group_id, file_type, variant
     - Remove: cdn_url, width, height, duration_seconds
  
  2. Add simple new columns
     - file_path: Path in Supabase Storage
     - url: Public URL to the file
     - is_video: Boolean flag for videos
  
  3. Keep essential columns
     - id, item_id, name, mime_type, size, created_at, uploaded_by

  ## Result
  Clean, simple table for direct B2 uploads via Supabase Storage.
  One file = One row with its public URL. No processing, no workers.
*/

-- Drop the old auction_files table entirely
DROP TABLE IF EXISTS auction_files CASCADE;

-- Create new simplified auction_files table
CREATE TABLE auction_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  url text NOT NULL,
  name text NOT NULL,
  mime_type text,
  size bigint,
  is_video boolean DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_auction_files_item_id ON auction_files(item_id);
CREATE INDEX idx_auction_files_created_at ON auction_files(created_at);

-- Enable RLS
ALTER TABLE auction_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view auction files"
  ON auction_files FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert auction files"
  ON auction_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their uploaded files"
  ON auction_files FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their uploaded files"
  ON auction_files FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());
