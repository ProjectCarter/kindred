import type { HolidayTag } from "./types";

function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  n: number
): number {
  const first = new Date(year, monthIndex, 1);
  const firstWeekday = first.getDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return day;
}

function lastWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number
): number {
  const last = new Date(year, monthIndex + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return last.getDate() - offset;
}

/**
 * Tasteful special-edition tags for the morning photograph.
 * Returns at most one primary holiday for scoring.
 */
export function detectHoliday(
  date: Date,
  birthdayMMDD?: string | null
): HolidayTag | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (birthdayMMDD) {
    const [bm, bd] = birthdayMMDD.split("-").map(Number);
    if (bm === month && bd === day) return "birthday";
  }

  if (month === 1 && day === 1) return "new_year";
  if (month === 2 && day === 14) return "valentines";
  if (month === 3 && day === 17) return "st_patricks";
  if (month === 7 && day === 4) return "independence_day";
  if (month === 10 && day === 31) return "halloween";
  if (month === 12 && day === 25) return "christmas";
  if (month === 12 && day === 31) return "new_years_eve";

  // Memorial Day — last Monday in May
  if (month === 5 && day === lastWeekdayOfMonth(year, 4, 1)) {
    return "memorial_day";
  }

  // Labor Day — first Monday in September
  if (month === 9 && day === nthWeekdayOfMonth(year, 8, 1, 1)) {
    return "labor_day";
  }

  // Thanksgiving — fourth Thursday in November
  if (month === 11 && day === nthWeekdayOfMonth(year, 10, 4, 4)) {
    return "thanksgiving";
  }

  // Easter (Anonymous Gregorian algorithm) — soft atmosphere day
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
  if (month === easterMonth && day === easterDay) return "easter";

  return null;
}
