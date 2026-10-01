-- ============================================================
-- My Timeline — Supabase setup
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (idempotent).
-- ============================================================

-- 1) Table for timeline entries
create table if not exists public.timeline_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  description text not null default '',
  image       text not null default '',
  event_date  timestamptz not null default now(),
  category    text not null default 'personal'
              check (category in ('games', 'event', 'personal')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- If you already created the table before this default existed, run this once too:
-- alter table public.timeline_entries alter column user_id set default auth.uid();

create index if not exists timeline_entries_user_idx
  on public.timeline_entries (user_id, event_date);

-- 2) Row Level Security — each signed-in user sees and edits ONLY their own rows.
--    This is the real security layer (the anon key in frontend code is public by design).
alter table public.timeline_entries enable row level security;

drop policy if exists "Users manage own entries" on public.timeline_entries;
create policy "Users manage own entries"
  on public.timeline_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Keep updated_at fresh automatically on every edit
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists timeline_entries_touch on public.timeline_entries;
create trigger timeline_entries_touch
  before update on public.timeline_entries
  for each row execute function public.touch_updated_at();

-- 4) Storage bucket for uploaded images (one folder per user, public read)
insert into storage.buckets (id, name, public)
values ('timeline-images', 'timeline-images', true)
on conflict (id) do nothing;

drop policy if exists "Users manage own timeline images" on storage.objects;
create policy "Users manage own timeline images"
  on storage.objects
  for all
  using (
    bucket_id = 'timeline-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'timeline-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
