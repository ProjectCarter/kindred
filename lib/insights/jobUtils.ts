import { getEnv } from "@/lib/env";

export function getStaleProcessingBefore(): string {
  const { INSIGHT_PROCESSING_STALE_MS } = getEnv();
  return new Date(Date.now() - INSIGHT_PROCESSING_STALE_MS).toISOString();
}

export function isProcessingStale(updatedAt: string | undefined): boolean {
  if (!updatedAt) {
    return true;
  }

  const { INSIGHT_PROCESSING_STALE_MS } = getEnv();
  return Date.now() - new Date(updatedAt).getTime() >= INSIGHT_PROCESSING_STALE_MS;
}
