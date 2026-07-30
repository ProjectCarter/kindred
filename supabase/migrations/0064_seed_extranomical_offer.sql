-- First real affiliate offer — Extranomical Tours (AWIN).
--
-- Stores ONE curated offer directly in the anon-readable projection
-- (public.deals_published). This is the "direct merchant" seed path: a single
-- hand-curated offer, stored as data, that the mobile app reads with no code
-- changes. Every future affiliate offer (Ticketmaster, Viator, Eventbrite,
-- CityPASS, Groupon, Travelzoo, CJ, Impact, Rakuten, …) is added the same way —
-- another row with its own `redeem_url`.
--
-- Requires 0063_deals_platform.sql (creates deals_published + RLS).
--
-- The affiliate tracking URL is stored EXACTLY as provided — never rebuilt,
-- never modified, no extra parameters appended. The app opens this value
-- verbatim. Idempotent: re-running updates the same row (unique deal_key).

insert into public.deals_published (
  id,
  deal_key,
  scope,
  region_key,
  category,
  deal_type,
  discount_type,
  emoji,
  merchant,
  title,
  savings_label,
  description,
  savings_detail,
  known_for,
  highlights,
  city,
  state,
  lat,
  lon,
  website,
  redeem_url,
  source,
  terms,
  voucher_code,
  image_url,
  featured_rank,
  quality_score,
  starts_at,
  ends_at,
  status
) values (
  gen_random_uuid(),
  'extranomical-alcatraz-sf-city-tour',
  'local',
  'san-francisco-ca',
  'things_to_do',
  'experience',
  null,
  '🎟️',
  'Extranomical Tours',
  'Guided Alcatraz and San Francisco City Tour',
  'Guided tour',
  'A guided tour that pairs a visit to Alcatraz Island with a sightseeing loop through San Francisco, led by Extranomical Tours.',
  'Book the guided Alcatraz and San Francisco city tour through Extranomical Tours.',
  'Alcatraz Island, the former federal prison in San Francisco Bay, and the city''s best-known landmarks.',
  '["Alcatraz Island", "San Francisco city tour", "Guided experience"]'::jsonb,
  'San Francisco, CA',
  'CA',
  null,
  null,
  null,
  -- Exact AWIN affiliate tracking URL — stored verbatim, opened verbatim.
  'https://tidd.ly/4w3vAiu',
  'AWIN',
  'Provided by Extranomical Tours via the AWIN affiliate network. Availability, schedule, and pricing are set by the merchant.',
  null,
  null,
  1,
  0.95,
  null,
  null,
  'published'
)
on conflict (deal_key) do update set
  scope         = excluded.scope,
  region_key    = excluded.region_key,
  category      = excluded.category,
  deal_type     = excluded.deal_type,
  emoji         = excluded.emoji,
  merchant      = excluded.merchant,
  title         = excluded.title,
  savings_label = excluded.savings_label,
  description   = excluded.description,
  savings_detail = excluded.savings_detail,
  known_for     = excluded.known_for,
  highlights    = excluded.highlights,
  city          = excluded.city,
  state         = excluded.state,
  redeem_url    = excluded.redeem_url,
  source        = excluded.source,
  terms         = excluded.terms,
  featured_rank = excluded.featured_rank,
  quality_score = excluded.quality_score,
  status        = excluded.status,
  updated_at    = now();
