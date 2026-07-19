/**
 * Article handoff integrity — homepage card and reader must share one object.
 */

/** Minimum fields required to verify card → reader integrity. */
export type ArticleHandoffSnapshot = {
  id: string;
  headline: string;
  section: string;
};

/** Desks that carry verified wire/editorial news — never mood-based hero substitutes. */
const WIRE_NEWS_SECTIONS = new Set([
  "lead",
  "top_stories",
  "local_news",
  "science",
  "business",
  "health",
  "culture",
  "technology",
  "sports",
]);

export type ArticleIntegrityFailure = {
  code: "id_mismatch" | "headline_mismatch" | "gold_standard_leak";
  message: string;
  expectedId: string;
  actualId: string;
};

export function isWireNewsSection(section: string): boolean {
  return WIRE_NEWS_SECTIONS.has(section);
}

/**
 * Verify the article about to open still matches what the card handed off.
 */
export function validateArticleHandoff(input: {
  expected: ArticleHandoffSnapshot;
  opened: ArticleHandoffSnapshot;
}): ArticleIntegrityFailure | null {
  const expectedId = input.expected.id.trim();
  const actualId = input.opened.id.trim();

  if (!expectedId || !actualId || expectedId !== actualId) {
    return {
      code: "id_mismatch",
      message: "Article id changed between card tap and reader open.",
      expectedId,
      actualId,
    };
  }

  const expectedHeadline = input.expected.headline.trim();
  const actualHeadline = input.opened.headline.trim();
  if (expectedHeadline !== actualHeadline) {
    return {
      code: "headline_mismatch",
      message: "Article headline changed between card tap and reader open.",
      expectedId,
      actualId,
    };
  }

  if (
    input.opened.section === "science" &&
    input.expected.section !== "science" &&
    actualHeadline.toLowerCase().includes("south australia")
  ) {
    return {
      code: "gold_standard_leak",
      message: "Gold-standard science content leaked into a non-demo article id.",
      expectedId,
      actualId,
    };
  }

  return null;
}

/** Route id must match the stashed article before rendering the reader. */
export function articleMatchesRouteId(
  routeArticleId: string,
  article: Pick<ArticleHandoffSnapshot, "id" | "headline">
): boolean {
  const routeId = routeArticleId.trim();
  const articleId = article.id.trim();
  if (!routeId || !articleId || routeId !== articleId) {
    console.error("[article:integrity] route id mismatch", {
      routeArticleId: routeId,
      articleId,
      headline: article.headline.slice(0, 120),
    });
    return false;
  }
  return true;
}

export function logArticleIntegrityFailure(
  failure: ArticleIntegrityFailure,
  context?: Record<string, unknown>
): void {
  console.error("[article:integrity]", failure.code, failure.message, {
    ...failure,
    ...context,
  });
}
