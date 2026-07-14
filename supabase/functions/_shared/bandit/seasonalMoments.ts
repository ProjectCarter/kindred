/**
 * Bandit's seasonal moments — hand-authored, location-agnostic beats on
 * the calendar (US, northern-hemisphere seasons — Kindred's metros today).
 * Not a directory listing: no specific venue is ever named here, just the
 * kind of quiet, timely thing worth noticing. These compete for Bandit's
 * Pick alongside real places, real events, and articles — they don't
 * automatically win.
 *
 * "Peak decay": a moment scores highest right when it starts (the moment
 * worth saying "just started" / "opens this weekend" about) and fades over
 * the following two weeks, so the same line never wins Bandit's Pick for
 * an entire month — the pool naturally moves on to other candidates as
 * the novelty passes, without needing cross-day history tracking.
 */

export type SeasonalMoment = {
  id: string;
  /** MM-DD, inclusive. May wrap the new year (e.g. 12-01 -> 01-05). */
  startMonthDay: string;
  endMonthDay: string;
  /** Short title — stands in for a headline. */
  title: string;
  /** Bandit's own one- or two-sentence line. */
  line: string;
  /** 0-1 — how much this deserves the spotlight vs. a quieter mention. */
  rarity: number;
  /** Days from start where the moment is at its most "just happened" peak. */
  peakDays: number;
  /** Days after the peak where it fades to a low, rarely-winning floor. */
  fadeDays: number;
};

export const SEASONAL_MOMENTS: SeasonalMoment[] = [
  {
    id: "fresh_start_january",
    startMonthDay: "01-02",
    endMonthDay: "01-14",
    title: "A quieter kind of new year",
    line: "The first quiet week of the year. No resolutions required.",
    rarity: 0.45,
    peakDays: 4,
    fadeDays: 8,
  },
  {
    id: "citrus_season",
    startMonthDay: "01-15",
    endMonthDay: "02-20",
    title: "Citrus season",
    line: "Citrus is at its best right now — worth a stop at a farm stand.",
    rarity: 0.5,
    peakDays: 5,
    fadeDays: 12,
  },
  {
    id: "early_spring_thaw",
    startMonthDay: "03-01",
    endMonthDay: "03-19",
    title: "The first thaw",
    line: "Something's loosening up outside. Spring is closer than it looks.",
    rarity: 0.5,
    peakDays: 4,
    fadeDays: 10,
  },
  {
    id: "cherry_blossoms",
    startMonthDay: "03-20",
    endMonthDay: "04-10",
    title: "Blossom season",
    line: "The first blooms are out. They never last as long as you'd like.",
    rarity: 0.75,
    peakDays: 6,
    fadeDays: 10,
  },
  {
    id: "farmers_markets_reopen",
    startMonthDay: "04-11",
    endMonthDay: "05-05",
    title: "Farmers markets are back",
    line: "The Saturday markets are open again. Worth an early walk.",
    rarity: 0.55,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "strawberry_season",
    startMonthDay: "05-06",
    endMonthDay: "06-10",
    title: "Strawberry season",
    line: "Strawberry season just started. Find a local stand before it ends.",
    rarity: 0.7,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "longest_days",
    startMonthDay: "06-11",
    endMonthDay: "06-24",
    title: "The longest days",
    line: "The days won't get longer than this. Stay out a little later tonight.",
    rarity: 0.55,
    peakDays: 5,
    fadeDays: 8,
  },
  {
    id: "peach_season",
    startMonthDay: "06-25",
    endMonthDay: "07-25",
    title: "Peach season",
    line: "Peaches are finally worth buying again. Don't wait on this one.",
    rarity: 0.65,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "sunflower_bloom",
    startMonthDay: "07-26",
    endMonthDay: "08-20",
    title: "Sunflowers at peak bloom",
    line: "Sunflowers are near peak bloom. Worth the detour while it lasts.",
    rarity: 0.7,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "tomato_season",
    startMonthDay: "08-21",
    endMonthDay: "09-14",
    title: "Tomato season",
    line: "Tomatoes are at their best right now. This window is short.",
    rarity: 0.6,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "first_cool_morning",
    startMonthDay: "09-15",
    endMonthDay: "09-29",
    title: "The first cool morning",
    line: "The air finally turned. Something about that first cool morning.",
    rarity: 0.5,
    peakDays: 4,
    fadeDays: 8,
  },
  {
    id: "apple_picking",
    startMonthDay: "09-30",
    endMonthDay: "10-14",
    title: "Apple picking season",
    line: "Apple picking just opened up nearby. It won't stay this good for long.",
    rarity: 0.65,
    peakDays: 6,
    fadeDays: 10,
  },
  {
    id: "pumpkin_patches",
    startMonthDay: "10-01",
    endMonthDay: "10-30",
    title: "Pumpkin patches are open",
    line: "The pumpkin patches opened this weekend. Worth going before the weather turns.",
    rarity: 0.65,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "fall_foliage",
    startMonthDay: "10-08",
    endMonthDay: "11-05",
    title: "Peak foliage",
    line: "The leaves are close to peak color. A slower drive is worth it this week.",
    rarity: 0.7,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "cider_season",
    startMonthDay: "11-06",
    endMonthDay: "11-25",
    title: "Cider season",
    line: "Cider season is here. A small thing, but a good one.",
    rarity: 0.5,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "early_lights",
    startMonthDay: "11-26",
    endMonthDay: "12-20",
    title: "The lights are going up",
    line: "The lights are starting to go up around town. Worth a walk after dark.",
    rarity: 0.6,
    peakDays: 6,
    fadeDays: 14,
  },
  {
    id: "quiet_year_end",
    startMonthDay: "12-21",
    endMonthDay: "12-31",
    title: "The quiet stretch",
    line: "This week always feels a little suspended. Let it.",
    rarity: 0.5,
    peakDays: 5,
    fadeDays: 8,
  },
];

function toDayOfYear(monthDay: string, year: number): number {
  const [m, d] = monthDay.split("-").map(Number);
  return Math.floor(
    (Date.UTC(year, (m ?? 1) - 1, d ?? 1) - Date.UTC(year, 0, 1)) / 86_400_000
  );
}

function dayOfYear(date: Date): number {
  return Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 1)) /
      86_400_000
  );
}

/** Days since a moment's window opened this year, handling year wrap. */
function daysSinceStart(
  moment: SeasonalMoment,
  date: Date
): number | null {
  const year = date.getFullYear();
  const today = dayOfYear(date);
  const start = toDayOfYear(moment.startMonthDay, year);
  const end = toDayOfYear(moment.endMonthDay, year);

  if (start <= end) {
    if (today < start || today > end) return null;
    return today - start;
  }
  // Wraps the new year (e.g. 12-01 -> 01-05).
  if (today >= start) return today - start;
  if (today <= end) return today + (365 - start);
  return null;
}

export type ScoredSeasonalMoment = {
  moment: SeasonalMoment;
  /** 0-100ish, comparable to other Bandit's Pick candidate scores. */
  score: number;
  daysActive: number;
};

/** Active moments today, scored by how close they are to their peak. */
export function activeSeasonalMoments(date: Date): ScoredSeasonalMoment[] {
  const out: ScoredSeasonalMoment[] = [];
  for (const moment of SEASONAL_MOMENTS) {
    const days = daysSinceStart(moment, date);
    if (days == null) continue;

    let decay: number;
    if (days <= moment.peakDays) {
      decay = 1;
    } else if (days <= moment.peakDays + moment.fadeDays) {
      const progress = (days - moment.peakDays) / moment.fadeDays;
      decay = 1 - progress * 0.75; // fades to a 25% floor, never zero
    } else {
      decay = 0.15; // still technically active, rarely competitive
    }

    out.push({
      moment,
      score: 40 + moment.rarity * 45 * decay,
      daysActive: days,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
