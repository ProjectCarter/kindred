/**
 * Which edition the reader is browsing — used when See All screens open
 * detail pages without carrying editionId through router params.
 */
let activeEditionId: string | null = null;

export function setActiveEditionId(editionId: string | null): void {
  activeEditionId = editionId?.trim() || null;
}

export function getActiveEditionId(): string | null {
  return activeEditionId;
}
