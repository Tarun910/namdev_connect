-- Namdev Connect — full schema (fresh Supabase project)
-- Supabase Dashboard → SQL Editor → paste all → Run
-- Combines migrations 001, 002, 004, 005, 006, 007

-- ========== 001: initial schema ==========

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

-- ========== 002: Clerk auth ==========

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

-- ========== 004: profile gallery ==========

alter table public.profiles add column if not exists gallery_urls text[] not null default '{}';

-- ========== 005: saved interests ==========

create table if not exists public.saved_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_interests_no_self check (user_id <> target_profile_id),
  constraint saved_interests_user_target_unique unique (user_id, target_profile_id)
);

create index if not exists saved_interests_user_id_idx on public.saved_interests (user_id);

-- ========== 006: interest requests ==========

create table if not exists public.interest_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interest_requests_no_self check (from_user_id <> to_user_id),
  constraint interest_requests_pair_unique unique (from_user_id, to_user_id)
);

create index if not exists interest_requests_to_user_idx on public.interest_requests (to_user_id);
create index if not exists interest_requests_from_user_idx on public.interest_requests (from_user_id);
create index if not exists interest_requests_to_pending_idx on public.interest_requests (to_user_id) where status = 'pending';

-- ========== 007: message read receipts ==========

alter table public.messages add column if not exists read_at timestamptz null;

create index if not exists messages_unread_inbox_idx
  on public.messages (receiver_id)
  where read_at is null;

-- ========== 008: profile views ==========

create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint profile_views_no_self check (viewer_id <> viewed_id)
);

create index if not exists profile_views_viewed_id_idx
  on public.profile_views (viewed_id, created_at desc);

create index if not exists profile_views_viewer_viewed_idx
  on public.profile_views (viewer_id, viewed_id, created_at desc);

alter table public.notifications
  add column if not exists viewer_profile_id uuid references public.profiles (id) on delete set null;

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('interest', 'message', 'system', 'verify', 'profile_view'));

notify pgrst, 'reload schema';

-- ========== 009: subscription entitlements ==========

alter table public.profiles
  add column if not exists premium_expires_at timestamptz null,
  add column if not exists premium_plan text null,
  add column if not exists free_chat_partner_id uuid null references public.profiles (id) on delete set null;

alter table public.profiles drop constraint if exists profiles_premium_plan_check;

alter table public.profiles
  add constraint profiles_premium_plan_check
  check (premium_plan is null or premium_plan in ('monthly', '6months', '12months'));

notify pgrst, 'reload schema';
