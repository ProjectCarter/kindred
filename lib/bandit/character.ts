/**
 * BANDIT — official character system.
 *
 * Bandit is not a mascot. He is the face of Kindred: the loyal newspaper dog
 * who personally delivers every user's morning edition.
 *
 * Bandit v1.0 is approved and locked. Canonical source of truth:
 * `assets/bandit/v1/bandit-v1-master-reference.png`, matched to the real
 * Kindred app icon. Every pose in `BANDIT_ASSETS` depicts the exact same
 * dog — identical face, colors, proportions, line work, and personality.
 * The only thing that changes between poses is the pose itself.
 * Consistency over creativity. Do not redesign or reinterpret him.
 *
 * See also: `.cursor/rules/kindred-bandit-character.mdc`.
 */
import type { ImageSourcePropType } from "react-native";

/** Bandit's permanent brand palette (v1.0). Never substitute other colors. */
export const BANDIT_COLORS = {
  /** Warm white coat and face. */
  coat: "#F8F8F6",
  /** Kindred golden-brown eye patch (over his right eye only). */
  patch: "#B7772E",
  /** Kindred gold bandana. */
  bandana: "#D8A63A",
  /** Dark chocolate-brown ears and nose. */
  earsAndNose: "#4A3326",
  /** Warm rich brown eyes. */
  eyes: "#5A3E2B",
  /** Rolled newspaper — warm cream paper. */
  newspaper: "#F3E8CF",
  /** All line work / outline — dark navy. */
  outline: "#1C2746",
} as const;

/**
 * Fixed markings — never alter these when generating or describing Bandit.
 * Keep this list in sync with the workspace rule.
 *
 * Orientation rule: in every side/three-quarter pose, Bandit faces
 * screen-RIGHT (matching the official app icon), so the near/visible cheek
 * is correctly his right eye. Never draw him facing screen-left in profile.
 */
export const BANDIT_MARKINGS = [
  "Warm white coat and face",
  "Two dark chocolate-brown floppy ears",
  "One warm golden-brown patch over his RIGHT eye only — large and soft-rounded, covering roughly one-third of the visible side of his face; his single most defining feature, matched to the official Kindred app icon",
  "Warm rich brown eyes, small relative to his head",
  "Dark chocolate-brown nose, same color as his ears",
  "Kindred gold bandana around his neck",
  "Rolled newspaper (warm cream paper), often carried in his mouth",
] as const;

/**
 * Build — Bandit is a mature adult dog (roughly 3-5 years old), never a
 * puppy: adult Jack Russell proportions, confident grounded stance.
 */
export const BANDIT_BUILD =
  "Mature adult dog (~3-5 years), adult Jack Russell proportions: longer muzzle, broader chest, stronger shoulders, longer legs, confident grounded stance" as const;

/** Traits Bandit should always read as. */
export const BANDIT_PERSONALITY_ON = [
  "calm",
  "friendly",
  "dependable",
  "intelligent",
  "gentle",
  "trustworthy",
  "warm",
] as const;

/** Traits Bandit must never read as. */
export const BANDIT_PERSONALITY_OFF = [
  "hyper",
  "silly",
  "loud",
  "chaotic",
  "goofy",
  "overly cartoonish",
  "like a guard dog",
] as const;

/** Hard behavioral rules — always on all four paws, never anthropomorphic. */
export const BANDIT_RULES = [
  "Always on all four paws — a real dog, never standing upright like a human",
  "Never anthropomorphic — no human hands, no human posture",
  "Never dressed in clothing beyond his signature bandana",
  "Never a change to his markings or color palette",
  "Never facing screen-left in profile — always screen-right, per the app icon",
] as const;

/**
 * Bandit's official Core Pose Library v1. Add new poses here only after
 * generating a matching asset with strong reference-image grounding (the
 * app icon + `bandit-v1-master-reference.png`) — never invent a pose ad hoc
 * inside a screen component.
 */
export type BanditPose =
  | "reference" // v1.0 canonical master reference (3/4, carrying newspaper, gentle smile)
  | "standing-neutral" // general use throughout the app
  | "walking-newspaper" // signature pose — morning greeting, loading, splash, daily edition
  | "sitting" // empty states, saved articles, Bandit's Picks, tips
  | "head-portrait" // notifications, speech bubbles, Bandit's messages, profile icon
  | "standing-no-newspaper"; // general illustrations, future UI flexibility

/**
 * Asset registry — the only place screens should resolve a Bandit pose to an
 * image. Keeps every surface in the app pointing at the same v1.0 source.
 */
export const BANDIT_ASSETS: Record<BanditPose, ImageSourcePropType> = {
  reference: require("../../assets/bandit/v1/bandit-v1-master-reference.png"),
  "standing-neutral": require("../../assets/bandit/v1/bandit-v1-standing-neutral.png"),
  "walking-newspaper": require("../../assets/bandit/v1/bandit-v1-walking-newspaper.png"),
  sitting: require("../../assets/bandit/v1/bandit-v1-sitting.png"),
  "head-portrait": require("../../assets/bandit/v1/bandit-v1-head-portrait.png"),
  "standing-no-newspaper": require("../../assets/bandit/v1/bandit-v1-standing-no-newspaper.png"),
};

/** Bandit's signature pose — the primary illustration used throughout Kindred. */
export const BANDIT_SIGNATURE_POSE: BanditPose = "walking-newspaper";

/**
 * The official Bandit v1.0 pose library reference sheet — ten approved poses
 * (walking-with-newspaper, standing, sitting, lying down, head portrait,
 * waving, looking up, holding a recommendation card, sleeping, reading the
 * newspaper) on one page. For design review / future asset generation
 * grounding; individual production `BANDIT_ASSETS` above are separate clean
 * renders, since a single grid image can't be sliced into in-app assets.
 */
export const BANDIT_POSE_LIBRARY_SHEET: ImageSourcePropType = require("../../assets/bandit/v1/bandit-v1-pose-library-full.png");
