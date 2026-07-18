/**
 * Short editorial introductions for front-page sections.
 * One quiet sentence each — understated, never marketing.
 */

export const SECTION_INTROS: Record<string, string> = {
  lead: "The story that leads today’s paper.",
  weather: "What the day looks like outside.",
  top_stories: "The day’s essential reading.",
  local_events: "What’s worth planning for in the weeks ahead.",
  local: "News from close to home.",
  local_news: "News from close to home.",
  business: "Markets and the week ahead.",
  technology: "Developments shaping tomorrow.",
  discovery: "Things worth knowing today.",
  today_in_history: "One story from this date, chosen for you.",
  story_of: "A pause to understand where you live.",
  your_city: "A pause to understand where you live.",
  looking_ahead: "What to keep an eye on next.",
  recommendations: "The best places to eat and drink nearby.",
  food_drinks: "The best places to eat and drink nearby.",
  bandits_picks: "What Bandit says not to miss this month.",
  knowledge: "Context worth carrying into the day.",
  memory: "A thread from earlier reading.",
  morning_edition: "Your morning briefing, in brief.",
};

export function sectionIntro(sectionType: string): string | null {
  const line = SECTION_INTROS[sectionType];
  return line?.trim() || null;
}
