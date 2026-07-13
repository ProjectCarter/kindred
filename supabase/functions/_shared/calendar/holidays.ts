/**
 * Lightweight US holiday + high-outing cultural day detector.
 * Used only to widen the Local Events target on days when people are
 * actually out looking for something to do — not a full calendar system.
 */

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * True for US federal holidays plus a handful of high-outing cultural
 * days (Halloween, Cinco de Mayo, New Year's Eve, etc.) — the days local
 * events actually spike, regardless of weekday.
 */
export function isUsHolidayOrEve(date: Date): boolean {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  const fixed: Array<[number, number]> = [
    [0, 1], // New Year's Day
    [1, 14], // Valentine's Day
    [2, 17], // St. Patrick's Day
    [4, 5], // Cinco de Mayo
    [5, 19], // Juneteenth
    [6, 4], // Independence Day
    [9, 31], // Halloween
    [10, 11], // Veterans Day
    [11, 24], // Christmas Eve
    [11, 25], // Christmas Day
    [11, 31], // New Year's Eve
  ];
  if (fixed.some(([fm, fd]) => m === fm && d === fd)) return true;

  const floating: Date[] = [
    nthWeekdayOfMonth(y, 0, 1, 3), // MLK Day — 3rd Monday of January
    nthWeekdayOfMonth(y, 1, 1, 3), // Presidents Day — 3rd Monday of February
    lastWeekdayOfMonth(y, 4, 1), // Memorial Day — last Monday of May
    nthWeekdayOfMonth(y, 8, 1, 1), // Labor Day — 1st Monday of September
    nthWeekdayOfMonth(y, 9, 1, 2), // Columbus Day — 2nd Monday of October
    nthWeekdayOfMonth(y, 10, 4, 4), // Thanksgiving — 4th Thursday of November
  ];
  if (floating.some((h) => sameDate(h, date))) return true;

  // The day after Thanksgiving is its own event-heavy day.
  const thanksgiving = nthWeekdayOfMonth(y, 10, 4, 4);
  const dayAfterThanksgiving = new Date(thanksgiving);
  dayAfterThanksgiving.setDate(dayAfterThanksgiving.getDate() + 1);
  if (sameDate(dayAfterThanksgiving, date)) return true;

  return false;
}
