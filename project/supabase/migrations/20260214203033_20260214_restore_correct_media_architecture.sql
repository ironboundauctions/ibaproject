/*
  # Restore Correct Media Publishing Architecture

  ## Overview
  This migration restores the correct architecture for the media publishing system
  as defined in the authoritative implementation guide:
  - RAID: Master archive (originals)
  - Worker: Processes and publishes to B2
  - B2: Public variants storage
  - Cloudflare CDN: Public delivery
  
  ## Changes
  
  1. Recreate auction_files table with correct schema
     - asset_group_id: Groups all variants of the same original
     - variant: 'source' | 'thumb' | 'display' | 'video'
     - source_key: RAID file key for source variant
     - b2_key: B2 object key for published variants
     - cdn_url: Cloudflare CDN URL
     - original_name: Human-readable filename
     - bytes: File size
     - mime_type: Content type
     - width, height: Image/video dimensions
     - duration_seconds: Video duration
     - published_status: 'pending' | 'processing' | 'published' | 'failed'
     - detached_at: Soft delete timestamp (30-day retention)
  
  2. Restore publish_jobs table
     - Queue for asynchronous media processing
     - Worker polls this table for pending jobs
  
  3. Create trigger to auto-generate publish jobs
     - When source variant is inserted, create publish job
  
  ## Security
  - RLS enabled on all tables
  - Public can view published media
  - Only admins can manage media
*/

-- Drop the simplified auction_files table
DROP TABLE IF EXISTS auction_files CASCADE;

-- Create auction_files with correct schema (Pattern 1 from guide)
CREATE TABLE auction_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  asset_group_id uuid NOT NULL,
  variant text NOT NULL CHECK (variant IN ('source', 'thumb', 'display', 'video')),
  source_key text,
  b2_key text,
  cdn_url text,
  original_name text NOT NULL,
  bytes bigint,
  mime_type text,
  width integer,
  height integer,
  duration_seconds numeric(10, 2),
  published_status text NOT NULL DEFAULT 'pending' CHECK (published_status IN ('pending', 'processing', 'published', 'failed')),
  detached_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (asset_group_id, variant)
);

-- Create indexes
CREATE INDEX idx_auction_files_item_id ON auction_files(item_id);
CREATE INDEX idx_auction_files_asset_group_id ON auction_files(asset_group_id);
CREATE INDEX idx_auction_files_variant ON auction_files(variant);
CREATE INDEX idx_auction_files_published_status ON auction_files(published_status) WHERE detached_at IS NULL;
CREATE INDEX idx_auction_files_detached_at ON auction_files(detached_at) WHERE detached_at IS NOT NULL;

-- Enable RLS
ALTER TABLE auction_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can view published, non-detached media
CREATE POLICY "Public can view published media"
  ON auction_files FOR SELECT
  TO public
  USING (published_status = 'published' AND detached_at IS NULL);

-- Authenticated users can view all their media
CREATE POLICY "Authenticated can view all media"
  ON auction_files FOR SELECT
  TO authenticated
  USING (true);

-- Admins can insert media
CREATE POLICY "Admins can insert media"
  ON auction_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- Admins can update media
CREATE POLICY "Admins can update media"
  ON auction_files FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- Admins can delete media (soft delete via detached_at)
CREATE POLICY "Admins can delete media"
  ON auction_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- Create publish_jobs table
CREATE TABLE IF NOT EXISTS publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES auction_files(id) ON DELETE CASCADE,
  asset_group_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority int NOT NULL DEFAULT 5,
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 5,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for queue polling
CREATE INDEX idx_publish_jobs_queue
  ON publish_jobs(status, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_publish_jobs_file_id ON publish_jobs(file_id);
CREATE INDEX idx_publish_jobs_asset_group_id ON publish_jobs(asset_group_id);

-- Enable RLS
ALTER TABLE publish_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins can view and manage jobs
CREATE POLICY "Admins can view publish jobs"
  ON publish_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert publish jobs"
  ON publish_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- System can update jobs (for worker)
CREATE POLICY "System can update publish jobs"
  ON publish_jobs FOR UPDATE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_auction_files_updated_at
  BEFORE UPDATE ON auction_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_publish_jobs_updated_at
  BEFORE UPDATE ON publish_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to auto-generate publish jobs when source variant is inserted
CREATE OR REPLACE FUNCTION create_publish_job_on_source_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create job for 'source' variant
  IF NEW.variant = 'source' THEN
    INSERT INTO publish_jobs (file_id, asset_group_id, priority)
    VALUES (NEW.id, NEW.asset_group_id, 5);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating publish jobs
CREATE TRIGGER create_publish_job_on_file_insert
  AFTER INSERT ON auction_files
  FOR EACH ROW
  EXECUTE FUNCTION create_publish_job_on_source_insert();

-- Add comments for documentation
COMMENT ON TABLE auction_files IS 'Media files for auction items. Each original file has multiple variants (source, thumb, display, video). Source is from RAID, variants are published to B2+CDN.';
COMMENT ON COLUMN auction_files.asset_group_id IS 'Groups all variants (source, thumb, display, video) of the same original file';
COMMENT ON COLUMN auction_files.variant IS 'Variant type: source (RAID original), thumb (400px WebP), display (1600px WebP), video (rehosted MP4)';
COMMENT ON COLUMN auction_files.source_key IS 'RAID file key for source variant. Format: {userId}/{filename}';
COMMENT ON COLUMN auction_files.b2_key IS 'B2 object key for published variants. Format: assets/{asset_group_id}/{variant}.webp';
COMMENT ON COLUMN auction_files.cdn_url IS 'Cloudflare CDN URL. Format: https://cdn.ibaproject.bid/file/IBA-Lot-Media/{b2_key}';
COMMENT ON COLUMN auction_files.published_status IS 'Publishing status: pending (queued), processing (worker active), published (available on CDN), failed (error occurred)';
COMMENT ON COLUMN auction_files.detached_at IS 'Soft delete timestamp. Files kept for 30 days before purging from B2 and database';
COMMENT ON TABLE publish_jobs IS 'Queue for asynchronous media processing. Worker polls for pending jobs, downloads from RAID, processes variants, uploads to B2, updates auction_files.';
