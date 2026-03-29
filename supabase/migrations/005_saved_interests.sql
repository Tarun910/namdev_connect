-- Bookmark / "interest" list: which profiles the current user saved (heart).
create table if not exists public.saved_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_interests_no_self check (user_id <> target_profile_id),
  constraint saved_interests_user_target_unique unique (user_id, target_profile_id)
);

create index if not exists saved_interests_user_id_idx on public.saved_interests (user_id);

notify pgrst, 'reload schema';
