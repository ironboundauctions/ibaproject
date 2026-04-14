/*
  # Make auction_files.item_id nullable again

  ## Problem
  Migration 20260408133154 made item_id NOT NULL, but this breaks two legitimate workflows:

  1. PC upload via worker: upsertVariant() inserts with item_id = NULL initially (from LEFT JOIN
     that finds no source row yet), then setVariantItemAndMetadata() updates it — this two-step
     pattern requires item_id to be nullable during the INSERT.

  2. Bulk IronDrive upload (handleBulkProcess): Files are created before inventory items exist.
     item_id is intentionally NULL and set later when the item is created.

  ## Changes
  - Remove the NOT NULL constraint from auction_files.item_id
  - Keep the ON DELETE CASCADE foreign key (that part was correct)

  ## Notes
  The NOT NULL constraint was the source of 500 errors when uploading any file (barcode images,
  PC images) to a new inventory item form. The fix in the frontend (uploading after item creation)
  addressed one symptom, but the worker itself had the same issue internally.
*/

ALTER TABLE auction_files
ALTER COLUMN item_id DROP NOT NULL;
