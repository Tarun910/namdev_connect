-- Run in Supabase → SQL Editor for the SAME project as backend SUPABASE_URL.
-- Fixes: "Could not find the 'clerk_user_id' column of 'profiles' in the schema cache"

-- 1) See if Postgres has the column (if this returns 0 rows, the column was never added)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'clerk_user_id';

-- 2) Add column if missing (safe to re-run)
alter table public.profiles add column if not exists clerk_user_id text unique;

-- 3) If profiles.id still references auth.users, the API cannot insert Clerk users — run the FULL file:
--    supabase/migrations/002_clerk_auth.sql

-- 4) Force PostgREST to reload its schema cache (run this even if step 1 already showed the column)
notify pgrst, 'reload schema';

-- Wait ~10–30 seconds, then Retry in the app. If it still fails, run step 4 again once.
