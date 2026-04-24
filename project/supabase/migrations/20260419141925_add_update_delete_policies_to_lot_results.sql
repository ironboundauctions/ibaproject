/*
  # Add missing RLS policies for live_auction_lot_results

  1. Problem
    - The upsert in recordLotResult fails silently because there is no UPDATE policy
    - clearLotResult (DELETE) also fails with no DELETE policy
    - Only INSERT and SELECT policies existed

  2. Changes
    - Add UPDATE policy for authenticated users
    - Add DELETE policy for authenticated users
*/

CREATE POLICY "Authenticated users can update lot results"
  ON live_auction_lot_results
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lot results"
  ON live_auction_lot_results
  FOR DELETE
  TO authenticated
  USING (true);
