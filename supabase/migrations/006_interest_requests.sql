-- Match / interest requests: sender → recipient, pending until accept or reject.
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

notify pgrst, 'reload schema';
