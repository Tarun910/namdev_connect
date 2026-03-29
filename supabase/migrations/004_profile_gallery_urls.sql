-- Extra profile photos (URLs or data URLs). Primary/cover stays in image_url — keep [0] in sync in app.
alter table public.profiles add column if not exists gallery_urls text[] not null default '{}';

notify pgrst, 'reload schema';
