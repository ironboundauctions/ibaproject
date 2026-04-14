/*
  # Reformat event_number to YYYYNN format

  ## Summary
  Changes the event numbering scheme from a random 6-digit number to a
  year-prefixed sequential number (e.g. 202601, 202602).

  ## Changes
  - Existing events are renumbered starting from YYYY01 based on their created_at year
  - Adds a sequence table `event_number_sequences` to track the next counter per year
  - Drops the old unique constraint and re-adds it
*/

DROP TABLE IF EXISTS public.event_number_sequences;

CREATE TABLE public.event_number_sequences (
  year INT PRIMARY KEY,
  last_seq INT NOT NULL DEFAULT 0
);

ALTER TABLE public.event_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage event number sequences"
  ON public.event_number_sequences
  FOR SELECT
  TO authenticated
  USING (true);

DO $$
DECLARE
  rec RECORD;
  yr INT;
  seq INT;
  new_num TEXT;
BEGIN
  ALTER TABLE public.auction_events DROP CONSTRAINT IF EXISTS auction_events_event_number_key;

  FOR rec IN
    SELECT id, created_at FROM public.auction_events ORDER BY created_at ASC
  LOOP
    yr := EXTRACT(YEAR FROM rec.created_at)::INT;

    INSERT INTO public.event_number_sequences (year, last_seq)
    VALUES (yr, 1)
    ON CONFLICT (year) DO UPDATE SET last_seq = event_number_sequences.last_seq + 1
    RETURNING last_seq INTO seq;

    new_num := yr::TEXT || LPAD(seq::TEXT, 2, '0');
    UPDATE public.auction_events SET event_number = new_num WHERE id = rec.id;
  END LOOP;

  ALTER TABLE public.auction_events ADD CONSTRAINT auction_events_event_number_key UNIQUE (event_number);
END $$;
