/*
  # Add event_number to auction_events

  ## Summary
  Adds a unique 6-digit numeric event number to each auction event.

  ## Changes
  - New column `event_number` (text, unique) on `auction_events`
  - Backfills existing rows with random 6-digit numbers
  - Adds a unique constraint to prevent duplicates
*/

ALTER TABLE public.auction_events
  ADD COLUMN IF NOT EXISTS event_number TEXT;

DO $$
DECLARE
  rec RECORD;
  new_num TEXT;
  attempts INT;
BEGIN
  FOR rec IN SELECT id FROM public.auction_events WHERE event_number IS NULL LOOP
    attempts := 0;
    LOOP
      new_num := LPAD(FLOOR(RANDOM() * 900000 + 100000)::INT::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.auction_events WHERE event_number = new_num);
      attempts := attempts + 1;
      EXIT WHEN attempts > 100;
    END LOOP;
    UPDATE public.auction_events SET event_number = new_num WHERE id = rec.id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'auction_events' AND constraint_name = 'auction_events_event_number_key'
  ) THEN
    ALTER TABLE public.auction_events ADD CONSTRAINT auction_events_event_number_key UNIQUE (event_number);
  END IF;
END $$;
