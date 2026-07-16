-- Adds image_url to places: a direct Google-hosted thumbnail URL, already
-- present for free in every SearchApi google_maps/google_maps_place
-- response (field `thumbnail`) but previously discarded by the seed
-- script. Run this in the Supabase SQL editor before re-seeding.

alter table places add column if not exists image_url text;
