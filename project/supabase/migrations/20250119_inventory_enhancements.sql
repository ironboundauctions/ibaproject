/*
  # Inventory Management Enhancements

  1. Schema Updates
    - Add `image_captions` JSONB field to `auction_files` for storing captions per image
    - Add `video_urls` text array field to `inventory_items` for video file URLs
    - Create `item_notes` table for internal comments and notes

  2. New Tables
    - `item_notes`
      - `id` (uuid, primary key) - Unique identifier
      - `item_id` (uuid) - Reference to inventory_items
      - `user_id` (uuid) - User who created the note
      - `note_text` (text) - The note content
      - `note_type` (text) - Category of note (general, condition, pickup, billing, etc.)
      - `is_internal` (boolean) - Whether note is internal-only
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  3. Security
    - Enable RLS on `item_notes` table
    - Add policies for authenticated users to manage notes
    - Ensure internal notes are only visible to authenticated users

  4. Indexes
    - Index on item_id for fast note lookups
    - Index on created_at for chronological sorting
*/

-- Add caption support to auction_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_files' AND column_name = 'caption'
  ) THEN
    ALTER TABLE auction_files ADD COLUMN caption text;
  END IF;
END $$;

-- Add video_urls to inventory_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'video_urls'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN video_urls text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Create item_notes table
CREATE TABLE IF NOT EXISTS item_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  note_type text DEFAULT 'general',
  is_internal boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_notes_item_id ON item_notes(item_id);
CREATE INDEX IF NOT EXISTS idx_item_notes_created_at ON item_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_notes_user_id ON item_notes(user_id);

ALTER TABLE item_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view notes" ON item_notes;
CREATE POLICY "Authenticated users can view notes"
  ON item_notes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create notes" ON item_notes;
CREATE POLICY "Authenticated users can create notes"
  ON item_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON item_notes;
CREATE POLICY "Users can update their own notes"
  ON item_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON item_notes;
CREATE POLICY "Users can delete their own notes"
  ON item_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_item_notes_updated_at ON item_notes;
CREATE TRIGGER update_item_notes_updated_at
  BEFORE UPDATE ON item_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
