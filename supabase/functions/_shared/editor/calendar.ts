import type { EditionMode, EditorialCalendar } from "./types.ts";

function parseEditionDate(editionDate: string, fallback: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
    const [y, m, d] = editionDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return fallback;
}

/**
 * Weekend vs weekday edition framing — how an editor would set the desk.
 */
export function buildEditorialCalendar(
  editionDate: string,
  now: Date = new Date()
): EditorialCalendar {
  const date = parseEditionDate(editionDate, now);
  const dayOfWeek = date.getDay();
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;
  const isWeekend = isSaturday || isSunday;

  let mode: EditionMode = "weekday_morning";
  if (isSaturday) mode = "saturday_weekend";
  if (isSunday) mode = "sunday_weekend";

  const modeLabel =
    mode === "sunday_weekend"
      ? "Sunday edition — leisurely, curious, less hurried"
      : mode === "saturday_weekend"
      ? "Saturday edition — room to breathe, features welcome"
      : "Weekday morning edition — fresh, clear, purposeful";

  return {
    editionDate,
    dayOfWeek,
    isWeekend,
    isSaturday,
    isSunday,
    mode,
    modeLabel,
  };
}
