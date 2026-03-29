-- Read receipts: null = not yet read by receiver; set when they open the thread.
alter table public.messages add column if not exists read_at timestamptz null;

create index if not exists messages_unread_inbox_idx
  on public.messages (receiver_id)
  where read_at is null;

notify pgrst, 'reload schema';
