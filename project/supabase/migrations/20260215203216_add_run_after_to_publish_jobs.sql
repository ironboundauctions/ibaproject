/*
  # Add run_after column to publish_jobs
  
  ## Changes
  - Add `run_after` column to `publish_jobs` table for scheduling retries with exponential backoff
  
  ## Details
  The worker uses `run_after` to schedule when a job should be retried after failure.
  This enables exponential backoff retry logic.
*/

-- Add run_after column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publish_jobs' AND column_name = 'run_after'
  ) THEN
    ALTER TABLE publish_jobs ADD COLUMN run_after timestamptz DEFAULT now();
    
    -- Update existing rows to have a valid run_after value
    UPDATE publish_jobs SET run_after = created_at WHERE run_after IS NULL;
    
    -- Make it NOT NULL after populating
    ALTER TABLE publish_jobs ALTER COLUMN run_after SET NOT NULL;
  END IF;
END $$;