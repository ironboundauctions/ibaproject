/*
  # Fix consigners DELETE policy to include admin role

  The existing DELETE policy only allowed super_admin to delete consignors,
  but INSERT and UPDATE already allow both admin and super_admin. This fix
  aligns the DELETE policy to match, allowing both roles to delete consignors.
*/

DROP POLICY IF EXISTS "Admins can delete consigners" ON consigners;

CREATE POLICY "Admins can delete consigners"
  ON consigners
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['super_admin', 'admin'])
    )
  );
