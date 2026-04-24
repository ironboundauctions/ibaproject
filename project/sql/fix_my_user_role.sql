-- This script will make your current user a super admin
-- Run this in the Supabase SQL Editor

-- Step 1: Check what users exist
SELECT
  ur.id,
  ur.user_id,
  ur.role,
  ur.permissions,
  p.email,
  p.full_name
FROM user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
ORDER BY ur.created_at;

-- Step 2: If you see your user in the results above,
-- copy your email and replace 'YOUR_EMAIL_HERE' below, then run:

-- UPDATE user_roles
-- SET
--   role = 'super_admin',
--   permissions = '{"can_manage_events": true, "can_manage_inventory": true, "can_manage_users": true}'::jsonb
-- WHERE user_id IN (
--   SELECT id FROM profiles WHERE email = 'YOUR_EMAIL_HERE'
-- );

-- Step 3: If you DON'T see any user_roles entry for your user,
-- you need to create one. Replace 'YOUR_EMAIL_HERE' and run:

-- INSERT INTO user_roles (user_id, role, permissions)
-- SELECT
--   id,
--   'super_admin',
--   '{"can_manage_events": true, "can_manage_inventory": true, "can_manage_users": true}'::jsonb
-- FROM profiles
-- WHERE email = 'YOUR_EMAIL_HERE'
-- ON CONFLICT (user_id) DO UPDATE
-- SET
--   role = 'super_admin',
--   permissions = '{"can_manage_events": true, "can_manage_inventory": true, "can_manage_users": true}'::jsonb;
