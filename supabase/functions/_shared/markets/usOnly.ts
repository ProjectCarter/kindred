export const KINDRED_COUNTRY_CODE_US = "US" as const;

export const KINDRED_MARKET_DEFAULT_RADIUS_MILES = 25;
export const KINDRED_MARKET_FALLBACK_RADIUS_MILES = 50;

export const MARKET_BUILD_LOCK_MS = 45 * 60 * 1000;

export const SUPPORTED_REGION_MESSAGE =
  "Kindred is currently available in the United States.";

export class NonUsMarketError extends Error {
  readonly code = "NON_US_MARKET" as const;

  constructor(message = SUPPORTED_REGION_MESSAGE) {
    super(message);
    this.name = "NonUsMarketError";
  }
}

export function assertUsCountryCode(
  countryCode: string | null | undefined,
  context = "market"
): void {
  if ((countryCode ?? "").toUpperCase() !== KINDRED_COUNTRY_CODE_US) {
    throw new NonUsMarketError(
      `${SUPPORTED_REGION_MESSAGE} (${context} country_code must be US.)`
    );
  }
}
