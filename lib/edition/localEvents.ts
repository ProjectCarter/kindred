export type LocalEventCard = {
  name: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  sourceUrl: string;
  sourceName: string;
};

export type LocalEventsBody = {
  events: LocalEventCard[];
};

/** Split provider schedule strings like "Sat, Jul 12, 7 – 9 PM" into date + time. */
export function splitEventSchedule(startDateTime: string): {
  date: string;
  time: string;
} {
  const raw = startDateTime.trim();
  if (!raw || raw === "Time TBA") {
    return { date: "Date TBA", time: "Time TBA" };
  }

  const timeMatch = raw.match(
    /(\d{1,2}(?::\d{2})?(?:\s*[–-]\s*\d{1,2}(?::\d{2})?)?\s*[AaPp][Mm].*)$/
  );
  if (timeMatch) {
    const time = timeMatch[1].trim();
    const date = raw.slice(0, raw.length - time.length).replace(/[,\s]+$/, "").trim();
    return {
      date: date || "This week",
      time,
    };
  }

  return { date: raw, time: "See listing" };
}

export function parseLocalEventsBody(
  body: string
): LocalEventCard[] | null {
  try {
    const parsed = JSON.parse(body) as LocalEventsBody;
    if (!parsed || !Array.isArray(parsed.events)) return null;
    return parsed.events.filter(
      (e) => e && typeof e.name === "string" && e.name.length > 0
    );
  } catch {
    return null;
  }
}
