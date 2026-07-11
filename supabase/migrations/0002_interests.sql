-- Kindred — Milestone 1.1 addition
-- Run this in the same Supabase project's SQL Editor, after 0001_init.sql.

alter table public.profiles
  add column if not exists interests text[] not null default '{}';
