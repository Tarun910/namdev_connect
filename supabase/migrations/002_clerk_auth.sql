-- REQUIRED for Clerk + this API: run in Supabase Dashboard → SQL Editor AFTER 001_initial_schema.sql.
-- Without this file, profile insert fails (no clerk_user_id column and/or profiles.id still tied to auth.users).
-- Order: (1) 001_initial_schema.sql  (2) this file  — then restart the backend.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.profiles drop constraint if exists profiles_id_fkey;

alter table public.profiles alter column id set default gen_random_uuid();

alter table public.profiles add column if not exists clerk_user_id text unique;

alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages drop constraint if exists messages_receiver_id_fkey;

alter table public.messages
  add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles (id) on delete cascade;

alter table public.messages
  add constraint messages_receiver_id_fkey foreign key (receiver_id) references public.profiles (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_user_id_fkey;

alter table public.notifications
  add constraint notifications_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

-- PostgREST caches table columns; without this, the API can still say "clerk_user_id" is missing for ~minutes after ALTER.
notify pgrst, 'reload schema';
