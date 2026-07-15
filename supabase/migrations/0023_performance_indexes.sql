-- Kindred V1 Phase One — query performance for edition load path.

-- Every home open fetches sections by edition_id; RLS subquery benefits too.
create index if not exists edition_sections_edition_id_position_idx
  on public.edition_sections (edition_id, position);

-- generation_jobs lookup on not-ready path (user_id + edition_date).
create index if not exists generation_jobs_user_date_idx
  on public.generation_jobs (user_id, edition_date);
