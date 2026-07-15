/**
 * Kindred editorial standard — shared across Local Events, Recommendations,
 * Activities, and Bandit's Picks.
 *
 * Kindred is a local daily newspaper, not a "things to do today" app.
 * Discover and rank content relevant within the next 30 days, within
 * 25 miles of the reader. Quality over quantity.
 */

export const KINDRED_EDITORIAL_HORIZON_DAYS = 30;
export const KINDRED_LOCAL_RADIUS_MILES = 25;
export const KINDRED_LOCAL_RADIUS_KM =
  KINDRED_LOCAL_RADIUS_MILES * 1.609344;

/** Limited-time and plan-ahead experiences worth surfacing this month. */
export const PLANNING_VALUE_PATTERN =
  /\b(festival|fair|farmers? market|concert|live music|comedy|theater|theatre|exhibit|exhibition|pop[- ]?up|seasonal|limited.?time|opening weekend|this weekend|next weekend|u-pick|harvest|workshop|class(es)?|family fun|community celebration|sporting event|tournament|market day)\b/i;
