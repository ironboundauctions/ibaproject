/*
  # Fix Function Search Path Security Issues

  1. Changes
    - Set explicit search_path for `update_display_order` function
    - Set explicit search_path for `update_batch_analysis_jobs_updated_at` function
    - Set explicit search_path for `create_publish_job_on_source_insert` function
  
  2. Security
    - Prevents search_path manipulation attacks by fixing the schema resolution
    - All functions will explicitly use the public schema
*/

-- Fix update_display_order function
CREATE OR REPLACE FUNCTION public.update_display_order(
  p_file_id uuid,
  p_old_order integer,
  p_new_order integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_old_order < p_new_order THEN
    UPDATE auction_files
    SET display_order = display_order - 1
    WHERE inventory_item_id = (SELECT inventory_item_id FROM auction_files WHERE id = p_file_id)
      AND display_order > p_old_order
      AND display_order <= p_new_order
      AND id != p_file_id;
  ELSIF p_old_order > p_new_order THEN
    UPDATE auction_files
    SET display_order = display_order + 1
    WHERE inventory_item_id = (SELECT inventory_item_id FROM auction_files WHERE id = p_file_id)
      AND display_order >= p_new_order
      AND display_order < p_old_order
      AND id != p_file_id;
  END IF;

  UPDATE auction_files
  SET display_order = p_new_order
  WHERE id = p_file_id;
END;
$$;

-- Fix update_batch_analysis_jobs_updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_batch_analysis_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix create_publish_job_on_source_insert trigger function
CREATE OR REPLACE FUNCTION public.create_publish_job_on_source_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create job for 'source' variant AND only if it has a source_key (RAID upload)
  -- PC uploads don't have source_key and are already published to CDN
  IF NEW.variant = 'source' AND NEW.source_key IS NOT NULL THEN
    INSERT INTO publish_jobs (
      file_id,
      asset_group_id,
      status,
      priority,
      run_after
    ) VALUES (
      NEW.id,
      NEW.asset_group_id,
      'pending',
      CASE
        WHEN NEW.mime_type LIKE 'video/%' THEN 10
        ELSE 5
      END,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;