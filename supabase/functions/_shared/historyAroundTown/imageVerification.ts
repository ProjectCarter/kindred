/**
 * History Around Town — HTTP image verification (server mirror).
 * Keep in sync with scripts/lib/historyPlaceImageVerification.mjs
 */

export const IMAGE_VERIFICATION_STATUS = {
  VERIFIED: "verified",
  PENDING_RATE_LIMIT: "verification_pending_rate_limit",
  PENDING_TRANSIENT: "verification_pending_transient",
  FAILED: "failed",
  PENDING: "pending",
} as const;

export type ImageVerificationStatus =
  (typeof IMAGE_VERIFICATION_STATUS)[keyof typeof IMAGE_VERIFICATION_STATUS];

export type HistoryPlaceImageVerificationResult = {
  status: ImageVerificationStatus;
  httpStatus: number;
  attempts: number;
  error?: string;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function imageUrlForRow(row: {
  hosted_url?: string | null;
  image_url?: string | null;
}): string | null {
  return row.hosted_url?.trim() || row.image_url?.trim() || null;
}

export function isTrustedImageSource(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return TRUSTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function classifyHttpStatus(status: number): ImageVerificationStatus {
  if (status >= 200 && status < 400) return IMAGE_VERIFICATION_STATUS.VERIFIED;
  if (FAILED_HTTP.has(status)) return IMAGE_VERIFICATION_STATUS.FAILED;
  if (status === 429) return IMAGE_VERIFICATION_STATUS.PENDING_RATE_LIMIT;
  if (TRANSIENT_HTTP.has(status) || status === 0) {
    return IMAGE_VERIFICATION_STATUS.PENDING_TRANSIENT;
  }
  if (status >= 400) return IMAGE_VERIFICATION_STATUS.FAILED;
  return IMAGE_VERIFICATION_STATUS.PENDING_TRANSIENT;
}

export async function verifyHistoryPlaceImageUrl(
  url: string | null | undefined,
  options?: { maxAttempts?: number }
): Promise<HistoryPlaceImageVerificationResult> {
  const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
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
  let lastError: string | undefined;

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

      if (
        trusted &&
        attempt < maxAttempts &&
        (res.status === 429 || TRANSIENT_HTTP.has(res.status))
      ) {
        await sleep(BACKOFF_MS[attempt - 1] ?? 5000);
        continue;
      }

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
    error: lastError,
  };
}
