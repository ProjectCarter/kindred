-- Allow authenticated readers to hydrate Today's Masterpiece from the frozen
-- daily selection when editions.morning_edition lost morningHero during rebuild.

alter table public.kindred_hero_artwork_edition_selections enable row level security;

create policy "hero_artwork_selections_read_authenticated"
  on public.kindred_hero_artwork_edition_selections
  for select
  to authenticated
  using (true);

create policy "hero_artwork_selections_read_anon"
  on public.kindred_hero_artwork_edition_selections
  for select
  to anon
  using (true);
