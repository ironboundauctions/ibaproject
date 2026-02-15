/*
  # Remove Worker Infrastructure

  ## Changes
  Removes all tables and triggers related to the media publishing worker system:
  1. Drop publish_jobs table
  2. Drop media_cleanup_log table  
  3. Drop any triggers that create publish jobs

  ## Result
  Clean database with no worker-related infrastructure.
  Files are uploaded directly to B2 via Supabase Storage.
*/

-- Drop triggers first
DROP TRIGGER IF EXISTS create_publish_job_on_file_insert ON auction_files;
DROP FUNCTION IF EXISTS create_publish_job CASCADE;

-- Drop tables
DROP TABLE IF EXISTS publish_jobs CASCADE;
DROP TABLE IF EXISTS media_cleanup_log CASCADE;
