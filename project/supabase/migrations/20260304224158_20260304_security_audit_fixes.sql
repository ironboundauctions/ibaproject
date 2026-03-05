/*
  # Security Audit Fixes - March 4, 2026

  Addresses Supabase Security Audit vulnerabilities:
  1. Adds SET search_path = public to prevent search_path hijacking
  2. Removes overly permissive RLS policies
*/

-- Add search_path to all functions using ALTER FUNCTION
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.create_publish_job_on_source_insert() SET search_path = public;
ALTER FUNCTION public.create_publish_job_for_new_file() SET search_path = public;
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.update_auction_bid() SET search_path = public;
ALTER FUNCTION public.validate_bid() SET search_path = public;
ALTER FUNCTION public.promote_to_admin(uuid) SET search_path = public;
ALTER FUNCTION public.cleanup_deleted_media_files() SET search_path = public;
ALTER FUNCTION public.ensure_super_admin_exists() SET search_path = public;
ALTER FUNCTION public.handle_new_user_role() SET search_path = public;
ALTER FUNCTION public.check_permission(uuid, text) SET search_path = public;
ALTER FUNCTION public.get_user_role(uuid) SET search_path = public;
ALTER FUNCTION public.is_admin_or_subadmin(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Fix assign_user_role if it exists (might have different signature)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'assign_user_role' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'ALTER FUNCTION public.assign_user_role SET search_path = public';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_updated_at' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at() SET search_path = public';
  END IF;
END $$;

-- Drop overly permissive policies that bypass RLS
DROP POLICY IF EXISTS "p_cons_ins" ON public.consigners;
DROP POLICY IF EXISTS "p_cons_upd" ON public.consigners;
DROP POLICY IF EXISTS "p_cons_del" ON public.consigners;
DROP POLICY IF EXISTS "p_items_ins" ON public.inventory_items;
DROP POLICY IF EXISTS "p_items_upd" ON public.inventory_items;
DROP POLICY IF EXISTS "p_items_del" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_write_auth" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update_auth" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete_auth" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable insert for authentication" ON public.profiles;
DROP POLICY IF EXISTS "System can update publish jobs" ON public.publish_jobs;