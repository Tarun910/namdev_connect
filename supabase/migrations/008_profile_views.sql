-- Profile views + visitor notifications (premium unlocks viewer identity)

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
