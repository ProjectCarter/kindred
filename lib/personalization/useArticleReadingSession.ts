import { useEffect, useRef } from "react";
import type { KindredArticle } from "../edition/article";
import { inferTopicFromSection, trackReadingSignal } from "./trackSignal";

type SessionOptions = {
  editionId?: string | null;
};

/**
 * Quiet reading-session tracker for the shared ArticleReader.
 * Records dwell, progress, completion, and soft skips.
 */
export function useArticleReadingSession(
  article: KindredArticle,
  progress: number,
  options: SessionOptions = {}
): void {
  const startedAt = useRef(Date.now());
  const maxProgress = useRef(0);
  const articleRef = useRef(article);
  const editionId = options.editionId ?? null;

  useEffect(() => {
    articleRef.current = article;
  }, [article]);

  useEffect(() => {
    maxProgress.current = Math.max(maxProgress.current, progress);
  }, [progress]);

  useEffect(() => {
    startedAt.current = Date.now();
    maxProgress.current = 0;

    return () => {
      const current = articleRef.current;
      const dwellMs = Date.now() - startedAt.current;
      const scrollPct = Math.round(maxProgress.current * 100);
      const topic = inferTopicFromSection(current.section, current.headline);

      void trackReadingSignal({
        signalType: "read_progress",
        storyKey: current.id,
        sectionType: current.section,
        editionId,
        source: current.source,
        topic,
        payload: {
          dwell_ms: dwellMs,
          scroll_pct: scrollPct,
          headline: current.headline.slice(0, 160),
        },
      });

      if (scrollPct >= 85 && dwellMs >= 20_000) {
        void trackReadingSignal({
          signalType: "read_complete",
          storyKey: current.id,
          sectionType: current.section,
          editionId,
          source: current.source,
          topic,
          payload: { dwell_ms: dwellMs, scroll_pct: scrollPct },
        });
      } else if (dwellMs < 8_000 && scrollPct < 20) {
        // Soft skip — opened then left quickly without reading.
        void trackReadingSignal({
          signalType: "skip",
          storyKey: current.id,
          sectionType: current.section,
          editionId,
          source: current.source,
          topic,
          payload: { dwell_ms: dwellMs, scroll_pct: scrollPct },
        });
      }

      if (current.source && (scrollPct >= 40 || dwellMs >= 25_000)) {
        void trackReadingSignal({
          signalType: "source_engage",
          storyKey: current.id,
          sectionType: current.section,
          editionId,
          source: current.source,
          topic,
          payload: { dwell_ms: dwellMs, scroll_pct: scrollPct },
        });
      }
    };
  }, [article.id, editionId]);
}
