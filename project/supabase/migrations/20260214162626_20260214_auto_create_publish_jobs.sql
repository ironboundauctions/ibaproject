/*
  # Auto-Create Publish Jobs for Uploaded Files

  ## Problem
  When files are uploaded to `auction_files`, no jobs are created in `publish_jobs`,
  so the worker has nothing to process.

  ## Solution
  Create a database trigger that automatically creates a job in `publish_jobs`
  whenever a new file is inserted into `auction_files`.

  ## Changes
  1. Create trigger function `create_publish_job_for_new_file()`
  2. Create trigger on `auction_files` AFTER INSERT
  3. Job is created with:
     - status: 'pending'
     - priority: 5 (default)
     - retry_count: 0
     - max_retries: 5
     - run_after: NOW() (process immediately)
*/

-- Create function to auto-create publish job
CREATE OR REPLACE FUNCTION create_publish_job_for_new_file()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create job if publish_status is 'pending' or NULL
  -- and if this is an original file (not a variant)
  IF (NEW.publish_status IS NULL OR NEW.publish_status = 'pending') 
     AND (NEW.variant IS NULL OR NEW.variant = 'original') THEN
    
    INSERT INTO publish_jobs (
      file_id,
      asset_group_id,
      source_item_id,
      status,
      priority,
      retry_count,
      max_retries,
      run_after
    ) VALUES (
      NEW.id,
      NEW.asset_group_id,
      NEW.item_id,
      'pending',
      5,
      0,
      5,
      NOW()
    )
    ON CONFLICT DO NOTHING;  -- Prevent duplicate jobs
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auction_files
DROP TRIGGER IF EXISTS auto_create_publish_job ON auction_files;
CREATE TRIGGER auto_create_publish_job
  AFTER INSERT ON auction_files
  FOR EACH ROW
  EXECUTE FUNCTION create_publish_job_for_new_file();

-- Add unique constraint to prevent duplicate jobs
CREATE UNIQUE INDEX IF NOT EXISTS idx_publish_jobs_unique_file
  ON publish_jobs(file_id)
  WHERE status IN ('pending', 'processing');

COMMENT ON FUNCTION create_publish_job_for_new_file() IS 'Automatically creates a publish job when a new file is uploaded to auction_files';
