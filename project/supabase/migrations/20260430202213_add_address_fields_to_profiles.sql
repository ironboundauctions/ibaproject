/*
  # Add address fields to profiles table

  Adds physical address fields to support bidder registration.

  1. Modified Tables
    - `profiles`
      - `phone` (text) - already exists, no change
      - `address_line1` (text) - street address
      - `address_line2` (text) - suite/apt (optional)
      - `city` (text)
      - `state` (text) - state/province
      - `zip` (text) - postal code
      - `country` (text) - defaults to 'US'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'address_line1'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN address_line1 text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'address_line2'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN address_line2 text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN city text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'state'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN state text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'zip'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN zip text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN country text DEFAULT 'US';
  END IF;
END $$;
