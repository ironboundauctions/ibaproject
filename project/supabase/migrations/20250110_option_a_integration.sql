/*
  # IronDrive Integration - Option A (Clean Separation)

  Creates tables in the auction website database for:
  1. User roles (admin/subadmin/user)
  2. File upload tracking (links to files stored in IronDrive)

  ## Tables Created

  ### user_roles
  - Stores role assignments for users
  - Roles: admin, subadmin, user
  - One role per user (UNIQUE constraint)
  - Cascades delete when user is deleted

  ### file_uploads
  - Tracks files uploaded to IronDrive
  - Stores file URLs, metadata, and inventory associations
  - Links to user who uploaded

  ## Security

  - RLS enabled on both tables
  - Users can view their own role
  - Only admins can manage roles
  - Everyone can view files (public auction images)
  - Only admins/subadmins can upload/delete files
*/

-- 1. CREATE USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'subadmin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own role
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Admins can insert roles
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policy: Admins can update roles
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policy: Admins can delete roles
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 2. CREATE FILE UPLOADS TABLE
CREATE TABLE IF NOT EXISTS public.file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  inventory_number TEXT,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT valid_file_type CHECK (file_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'))
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_file_uploads_inventory_number ON public.file_uploads(inventory_number);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_by ON public.file_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_at ON public.file_uploads(uploaded_at DESC);

-- Enable RLS
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read (public images)
CREATE POLICY "Anyone can view files" ON public.file_uploads
  FOR SELECT
  USING (true);

-- RLS Policy: Only admins and subadmins can upload
CREATE POLICY "Admins and subadmins can upload" ON public.file_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- RLS Policy: Only admins and subadmins can delete
CREATE POLICY "Admins and subadmins can delete" ON public.file_uploads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'subadmin')
    )
  );

-- 3. CREATE HELPER FUNCTION to check if user is admin/subadmin
CREATE OR REPLACE FUNCTION public.is_admin_or_subadmin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role IN ('admin', 'subadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.user_roles IS 'Stores user role assignments for permission control';
COMMENT ON TABLE public.file_uploads IS 'Tracks all files uploaded to IronDrive via the auction website';
COMMENT ON FUNCTION public.is_admin_or_subadmin IS 'Helper function to check if user has admin or subadmin role';
