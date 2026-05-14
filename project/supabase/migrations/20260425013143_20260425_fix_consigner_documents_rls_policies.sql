/*
  # Fix consigner_id_documents RLS Policies

  ## Summary
  Replaces open DELETE and UPDATE policies on consigner_id_documents with
  policies restricted to admin/super_admin only. These are sensitive identity
  documents (driver's licenses, passports) and should only be managed by admins.

  ## Changes
  - DROP: open DELETE policy (any authenticated user could delete any document)
  - DROP: open UPDATE policy (any authenticated user could relabel any document)
  - ADD: DELETE restricted to admin/super_admin
  - ADD: UPDATE restricted to admin/super_admin

  ## Notes
  - INSERT policy already correctly checks auth.uid() = uploaded_by, left unchanged
  - SELECT policy left open to authenticated (admins need to view docs; only admins
    have access to the consigner management UI anyway)
*/

DROP POLICY IF EXISTS "Authenticated users can delete consigner documents" ON consigner_id_documents;
DROP POLICY IF EXISTS "Authenticated users can update consigner documents" ON consigner_id_documents;

CREATE POLICY "Admins can delete consigner documents"
  ON consigner_id_documents FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Admins can update consigner documents"
  ON consigner_id_documents FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'super_admin'));
