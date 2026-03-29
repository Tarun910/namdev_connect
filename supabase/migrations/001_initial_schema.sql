-- Run this in Supabase Dashboard → SQL Editor (or via Supabase CLI).
-- Creates app tables, RLS, and a trigger to seed profile + welcome notifications for new auth users.
--
-- IMPORTANT (Namdev Connect + Clerk): this file alone is NOT enough. The app uses Clerk, not Supabase
-- Auth, for sign-in. After 001 succeeds, you MUST run 002_clerk_auth.sql in the same project so that
-- profiles get clerk_user_id, profiles.id can be a random UUID, and messages/notifications reference profiles.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null default '',
  email text,
  name text not null default 'Member',
  age int not null default 25,
  gender text,
  location text not null default '',
  profession text not null default '',
  education text not null default '',
  image_url text not null default '',
  is_verified boolean not null default false,
  is_premium boolean not null default false,
  height text,
  income text,
  bio text,
  father_name text,
  mother_name text,
  gotra text,
  birth_date text,
  diet text,
  smoke_alcohol text,
  routine text,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  time_label text,
  is_read boolean not null default false,
  type text not null check (type in ('interest', 'message', 'system', 'verify')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Member'
  );

  insert into public.profiles (id, name, phone, email, image_url)
  values (
    new.id,
    display_name,
    coalesce(new.phone, ''),
    new.email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400'
    )
  );

  insert into public.notifications (user_id, title, body, time_label, is_read, type)
  values
    (new.id, 'Welcome!', 'Welcome to Namdev Connect. Start by completing your profile.', 'Just now', false, 'system'),
    (new.id, 'Interest Received', 'Priya Namdev sent an interest request to you.', '2h ago', false, 'interest'),
    (new.id, 'Verify Profile', 'Get 3x more matches by verifying your profile.', '1d ago', true, 'verify');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
