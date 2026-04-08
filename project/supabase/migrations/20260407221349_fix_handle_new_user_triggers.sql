/*
  # Fix handle_new_user triggers

  ## Problem
  The `handle_new_user()` and `handle_new_user_role()` triggers are failing when creating users via edge functions,
  causing auth.admin.createUser() to fail with "Database error creating new user".

  ## Changes
  1. Update `handle_new_user()` to match the actual profiles table schema
  2. Add exception handling to `handle_new_user_role()` to prevent auth failures
  3. Ensure both functions have proper error handling and don't crash user creation

  ## Details
  - Both functions use SECURITY DEFINER so they run with elevated permissions
  - Added exception handling to log errors without failing the auth process
  - Updated column list to match actual profiles table structure
*/

-- Update handle_new_user to match actual schema and add error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles table with error handling
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    avatar_url,
    email,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2'),
    NEW.email,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update handle_new_user_role to add error handling
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
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth process
    RAISE WARNING 'Error creating user_role for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
