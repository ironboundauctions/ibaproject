CREATE TABLE IF NOT EXISTS consigner_id_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consigner_id uuid NOT NULL REFERENCES consigners(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT '',
  file_size integer DEFAULT 0,
  document_label text DEFAULT '',
  is_image boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE consigner_id_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view consigner documents"
  ON consigner_id_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert consigner documents"
  ON consigner_id_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete consigner documents"
  ON consigner_id_documents FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update consigner documents"
  ON consigner_id_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
