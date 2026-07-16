-- BarHudking initial schema: places, user_favorites, user_visited + RLS.
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).

create extension if not exists pgcrypto;

create table if not exists places (
  id                uuid primary key default gen_random_uuid(),
  google_place_id   text unique,
  name              text not null,
  area              text,
  lat               numeric,
  lng               numeric,
  place_type        text,        -- restaurant | bar | pub | cafe | brewery | nightclub
  cuisine           text[],
  vibe              text[],
  rating            numeric,
  review_count      int,
  price_min         int,         -- INR
  price_max         int,         -- INR
  address           text,
  source            text,        -- 'seed_api' | 'osm' | 'user'
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists user_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  place_id    uuid references places not null,
  created_at  timestamptz default now(),
  unique (user_id, place_id)
);

create table if not exists user_visited (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  place_id      uuid references places not null,
  user_rating   int check (user_rating between 1 and 5),
  cost_for_two  int,
  visited_at    timestamptz default now(),
  unique (user_id, place_id)
);

-- Indexes for the filter bar (area / type / cuisine / vibe) and per-user lookups.
create index if not exists places_area_idx        on places (area);
create index if not exists places_place_type_idx   on places (place_type);
create index if not exists places_cuisine_idx      on places using gin (cuisine);
create index if not exists places_vibe_idx         on places using gin (vibe);
create index if not exists user_favorites_user_idx on user_favorites (user_id);
create index if not exists user_visited_user_idx   on user_visited (user_id);

-- Keep places.updated_at current on edit.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists places_set_updated_at on places;
create trigger places_set_updated_at
  before update on places
  for each row execute function set_updated_at();

-- Row Level Security -------------------------------------------------------

alter table places enable row level security;
alter table user_favorites enable row level security;
alter table user_visited enable row level security;

-- places: readable by anyone (including anonymous-auth users), writable only
-- via the service role (used by the seed script), so no write policies here.
drop policy if exists "places are publicly readable" on places;
create policy "places are publicly readable"
  on places for select
  using (true);

-- user_favorites: strictly own-row access.
drop policy if exists "users can view own favorites" on user_favorites;
create policy "users can view own favorites"
  on user_favorites for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own favorites" on user_favorites;
create policy "users can insert own favorites"
  on user_favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own favorites" on user_favorites;
create policy "users can delete own favorites"
  on user_favorites for delete
  using (auth.uid() = user_id);

-- user_visited: strictly own-row access, updatable (rating/cost can be added
-- or edited after the initial visit).
drop policy if exists "users can view own visited" on user_visited;
create policy "users can view own visited"
  on user_visited for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own visited" on user_visited;
create policy "users can insert own visited"
  on user_visited for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update own visited" on user_visited;
create policy "users can update own visited"
  on user_visited for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own visited" on user_visited;
create policy "users can delete own visited"
  on user_visited for delete
  using (auth.uid() = user_id);
