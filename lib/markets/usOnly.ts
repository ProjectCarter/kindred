import { KINDRED_COUNTRY_CODE_US, SUPPORTED_REGION_MESSAGE } from "./constants";
import type { KindredPlace } from "../location/types";

export class NonUsMarketError extends Error {
  readonly code = "NON_US_MARKET" as const;

  constructor(message = SUPPORTED_REGION_MESSAGE) {
    super(message);
    this.name = "NonUsMarketError";
  }
}

/** True when place has a US state code (Kindred V1 US-only). */
export function isUsKindredPlace(place: KindredPlace | null | undefined): boolean {
  if (!place?.city?.trim()) return false;
  const state = place.state?.trim();
  if (!state || state.length !== 2) return false;
  return /^[A-Z]{2}$/i.test(state);
}

export function assertUsKindredPlace(
  place: KindredPlace | null | undefined,
  context = "location"
): asserts place is KindredPlace & { state: string } {
  if (!isUsKindredPlace(place)) {
    throw new NonUsMarketError(
      `${SUPPORTED_REGION_MESSAGE} (${context} is outside the United States.)`
    );
  }
}

export function assertUsCountryCode(
  countryCode: string | null | undefined,
  context = "market"
): asserts countryCode is typeof KINDRED_COUNTRY_CODE_US {
  if ((countryCode ?? "").toUpperCase() !== KINDRED_COUNTRY_CODE_US) {
    throw new NonUsMarketError(
      `${SUPPORTED_REGION_MESSAGE} (${context} country_code must be US.)`
    );
  }
}

export function normalizeUsStateCode(state: string): string {
  return state.trim().toUpperCase().slice(0, 2);
}
