export type EditionSection = {
  id: string;
  section_type: string;
  position: number;
  headline: string;
  body: string;
  source_note: string | null;
};

export const SECTION_LABELS: Record<string, string> = {
  weather: "Weather",
  top_stories: "Top Stories",
  local_events: "Local Events",
  local: "Local",
  local_news: "Local",
  business: "Business",
  technology: "Technology",
  discovery: "Discovery",
  today_in_history: "History",
  looking_ahead: "Looking Ahead",
  recommendations: "Recommendations",
  bandits_picks: "From the desk",
  knowledge: "Context",
  memory: "From the Archive",
  morning_edition: "Morning Edition",
  greeting: "Today",
};

export function formatEditionDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
