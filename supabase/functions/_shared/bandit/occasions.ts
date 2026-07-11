import type { BanditComposeInput, BanditOccasion } from "./types.ts";

function parseEditionDate(editionDate: string, fallback: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
    const [y, m, d] = editionDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return fallback;
}

function isBirthday(editionDate: string, birthdayMMDD?: string | null): boolean {
  if (!birthdayMMDD || !/^\d{2}-\d{2}$/.test(birthdayMMDD)) return false;
  const date = parseEditionDate(editionDate, new Date());
  const [bm, bd] = birthdayMMDD.split("-").map(Number);
  return date.getMonth() + 1 === bm && date.getDate() === bd;
}

function seasonFor(date: Date): "spring" | "summer" | "autumn" | "winter" {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

function isSeasonTurn(date: Date): boolean {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return (
    (m === 3 && d === 20) ||
    (m === 6 && d === 21) ||
    (m === 9 && d === 22) ||
    (m === 12 && d === 21)
  );
}

function holidayName(date: Date): string | null {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (m === 1 && d === 1) return "New Year's Day";
  if (m === 2 && d === 14) return "Valentine's Day";
  if (m === 7 && d === 4) return "Independence Day";
  if (m === 10 && d === 31) return "Halloween";
  if (m === 12 && d === 25) return "Christmas";
  if (m === 12 && d === 31) return "New Year's Eve";
  return null;
}

function isTraveling(input: BanditComposeInput): boolean {
  const travel = input.reader.travel;
  if (travel?.away) return true;
  const home = input.reader.homeCity?.trim().toLowerCase();
  const here = input.location.city?.trim().toLowerCase();
  if (home && here && home !== here && here !== "your area") return true;
  return false;
}

export type DetectedOccasions = {
  primary: BanditOccasion;
  all: BanditOccasion[];
  holidayName: string | null;
  season: "spring" | "summer" | "autumn" | "winter";
  isBirthday: boolean;
  isTraveling: boolean;
  isSeasonTurn: boolean;
};

/**
 * Detect which Bandit occasions apply today.
 * Priority: birthday → travel → holiday/special → seasonal → morning.
 */
export function detectBanditOccasions(
  input: BanditComposeInput
): DetectedOccasions {
  const now = input.now ?? new Date();
  const date = parseEditionDate(input.editionDate, now);
  const birthday = isBirthday(input.editionDate, input.reader.birthdayMMDD);
  const traveling = isTraveling(input);
  const holiday = holidayName(date);
  const seasonTurn = isSeasonTurn(date);
  const season = seasonFor(date);

  const all: BanditOccasion[] = ["morning"];
  if (birthday) all.push("birthday");
  if (traveling) all.push("travel");
  if (holiday) {
    all.push("holiday");
    all.push("special_edition");
  }
  if (seasonTurn) all.push("seasonal");

  // Soft weekly marker on Sundays — reserved for weekly recommendations.
  if (date.getDay() === 0) all.push("weekly");

  let primary: BanditOccasion = "morning";
  if (birthday) primary = "birthday";
  else if (traveling) primary = "travel";
  else if (holiday) primary = "special_edition";
  else if (seasonTurn) primary = "seasonal";
  else if (date.getDay() === 0) primary = "weekly";

  return {
    primary,
    all: Array.from(new Set(all)),
    holidayName: holiday,
    season,
    isBirthday: birthday,
    isTraveling: traveling,
    isSeasonTurn: seasonTurn,
  };
}
