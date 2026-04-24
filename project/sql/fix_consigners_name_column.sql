-- Fix consigners table by removing the old 'name' column
-- The application uses 'full_name' instead

ALTER TABLE public.consigners DROP COLUMN IF EXISTS name;
