# Setup Instructions - Option A Integration

## Step 1: Run SQL Migration in Auction Website Database

Go to your auction website Supabase dashboard:
https://supabase.com/dashboard/project/sbhdjnchafboizbnqsmp/sql/new

Copy and paste the entire SQL from: `supabase/migrations/20250110_option_a_integration.sql`

Click "Run"

## Step 2: Get Your User ID

After running the migration, run this query to get your user ID:

```sql
SELECT id, email FROM auth.users;
```

Copy your user ID (it will be a UUID like `123e4567-e89b-12d3-a456-426614174000`)

## Step 3: Make Yourself Admin

Replace `YOUR_USER_ID_HERE` with your actual user ID and run:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'admin');
```

## Step 4: Verify It Worked

Run this to confirm:

```sql
SELECT * FROM public.user_roles;
```

You should see your user with role 'admin'.

## What This Does

- Creates `user_roles` table to track who is admin/subadmin/user
- Creates `file_uploads` table to track files uploaded to IronDrive
- Sets up Row Level Security policies
- Creates helper function `is_admin_or_subadmin()`

## Next Steps

After completing these steps, the auction website code will be updated to use these tables.
