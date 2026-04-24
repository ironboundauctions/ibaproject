/*
  # Fix RLS Infinite Recursion on user_roles

  1. Problem
    - All tables query user_roles in their RLS policies
    - user_roles itself may have recursive policies causing infinite loop
    - Error: "infinite recursion detected in policy for relation user_roles"

  2. Solution
    - Drop all existing policies on user_roles
    - Create simple, non-recursive policies
    - Users can only see their own role
    - Only service role can manage roles

  3. Security
    - Policies are restrictive and don't create circular dependencies
    - Auth checks use auth.uid() directly without subqueries
*/

-- Drop all existing policies on user_roles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own role
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role full access" ON public.user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.user_roles IS 'User roles - uses simple non-recursive RLS policies to avoid infinite recursion';
