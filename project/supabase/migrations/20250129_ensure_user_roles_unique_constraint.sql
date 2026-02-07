/*
  # Ensure user_roles has UNIQUE constraint on user_id

  This migration ensures the user_roles table has a proper unique constraint
  on the user_id column, which is required for upsert operations.
*/

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_key'
    AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END $$;
