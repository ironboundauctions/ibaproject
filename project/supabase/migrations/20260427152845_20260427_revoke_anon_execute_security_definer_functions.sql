-- Revoke anon + authenticated EXECUTE from trigger-only functions (never called directly via REST)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_publish_job_on_source_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_batch_analysis_jobs_updated_at() FROM anon, authenticated;

-- Revoke anon EXECUTE from all remaining flagged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.assign_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_permission(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_deleted_media_files() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_subadmin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_event_sequence(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_to_admin(uuid) FROM anon;

-- update_display_order has two overloads: revoke anon from both, keep authenticated
REVOKE EXECUTE ON FUNCTION public.update_display_order(uuid, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_display_order(uuid, uuid, integer) FROM anon;
