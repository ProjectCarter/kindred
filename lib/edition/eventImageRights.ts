/**
 * Client-side event image rights — mirrors server sourceRights policy.
 * Conservative: never display listing photography without explicit authorization.
 */

export type EventImageReusePolicy =
  | "prohibited"
  | "unverified"
  | "api_granted"
  | "partner_granted";

export type EventImageRights = {
  authorized: boolean;
  policy: EventImageReusePolicy;
  sourceId: string;
};

const VALID_POLICIES = new Set<EventImageReusePolicy>([
  "prohibited",
  "unverified",
  "api_granted",
  "partner_granted",
]);

export function parseEventImageRights(
  value: unknown,
  sourceId?: string | null
): EventImageRights {
  if (value && typeof value === "object") {
    const row = value as Partial<EventImageRights>;
    const policy =
      typeof row.policy === "string" && VALID_POLICIES.has(row.policy as EventImageReusePolicy)
        ? (row.policy as EventImageReusePolicy)
        : "unverified";
    const authorized = row.authorized === true && (policy === "api_granted" || policy === "partner_granted");
    return {
      authorized,
      policy,
      sourceId:
        typeof row.sourceId === "string" && row.sourceId.trim()
          ? row.sourceId.trim()
          : sourceId?.trim() || "unknown",
    };
  }

  return {
    authorized: false,
    policy: "unverified",
    sourceId: sourceId?.trim() || "unknown",
  };
}

/** Display-safe listing photo — null unless explicitly authorized. */
export function authorizedEventImageUrl(input: {
  imageUrl?: string | null;
  imageRights?: EventImageRights | null;
}): string | null {
  const url = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
  if (!url || !/^https?:\/\//i.test(url)) return null;
  if (!input.imageRights?.authorized) return null;
  return url;
}
