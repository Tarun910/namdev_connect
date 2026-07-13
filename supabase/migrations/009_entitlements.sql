-- Subscription & usage limits (enforced on API)

alter table public.profiles
  add column if not exists premium_expires_at timestamptz null,
  add column if not exists premium_plan text null,
  add column if not exists free_chat_partner_id uuid null references public.profiles (id) on delete set null;

alter table public.profiles drop constraint if exists profiles_premium_plan_check;

alter table public.profiles
  add constraint profiles_premium_plan_check
  check (premium_plan is null or premium_plan in ('monthly', '6months', '12months'));

notify pgrst, 'reload schema';
