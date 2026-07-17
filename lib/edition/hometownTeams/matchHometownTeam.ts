/**
 * Match hometown team patterns for a sports market.
 */

import {
  getSportsMarketById,
  HOMETOWN_TEAM_HOMEPAGE_BOOST,
  type HometownTeamTier,
  type SportsMarketCatalogEntry,
} from "./catalog";
import type { SportEventIconKey } from "../sportEventIcon";

export type HometownTeamMatch = {
  teamName: string;
  tier: HometownTeamTier;
  sport: SportEventIconKey;
};

type CompiledTeamRule = {
  teamName: string;
  tier: HometownTeamTier;
  sport: SportEventIconKey;
  test: RegExp;
};

type CompiledMarketRules = {
  teams: CompiledTeamRule[];
  springTraining: RegExp[];
  springTrainingTier: HometownTeamTier;
};

const compiledByMarket = new Map<string, CompiledMarketRules>();

function escapePattern(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

function compilePattern(pattern: string): RegExp {
  if (pattern.includes("|")) {
    const parts = pattern.split("|").map((part) => escapePattern(part.trim()));
    return new RegExp(`\\b(?:${parts.join("|")})\\b`, "i");
  }
  return new RegExp(`\\b${escapePattern(pattern)}\\b`, "i");
}

function compileMarketRules(market: SportsMarketCatalogEntry): CompiledMarketRules {
  const teams: CompiledTeamRule[] = [];
  for (const team of market.teams) {
    for (const pattern of team.patterns) {
      teams.push({
        teamName: team.name,
        tier: team.tier,
        sport: team.sport,
        test: compilePattern(pattern),
      });
    }
  }

  return {
    teams,
    springTraining: (market.springTraining?.patterns ?? []).map(compilePattern),
    springTrainingTier: market.springTraining?.tier ?? "spring_training",
  };
}

function rulesForMarket(marketId: string | null | undefined): CompiledMarketRules | null {
  if (!marketId?.trim()) return null;
  const cached = compiledByMarket.get(marketId);
  if (cached) return cached;

  const market = getSportsMarketById(marketId);
  if (!market) return null;

  const compiled = compileMarketRules(market);
  compiledByMarket.set(marketId, compiled);
  return compiled;
}

function eventHay(input: { name: string; venue?: string | null }): string {
  return `${input.name} ${input.venue ?? ""}`.toLowerCase();
}

export function matchHometownTeam(
  input: { name: string; venue?: string | null },
  sportsMarketId: string | null | undefined
): HometownTeamMatch | null {
  const rules = rulesForMarket(sportsMarketId);
  if (!rules) return null;

  const hay = eventHay(input);
  for (const rule of rules.teams) {
    if (rule.test.test(hay)) {
      return {
        teamName: rule.teamName,
        tier: rule.tier,
        sport: rule.sport,
      };
    }
  }

  if (rules.springTraining.length) {
    const springHit = rules.springTraining.some((pattern) => pattern.test(hay));
    if (springHit) {
      return {
        teamName: "Spring Training",
        tier: rules.springTrainingTier,
        sport: "baseball",
      };
    }
  }

  return null;
}

export function resolveHometownTeamHomepageBoost(
  input: { name: string; venue?: string | null; category?: string | null },
  sportsMarketId: string | null | undefined
): number {
  if (input.category !== "sports") return 0;
  const match = matchHometownTeam(input, sportsMarketId);
  if (!match) return 0;
  return HOMETOWN_TEAM_HOMEPAGE_BOOST[match.tier];
}

export function isHometownTeamEvent(
  input: { name: string; venue?: string | null; category?: string | null },
  sportsMarketId: string | null | undefined
): boolean {
  return resolveHometownTeamHomepageBoost(input, sportsMarketId) > 0;
}

export function resolveHometownTeamSport(
  input: { name: string; venue?: string | null },
  sportsMarketId: string | null | undefined
): SportEventIconKey | null {
  return matchHometownTeam(input, sportsMarketId)?.sport ?? null;
}
