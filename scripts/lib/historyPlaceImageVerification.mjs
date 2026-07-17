/**
 * History Around Town — HTTP image verification with retry + rate-limit handling.
 * Mirror: supabase/functions/_shared/historyAroundTown/imageVerification.ts
 *
 * Rules:
 *   HTTP 200–399 (success)     → verified
 *   HTTP 429 after retries     → verification_pending_rate_limit (never reject record)
 *   HTTP 404/410               → failed
 *   Other transient (5xx, net) → retry with backoff; then verification_pending_transient
 */

export const IMAGE_VERIFICATION_STATUS = {
  VERIFIED: "verified",
  PENDING_RATE_LIMIT: "verification_pending_rate_limit",
  PENDING_TRANSIENT: "verification_pending_transient",
  FAILED: "failed",
  PENDING: "pending",
};

const USER_AGENT = "KindredBot/1.0 (History Around Town image verification)";

const TRUSTED_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "wikipedia.org",
];

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [800, 2000, 5000];

const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);
const FAILED_HTTP = new Set([404, 410]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function imageUrlForRow(row) {
  return row.hosted_url?.trim() || row.image_url?.trim() || null;
}

export function isTrustedImageSource(url) {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return TRUSTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function classifyHttpStatus(status) {
  if (status >= 200 && status < 400) return IMAGE_VERIFICATION_STATUS.VERIFIED;
  if (FAILED_HTTP.has(status)) return IMAGE_VERIFICATION_STATUS.FAILED;
  if (status === 429) return IMAGE_VERIFICATION_STATUS.PENDING_RATE_LIMIT;
  if (TRANSIENT_HTTP.has(status) || status === 0) {
    return IMAGE_VERIFICATION_STATUS.PENDING_TRANSIENT;
  }
  if (status >= 400) return IMAGE_VERIFICATION_STATUS.FAILED;
  return IMAGE_VERIFICATION_STATUS.PENDING_TRANSIENT;
}

/**
 * Verify one image URL with exponential backoff for trusted sources.
 * @returns {{ status: string, httpStatus: number, attempts: number, error?: string }}
 */
export async function verifyHistoryPlaceImageUrl(url, options = {}) {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const trusted = isTrustedImageSource(url);

  if (!url?.trim()) {
    return {
      status: IMAGE_VERIFICATION_STATUS.FAILED,
      httpStatus: 0,
      attempts: 0,
      error: "missing_url",
    };
  }

  let lastStatus = 0;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url.trim(), {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": USER_AGENT },
      });
      lastStatus = res.status;
      const classified = classifyHttpStatus(res.status);

      if (classified === IMAGE_VERIFICATION_STATUS.VERIFIED) {
        return { status: classified, httpStatus: res.status, attempts: attempt };
      }

      if (classified === IMAGE_VERIFICATION_STATUS.FAILED) {
        return { status: classified, httpStatus: res.status, attempts: attempt };
      }

      // Rate limit or transient — retry if trusted and attempts remain
      if (
        trusted &&
        attempt < maxAttempts &&
        (res.status === 429 || TRANSIENT_HTTP.has(res.status))
      ) {
        await sleep(BACKOFF_MS[attempt - 1] ?? 5000);
        continue;
      }

      // Out of retries
      if (res.status === 429) {
        return {
          status: IMAGE_VERIFICATION_STATUS.PENDING_RATE_LIMIT,
          httpStatus: res.status,
          attempts: attempt,
        };
      }

      return {
        status:
          classified === IMAGE_VERIFICATION_STATUS.PENDING_RATE_LIMIT
            ? IMAGE_VERIFICATION_STATUS.PENDING_RATE_LIMIT
            : IMAGE_VERIFICATION_STATUS.PENDING_TRANSIENT,
        httpStatus: res.status,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastStatus = 0;
      if (trusted && attempt < maxAttempts) {
        await sleep(BACKOFF_MS[attempt - 1] ?? 5000);
        continue;
      }
      return {
        status: IMAGE_VERIFICATION_STATUS.PENDING_TRANSIENT,
        httpStatus: 0,
        attempts: attempt,
        error: lastError,
      };
    }
  }

  if (lastStatus === 429) {
    return {
      status: IMAGE_VERIFICATION_STATUS.PENDING_RATE_LIMIT,
      httpStatus: lastStatus,
      attempts: maxAttempts,
    };
  }

  return {
    status:
      lastStatus === 0
        ? IMAGE_VERIFICATION_STATUS.PENDING_TRANSIENT
        : classifyHttpStatus(lastStatus),
    httpStatus: lastStatus,
    attempts: maxAttempts,
    error: lastError ?? undefined,
  };
}

/** Find duplicate image URLs across library rows. */
export function findDuplicateImageUrls(rows) {
  const byUrl = new Map();
  const duplicates = [];

  for (const row of rows) {
    const url = imageUrlForRow(row);
    if (!url) continue;
    const normalized = url.trim().toLowerCase();
    const existing = byUrl.get(normalized) ?? [];
    existing.push({ id: row.id, slug: row.slug, metro_key: row.metro_key });
    byUrl.set(normalized, existing);
  }

  for (const [url, places] of byUrl.entries()) {
    if (places.length > 1) {
      duplicates.push({ url, places });
    }
  }

  return duplicates;
}

export async function verifyHistoryPlaceImages(rows, options = {}) {
  const results = [];
  for (const row of rows) {
    const url = imageUrlForRow(row);
    const result = await verifyHistoryPlaceImageUrl(url, options);
    results.push({
      id: row.id,
      slug: row.slug,
      metro_key: row.metro_key,
      place_name: row.place_name,
      url,
      ...result,
    });
    // Gentle pacing for Wikimedia batch checks
    if (isTrustedImageSource(url)) {
      await sleep(options.interRequestDelayMs ?? 300);
    }
  }
  return results;
}

export function summarizeImageVerification(results) {
  const summary = {
    verified: [],
    verification_pending_rate_limit: [],
    verification_pending_transient: [],
    failed: [],
    missing_url: [],
  };

  for (const r of results) {
    if (!r.url) {
      summary.missing_url.push(r);
      continue;
    }
    switch (r.status) {
      case IMAGE_VERIFICATION_STATUS.VERIFIED:
        summary.verified.push(r);
        break;
      case IMAGE_VERIFICATION_STATUS.PENDING_RATE_LIMIT:
        summary.verification_pending_rate_limit.push(r);
        break;
      case IMAGE_VERIFICATION_STATUS.PENDING_TRANSIENT:
        summary.verification_pending_transient.push(r);
        break;
      default:
        summary.failed.push(r);
    }
  }

  return summary;
}
