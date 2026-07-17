/** Guards loadEdition during an in-flight dev generate — extracted for tests. */
export function shouldDeferLoadEditionDuringGenerate(input: {
  pendingDevGenerate: boolean;
  generating: boolean;
  eventsOnly: boolean;
  afterGenerate: boolean;
}): boolean {
  return (
    (input.pendingDevGenerate || input.generating) &&
    !input.eventsOnly &&
    !input.afterGenerate
  );
}
