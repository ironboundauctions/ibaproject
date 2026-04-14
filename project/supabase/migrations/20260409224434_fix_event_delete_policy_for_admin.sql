/*
  # Fix auction_events DELETE policy

  ## Change
  - The existing "Admins can delete events" policy only allowed super_admin role.
  - Updated to allow both super_admin and admin roles to delete events,
    matching the same permission set used for INSERT and UPDATE.

  ## Security
  - Still restricted to authenticated users with admin-level roles.
  - Regular (non-admin) users cannot delete events.
*/

DROP POLICY IF EXISTS "Admins can delete events" ON auction_events;

CREATE POLICY "Admins can delete events"
  ON auction_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = ANY (ARRAY['super_admin', 'admin'])
    )
  );
