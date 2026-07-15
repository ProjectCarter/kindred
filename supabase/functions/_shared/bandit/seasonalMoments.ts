/**
 * Bandit's seasonal calendar — punchy headlines only.
 * Whispers rotate from the shared pool in selectPick.ts (Bandit's voice).
 */

export type SeasonalMoment = {
  id: string;
  startMonthDay: string;
  endMonthDay: string;
  /** Punchy headline — emoji, urgency, "I should do that this week." */
  title: string;
  rarity: number;
  peakDays: number;
  fadeDays: number;
};

export const SEASONAL_MOMENTS: SeasonalMoment[] = [
  {
    id: "fresh_start_january",
    startMonthDay: "01-02",
    endMonthDay: "01-14",
    title: "The year's quietest week",
    rarity: 0.45,
    peakDays: 4,
    fadeDays: 8,
  },
  {
    id: "citrus_season",
    startMonthDay: "01-15",
    endMonthDay: "02-20",
    title: "🍊 Citrus is at its sweetest",
    rarity: 0.5,
    peakDays: 5,
    fadeDays: 12,
  },
  {
    id: "early_spring_thaw",
    startMonthDay: "03-01",
    endMonthDay: "03-19",
    title: "🌱 Something's finally thawing",
    rarity: 0.5,
    peakDays: 4,
    fadeDays: 10,
  },
  {
    id: "cherry_blossoms",
    startMonthDay: "03-20",
    endMonthDay: "04-10",
    title: "🌸 The blossoms are out",
    rarity: 0.75,
    peakDays: 6,
    fadeDays: 10,
  },
  {
    id: "wildflower_bloom",
    startMonthDay: "04-05",
    endMonthDay: "05-15",
    title: "🌸 The wildflowers are peaking",
    rarity: 0.75,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "farmers_markets_reopen",
    startMonthDay: "04-11",
    endMonthDay: "05-05",
    title: "🧺 Saturday markets are back",
    rarity: 0.55,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "strawberry_season",
    startMonthDay: "05-06",
    endMonthDay: "06-10",
    title: "🍓 Strawberry fields are at their best",
    rarity: 0.7,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "lavender_bloom",
    startMonthDay: "06-01",
    endMonthDay: "07-10",
    title: "💜 Lavender won't stay purple long",
    rarity: 0.72,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "firefly_season",
    startMonthDay: "06-15",
    endMonthDay: "07-15",
    title: "✨ Fireflies are out tonight",
    rarity: 0.7,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "monsoon_evenings",
    startMonthDay: "07-01",
    endMonthDay: "09-15",
    title: "🌧 Monsoon skies at golden hour",
    rarity: 0.82,
    peakDays: 8,
    fadeDays: 14,
  },
  {
    id: "blueberry_season",
    startMonthDay: "06-11",
    endMonthDay: "07-20",
    title: "🫐 Blueberries won't wait",
    rarity: 0.78,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "longest_days",
    startMonthDay: "06-11",
    endMonthDay: "06-24",
    title: "☀️ The longest days of the year",
    rarity: 0.55,
    peakDays: 5,
    fadeDays: 8,
  },
  {
    id: "peach_season",
    startMonthDay: "06-25",
    endMonthDay: "07-25",
    title: "🍑 Peach season is here",
    rarity: 0.72,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "meteor_showers",
    startMonthDay: "08-10",
    endMonthDay: "08-20",
    title: "✨ The Perseids are almost here",
    rarity: 0.75,
    peakDays: 4,
    fadeDays: 8,
  },
  {
    id: "sunflower_bloom",
    startMonthDay: "07-26",
    endMonthDay: "08-20",
    title: "🌻 Sunflowers are at peak bloom",
    rarity: 0.7,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "butterfly_season",
    startMonthDay: "09-01",
    endMonthDay: "10-15",
    title: "🦋 The butterflies are back",
    rarity: 0.68,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "harvest_peak",
    startMonthDay: "08-15",
    endMonthDay: "09-14",
    title: "🧺 Peak harvest at the market",
    rarity: 0.68,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "tomato_season",
    startMonthDay: "08-21",
    endMonthDay: "09-14",
    title: "🍅 Tomatoes taste like summer right now",
    rarity: 0.6,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "first_cool_morning",
    startMonthDay: "09-15",
    endMonthDay: "09-29",
    title: "🥾 The first cool morning to hike",
    rarity: 0.55,
    peakDays: 4,
    fadeDays: 8,
  },
  {
    id: "apple_picking",
    startMonthDay: "09-30",
    endMonthDay: "10-14",
    title: "🍎 Apple picking starts this weekend",
    rarity: 0.65,
    peakDays: 6,
    fadeDays: 10,
  },
  {
    id: "apple_cider_donuts",
    startMonthDay: "09-20",
    endMonthDay: "10-25",
    title: "🍩 Cider donuts are hot off the press",
    rarity: 0.72,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "pumpkin_patches",
    startMonthDay: "10-01",
    endMonthDay: "10-30",
    title: "🎃 Pumpkin patches open this week",
    rarity: 0.65,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "fall_foliage",
    startMonthDay: "10-08",
    endMonthDay: "11-05",
    title: "🍂 Peak color is almost here",
    rarity: 0.7,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "cider_season",
    startMonthDay: "11-06",
    endMonthDay: "11-25",
    title: "🍂 Cider season just arrived",
    rarity: 0.5,
    peakDays: 5,
    fadeDays: 10,
  },
  {
    id: "holiday_market",
    startMonthDay: "12-01",
    endMonthDay: "12-23",
    title: "🎄 Holiday markets are open",
    rarity: 0.68,
    peakDays: 6,
    fadeDays: 12,
  },
  {
    id: "christmas_lights",
    startMonthDay: "12-01",
    endMonthDay: "12-28",
    title: "✨ The lights are up — for now",
    rarity: 0.8,
    peakDays: 7,
    fadeDays: 14,
  },
  {
    id: "early_lights",
    startMonthDay: "11-26",
    endMonthDay: "11-30",
    title: "✨ The lights are going up",
    rarity: 0.55,
    peakDays: 4,
    fadeDays: 6,
  },
  {
    id: "quiet_year_end",
    startMonthDay: "12-21",
    endMonthDay: "12-31",
    title: "The quiet stretch of the year",
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

function daysSinceStart(moment: SeasonalMoment, date: Date): number | null {
  const year = date.getFullYear();
  const today = dayOfYear(date);
  const start = toDayOfYear(moment.startMonthDay, year);
  const end = toDayOfYear(moment.endMonthDay, year);

  if (start <= end) {
    if (today < start || today > end) return null;
    return today - start;
  }
  if (today >= start) return today - start;
  if (today <= end) return today + (365 - start);
  return null;
}

export type ScoredSeasonalMoment = {
  moment: SeasonalMoment;
  score: number;
  daysActive: number;
};

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
      decay = 1 - progress * 0.75;
    } else {
      decay = 0.15;
    }

    out.push({
      moment,
      score: 40 + moment.rarity * 45 * decay,
      daysActive: days,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
