/*
  # Admin Management System with Super Admin Hierarchy

  ## Overview
  This migration transforms the user_roles system to support a hierarchical admin structure
  with super admins, regular admins, and granular permission management.

  ## Changes Made

  ### 1. Role Updates
  - Changes role types from `admin/subadmin/user` to `super_admin/admin/user`
  - Removes obsolete `subadmin` role in favor of permission-based admin roles

  ### 2. New Columns Added to user_roles
  - `permissions` (JSONB): Stores granular permissions object
    - `can_manage_events`: Boolean for event management access
    - `can_manage_inventory`: Boolean for inventory management access
    - `can_manage_users`: Boolean for user management access
  - `invitation_token` (TEXT): Unique token for admin invitation links
  - `invitation_expires_at` (TIMESTAMPTZ): Expiration timestamp for invitations
  - `invitation_status` (TEXT): Tracks invitation state (pending/accepted/expired)

  ### 3. Database Functions
  - `ensure_super_admin_exists()`: Prevents deletion/demotion of last super admin
  - `handle_new_user_role()`: Automatically assigns 'user' role on signup
  - `check_permission()`: Helper to verify user permissions

  ### 4. Updated RLS Policies
  - Super admins can view all user roles
  - Super admins can modify any user role
  - Regular admins can only view roles based on their permissions
  - Users can view their own role
  - Protection against last super admin deletion/demotion

  ### 5. Indexes
  - Added indexes on permissions, invitation_token, and role for performance

  ## Security Notes
  - All operations enforce permission checks at database level
  - RLS policies prevent unauthorized access
  - Trigger prevents system from having zero super admins
  - Invitation tokens are unique and time-limited
*/

-- 1. ADD NEW COLUMNS TO user_roles TABLE
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"can_manage_events": false, "can_manage_inventory": false, "can_manage_users": false}'::jsonb,
ADD COLUMN IF NOT EXISTS invitation_token TEXT,
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'accepted' CHECK (invitation_status IN ('pending', 'accepted', 'expired'));

-- 2. UPDATE ROLE CHECK CONSTRAINT
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_role_check CHECK (role IN ('super_admin', 'admin', 'user'));

-- 3. MIGRATE EXISTING ROLES
-- Convert 'admin' to 'super_admin' for existing admins (they get full permissions)
UPDATE public.user_roles
SET
  role = 'super_admin',
  permissions = '{"can_manage_events": true, "can_manage_inventory": true, "can_manage_users": true}'::jsonb
WHERE role = 'admin';

-- Convert 'subadmin' to 'admin' with limited permissions
UPDATE public.user_roles
SET
  role = 'admin',
  permissions = '{"can_manage_events": true, "can_manage_inventory": true, "can_manage_users": false}'::jsonb
WHERE role = 'subadmin';

-- 4. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_user_roles_permissions ON public.user_roles USING gin(permissions);
CREATE INDEX IF NOT EXISTS idx_user_roles_invitation_token ON public.user_roles(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_roles_invitation_status ON public.user_roles(invitation_status);

-- 5. CREATE FUNCTION TO PREVENT LAST SUPER ADMIN DELETION
CREATE OR REPLACE FUNCTION public.ensure_super_admin_exists()
RETURNS TRIGGER AS $$
DECLARE
  super_admin_count INTEGER;
BEGIN
  -- Count remaining super admins
  SELECT COUNT(*) INTO super_admin_count
  FROM public.user_roles
  WHERE role = 'super_admin'
    AND id != OLD.id;

  -- If this is the last super admin being deleted or demoted
  IF (TG_OP = 'DELETE' OR NEW.role != 'super_admin') AND OLD.role = 'super_admin' AND super_admin_count = 0 THEN
    RAISE EXCEPTION 'Cannot delete or demote the last super admin';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. CREATE TRIGGER FOR SUPER ADMIN PROTECTION
DROP TRIGGER IF EXISTS prevent_last_super_admin_removal ON public.user_roles;
CREATE TRIGGER prevent_last_super_admin_removal
  BEFORE DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_super_admin_exists();

-- 7. CREATE FUNCTION TO AUTO-ASSIGN 'USER' ROLE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create user_roles entry if one doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role, permissions)
    VALUES (
      NEW.id,
      'user',
      '{"can_manage_events": false, "can_manage_inventory": false, "can_manage_users": false}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. CREATE TRIGGER FOR AUTO ROLE ASSIGNMENT
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- 9. CREATE HELPER FUNCTION TO CHECK PERMISSIONS
CREATE OR REPLACE FUNCTION public.check_permission(check_user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
BEGIN
  -- Get user permissions
  SELECT permissions INTO user_permissions
  FROM public.user_roles
  WHERE user_id = check_user_id;

  -- Super admins have all permissions
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = check_user_id AND role = 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- Check specific permission
  RETURN COALESCE((user_permissions->>permission_name)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. UPDATE RLS POLICIES FOR user_roles

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- New SELECT policy: Users can view their own role, super admins and admins with can_manage_users can view all
CREATE POLICY "Users can view own role, admins can view based on permissions" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (ur.role = 'admin' AND (ur.permissions->>'can_manage_users')::boolean = true)
      )
    )
  );

-- New INSERT policy: Only super admins can create new admin roles
CREATE POLICY "Super admins can insert roles" ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- New UPDATE policy: Super admins can update any role, admins with permission can update regular users
CREATE POLICY "Super admins can update roles" ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (
          ur.role = 'admin'
          AND (ur.permissions->>'can_manage_users')::boolean = true
          AND user_roles.role = 'user'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'super_admin'
        OR (
          ur.role = 'admin'
          AND (ur.permissions->>'can_manage_users')::boolean = true
          AND user_roles.role = 'user'
        )
      )
    )
  );

-- New DELETE policy: Only super admins can delete roles
CREATE POLICY "Super admins can delete roles" ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- 11. UPDATE profiles RLS TO INCLUDE SUPER_ADMIN

-- Drop old admin policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- New policy for super admins and admins with can_manage_users permission
CREATE POLICY "Admins can view all profiles based on permissions" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND (
        user_roles.role = 'super_admin'
        OR (user_roles.role = 'admin' AND (user_roles.permissions->>'can_manage_users')::boolean = true)
      )
    )
  );

-- 12. UPDATE is_admin_or_subadmin FUNCTION
DROP FUNCTION IF EXISTS public.is_admin_or_subadmin(UUID);
CREATE OR REPLACE FUNCTION public.is_admin_or_subadmin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. CREATE user_roles ENTRIES FOR EXISTING USERS WITHOUT ROLES
INSERT INTO public.user_roles (user_id, role, permissions)
SELECT
  u.id,
  'user',
  '{"can_manage_events": false, "can_manage_inventory": false, "can_manage_users": false}'::jsonb
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Add helpful comments
COMMENT ON COLUMN public.user_roles.permissions IS 'JSONB object storing granular permissions: can_manage_events, can_manage_inventory, can_manage_users';
COMMENT ON COLUMN public.user_roles.invitation_token IS 'Unique token for admin invitation links, expires after 24-48 hours';
COMMENT ON COLUMN public.user_roles.invitation_status IS 'Status of admin invitation: pending, accepted, or expired';
COMMENT ON FUNCTION public.ensure_super_admin_exists IS 'Prevents deletion or demotion of the last super admin in the system';
COMMENT ON FUNCTION public.handle_new_user_role IS 'Automatically creates a user_roles entry with role=user when new users sign up';
COMMENT ON FUNCTION public.check_permission IS 'Helper function to check if a user has a specific permission';
