/**
 * Short editorial introductions for front-page sections.
 * One quiet sentence each — understated, never marketing.
 */

export const SECTION_INTROS: Record<string, string> = {
  lead: "The story that leads today’s paper.",
  weather: "What the day looks like outside.",
  top_stories: "The day’s essential reading.",
  local_events: "What’s happening nearby this week.",
  local: "News from close to home.",
  local_news: "News from close to home.",
  business: "Markets and the week ahead.",
  technology: "Developments shaping tomorrow.",
  discovery: "Things worth knowing today.",
  today_in_history: "A moment from this day in years past.",
  looking_ahead: "What to keep an eye on next.",
  recommendations: "Quiet suggestions from the desk.",
  bandits_picks: "What Bandit set aside for you.",
  knowledge: "Context worth carrying into the day.",
  memory: "A thread from earlier reading.",
  morning_edition: "Your morning briefing, in brief.",
};

export function sectionIntro(sectionType: string): string | null {
  const line = SECTION_INTROS[sectionType];
  return line?.trim() || null;
}
