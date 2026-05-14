/*
  # Add public SELECT policy for live_auction_sessions

  ## Problem
  The audience video projector page is opened in a browser without authentication.
  The live_auction_sessions table only had a SELECT policy for authenticated users,
  so unauthenticated visitors could never read the session and the page stayed on standby.

  ## Change
  - Add a public (anon role) SELECT policy so any visitor can read active live sessions
  - Restricts to non-ended sessions only to minimize exposure
*/

CREATE POLICY "Public can view active live sessions"
  ON live_auction_sessions
  FOR SELECT
  TO anon
  USING (status <> 'ended');
