/*
  # Batch Analysis Jobs Table

  1. New Tables
    - `batch_analysis_jobs`
      - `id` (uuid, primary key) - Unique job identifier
      - `user_id` (uuid, foreign key) - User who initiated the analysis
      - `status` (text) - Job status: pending, analyzing, completed, failed
      - `total_files` (integer) - Total number of files in batch
      - `processed_files` (integer) - Number of files analyzed so far
      - `results` (jsonb) - Array of analysis results with metadata
      - `error_message` (text, nullable) - Error details if failed
      - `created_at` (timestamptz) - Job creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `completed_at` (timestamptz, nullable) - Completion timestamp

  2. Security
    - Enable RLS on `batch_analysis_jobs` table
    - Add policy for users to read their own jobs
    - Add policy for users to create their own jobs
    - Add policy for service role to update any job (for worker)

  3. Indexes
    - Index on user_id for fast user queries
    - Index on status for worker polling
    - Index on created_at for cleanup and sorting
*/

-- Create batch_analysis_jobs table
CREATE TABLE IF NOT EXISTS batch_analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
  total_files integer NOT NULL DEFAULT 0 CHECK (total_files >= 0),
  processed_files integer NOT NULL DEFAULT 0 CHECK (processed_files >= 0),
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_batch_analysis_jobs_user_id ON batch_analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_analysis_jobs_status ON batch_analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_analysis_jobs_created_at ON batch_analysis_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE batch_analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own jobs
CREATE POLICY "Users can read own batch analysis jobs"
  ON batch_analysis_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create their own jobs
CREATE POLICY "Users can create own batch analysis jobs"
  ON batch_analysis_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own jobs (for client-side status checks)
CREATE POLICY "Users can update own batch analysis jobs"
  ON batch_analysis_jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can update any job (for worker updates)
CREATE POLICY "Service role can update any batch analysis job"
  ON batch_analysis_jobs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_batch_analysis_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batch_analysis_jobs_updated_at
  BEFORE UPDATE ON batch_analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_analysis_jobs_updated_at();
