-- Read policies for Developer Tools market directory (US-only rows).

create policy "kindred_us_markets_read_authenticated"
  on public.kindred_us_markets
  for select
  to authenticated
  using (country_code = 'US');

create policy "kindred_market_build_logs_read_authenticated"
  on public.kindred_market_build_logs
  for select
  to authenticated
  using (country_code = 'US');

comment on policy "kindred_us_markets_read_authenticated" on public.kindred_us_markets is
  'Dev Tools: list ranked United States markets. Writes go through edge functions.';
