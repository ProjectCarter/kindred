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
  today_in_history: "Today in History",
  looking_ahead: "Looking Ahead",
};

export function formatEditionDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
