-- BarHudking v2 — optional sync backend.
--
-- The app works fully without this. Run it once in a (new, free) Supabase
-- project's SQL editor to enable accounts (email sign-in, cross-device sync)
-- and community stats. Places are NOT stored here; they ship with the app in
-- public/data/places.json, so losing this project never loses the catalogue.

-- One row per user holding their whole UserData document (favorites, visits,
-- notes, lists, spots — see src/lib/store.ts). Devices merge record-by-record
-- on the client, so a single jsonb column is all that's needed.
create table if not exists public.user_data (
  user_id     uuid primary key references auth.users on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "own row: select" on public.user_data;
create policy "own row: select" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "own row: insert" on public.user_data;
create policy "own row: insert" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "own row: update" on public.user_data;
create policy "own row: update" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row: delete" on public.user_data;
create policy "own row: delete" on public.user_data
  for delete using (auth.uid() = user_id);

-- Aggregated, anonymous visit stats per place across all users. SECURITY
-- DEFINER so it can read every row, but it only ever returns aggregates —
-- never who visited, notes, or anything per-user.
create or replace function public.community_stats()
returns table (place_id text, visits int, people int, avg_rating numeric, avg_cost numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    v->>'placeId'                                                as place_id,
    count(*)::int                                                as visits,
    count(distinct u.user_id)::int                               as people,
    round(avg(nullif(v->>'rating', '')::numeric), 1)             as avg_rating,
    round(avg(nullif(v->>'costForTwo', '')::numeric) / 50) * 50  as avg_cost
  from public.user_data u,
       jsonb_each(u.data->'visits') as e(id, v)
  where coalesce((v->>'deleted')::boolean, false) = false
  group by 1;
$$;

revoke all on function public.community_stats() from public;
grant execute on function public.community_stats() to anon, authenticated;
