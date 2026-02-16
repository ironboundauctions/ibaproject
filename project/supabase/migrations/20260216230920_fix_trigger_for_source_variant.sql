/*
  # Fix Trigger to Accept Source Variant
  
  ## Problem
  The auto_create_publish_job trigger only accepts variant='original',
  but IronDrive files use variant='source'.
  
  ## Solution
  Update trigger to accept both 'original' and 'source' variants.
*/

-- Update function to accept source variant
CREATE OR REPLACE FUNCTION create_publish_job_for_new_file()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create job if published_status is 'pending' or NULL
  -- and if this is a source/original file (not display/thumb variants)
  IF (NEW.published_status IS NULL OR NEW.published_status = 'pending') 
     AND (NEW.variant IS NULL OR NEW.variant IN ('original', 'source')) THEN
    
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
    ON CONFLICT DO NOTHING;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
