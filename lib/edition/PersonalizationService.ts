/**
 * Client mirror of the personalization engine contract.
 * Ranking runs on the Edge; every future section should record signals
 * through trackReadingSignal / openKindredArticle / ArticleReader.
 */

export {
  trackReadingSignal,
  inferTopicFromSection,
  useArticleReadingSession,
} from "../personalization";

export type {
  ReadingSignalInput,
  ReadingSignalType,
  PersonalizationSnapshot,
} from "../personalization";

import { trackReadingSignal } from "../personalization";

export const PersonalizationService = {
  trackReadingSignal,
};

export default PersonalizationService;
