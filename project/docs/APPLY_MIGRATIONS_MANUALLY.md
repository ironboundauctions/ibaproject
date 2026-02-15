# Manual Database Migration Instructions

Your database tables haven't been created yet. You need to manually apply these migrations in your Supabase dashboard.

## Steps:

1. Go to https://sbhdjnchafboizbnqsmp.supabase.co
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the SQL from BOTH files below (in order)
5. Click "Run" to execute

## File 1: Create Base Tables
**File:** `supabase/migrations/20250110_global_inventory_system.sql`

This creates:
- `consigners` table (with full_name, customer_number, etc.)
- `auction_events` table
- `inventory_items` table (base structure)
- `event_inventory_assignments` table
- All RLS policies

## File 2: Add Event Fields
**File:** `supabase/migrations/20250121_add_event_fields_to_inventory.sql`

This adds:
- `event_id` field to inventory_items
- `lot_number` field to inventory_items
- `sale_order` field to inventory_items

## After Running Migrations:

Refresh your application and you should be able to:
- Create consigners (with A0001, B0002 format customer numbers)
- Create inventory items
- See all your data properly

## Images Already Uploaded:

The images you uploaded (inventory 425014) are stored in the RAID system at:
`https://raid.ibaproject.bid/download/...`

Once the tables are created, you'll be able to create the inventory item and link those images to it.
