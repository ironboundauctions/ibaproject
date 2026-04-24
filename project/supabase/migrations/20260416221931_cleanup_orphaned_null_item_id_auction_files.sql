/*
  # Clean up orphaned auction_files with no item_id

  ## Problem
  The PC upload workflow creates auction_files records before an inventory item exists.
  If the user never completes the item creation, these records are left orphaned:
  - item_id IS NULL (never linked to any item)
  - detached_at IS NULL (never marked as removed)
  - They are invisible in all UI views and accumulate indefinitely

  ## Changes
  - Deletes all auction_files records where item_id IS NULL and detached_at IS NULL
    and the record is older than 1 hour (to avoid deleting in-progress uploads)

  ## Notes
  - Records created within the last hour are spared to avoid interrupting active uploads
  - CASCADE delete is not involved here since there is no parent item
  - Future orphans will be surfaced in the UI via a separate fix
*/

DELETE FROM auction_files
WHERE item_id IS NULL
  AND detached_at IS NULL
  AND created_at < now() - interval '1 hour';
