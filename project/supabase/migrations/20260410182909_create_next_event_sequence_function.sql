/*
  # Create next_event_sequence RPC function

  ## Summary
  A PostgreSQL function that atomically increments and returns the next
  sequence number for a given year. Used to generate YYYYNN event numbers.

  ## Details
  - Inserts year row if not present, or increments last_seq
  - Returns the new sequence integer (caller prepends the year)
  - Used by the frontend eventService
*/

CREATE OR REPLACE FUNCTION public.next_event_sequence(p_year INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INT;
BEGIN
  INSERT INTO public.event_number_sequences (year, last_seq)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_seq = event_number_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_event_sequence(INT) TO authenticated;
