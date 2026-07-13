/**
 * Kindred Universal Content System — types.
 *
 * Every piece of content resolves to a purpose-built editorial template.
 * Templates share Kindred typography and reader chrome; they differ in
 * the questions they answer and the rhythm of the desk notes.
 *
 * Story first. Useful information second — as magazine sections, never a database.
 */

/** Canonical content types Kindred can publish. */
export type ContentType =
  | "news"
  | "local_news"
  | "science"
  | "history"
  | "local_event"
  | "festival"
  | "restaurant"
  | "coffee"
  | "bakery"
  | "hiking"
  | "park"
  | "beach"
  | "museum"
  | "attraction"
  | "hidden_gem"
  | "recommendation"
  | "travel";

/** One editorial desk note — prose answering a reader question. */
export type EditorialModule = {
  /** Stable field id from the template (e.g. atmosphere, difficulty). */
  id: string;
  /** Small uppercase magazine label. */
  label: string;
  /** Hand-edited prose — never a key/value dump. */
  body: string;
};

/** Spec for a field a template may include. */
export type EditorialFieldSpec = {
  id: string;
  /** Reader-facing section label. */
  label: string;
  /** What this section answers — for editors and future generation. */
  answers: string;
  /** When false, omit rather than force empty filler. */
  required?: boolean;
};

/** Purpose-built editorial template. */
export type ContentTemplate = {
  type: ContentType;
  /** Folio / reader category label. */
  categoryLabel: string;
  /** One-line desk personality. */
  personality: string;
  /**
   * Suggested story beats before desk notes.
   * Editors write the narrative; this is guidance, not UI.
   */
  storyBeats: string[];
  /** Practical / curiosity fields rendered as magazine modules. */
  fields: EditorialFieldSpec[];
};

/** Partial answers keyed by field id — filled by adapters, editors, or engines. */
export type EditorialFieldAnswers = Partial<Record<string, string | null>>;
