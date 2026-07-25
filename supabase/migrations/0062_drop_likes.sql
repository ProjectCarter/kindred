-- Kindred — Remove the Like/Save system.
-- Product decision: Kindred is an editorial daily-discovery newspaper, not a
-- social app. Events, deals, and recommendations expire, so a persistent
-- "Saved / Liked" collection no longer fits. The heart UI and its client API
-- (lib/edition/likes.ts) have been removed, leaving public.likes unused by any
-- code path. Drop it.
--
-- Note: the 'like' / 'unlike' values on user_reading_signals.signal_type are
-- intentionally preserved — the personalization aggregator still folds any
-- historical signals of those types, and the check constraint stays permissive.

drop table if exists public.likes;
