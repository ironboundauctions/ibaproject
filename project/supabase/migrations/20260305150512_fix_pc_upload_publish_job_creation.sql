/*
  # Fix PC Upload Publish Job Creation

  ## Problem
  When PC uploads create source files, a publish_job is created by the trigger.
  The worker then tries to process these jobs, but PC uploads don't have a source_key
  (they're already published to CDN), so the worker fails and sets published_status
  back to 'pending'.

  ## Solution
  Modify the trigger to only create publish jobs for RAID uploads (which have a source_key).
  PC uploads are already fully processed and published - they don't need a job.

  ## Changes
  1. Update `create_publish_job_on_source_insert()` to check for source_key
  2. Only create job if source_key is not null (RAID upload)
  3. Skip job creation if source_key is null (PC upload - already published)
*/

CREATE OR REPLACE FUNCTION create_publish_job_on_source_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create job for 'source' variant AND only if it has a source_key (RAID upload)
  -- PC uploads don't have source_key and are already published to CDN
  IF NEW.variant = 'source' AND NEW.source_key IS NOT NULL THEN
    INSERT INTO publish_jobs (file_id, asset_group_id, priority)
    VALUES (NEW.id, NEW.asset_group_id, 5);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_publish_job_on_source_insert IS 'Creates publish job only for RAID uploads (source_key not null). PC uploads are already published.';
