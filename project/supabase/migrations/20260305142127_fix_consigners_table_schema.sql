/*
  # Fix Consigners Table Schema
  
  1. Changes
    - Add missing columns: customer_number, full_name, nickname, company, city, state, zip, tax_id, payment_terms, notes
    - Make address NOT NULL with default empty string
    - Make phone nullable (was causing issues)
    - Remove or keep old 'name' column for backward compatibility
    - Add unique constraint on customer_number
    
  2. Notes
    - This migration fixes the schema mismatch between the database and application code
    - Existing data in 'name' column will be preserved and can be migrated to 'full_name' if needed
*/

-- Add customer_number column if it doesn't exist (with temporary nullable until we populate it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'customer_number'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN customer_number TEXT;
  END IF;
END $$;

-- Add full_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN full_name TEXT NOT NULL DEFAULT 'Unknown';
  END IF;
END $$;

-- Migrate existing 'name' data to 'full_name' if 'name' column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'name'
  ) THEN
    UPDATE public.consigners SET full_name = name WHERE full_name = 'Unknown' OR full_name IS NULL;
  END IF;
END $$;

-- Add other missing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'nickname'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN nickname TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'company'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN company TEXT;
  END IF;
END $$;

-- Ensure address exists and has proper default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'address'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN address TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN city TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'state'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN state TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'zip'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN zip TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN tax_id TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'payment_terms'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN payment_terms TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'consigners' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.consigners ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Generate customer numbers for existing records that don't have one
DO $$
DECLARE
  rec RECORD;
  letter_idx INT := 0;
  number_idx INT := 1;
  new_customer_number TEXT;
BEGIN
  FOR rec IN SELECT id FROM public.consigners WHERE customer_number IS NULL ORDER BY created_at
  LOOP
    new_customer_number := CHR(65 + letter_idx) || LPAD(number_idx::TEXT, 4, '0');
    UPDATE public.consigners SET customer_number = new_customer_number WHERE id = rec.id;
    
    number_idx := number_idx + 1;
    IF number_idx > 9999 THEN
      number_idx := 1;
      letter_idx := letter_idx + 1;
    END IF;
  END LOOP;
END $$;

-- Now make customer_number NOT NULL and UNIQUE
ALTER TABLE public.consigners ALTER COLUMN customer_number SET NOT NULL;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'consigners_customer_number_key'
  ) THEN
    ALTER TABLE public.consigners ADD CONSTRAINT consigners_customer_number_key UNIQUE (customer_number);
  END IF;
END $$;

-- Make phone nullable (it's required in the app but we want flexibility in the DB)
ALTER TABLE public.consigners ALTER COLUMN phone DROP NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_consigners_customer_number ON public.consigners(customer_number);
CREATE INDEX IF NOT EXISTS idx_consigners_full_name ON public.consigners(full_name);
CREATE INDEX IF NOT EXISTS idx_consigners_email ON public.consigners(email);
