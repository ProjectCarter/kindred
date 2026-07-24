import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { kindredGold } from "../lib/edition/newspaperTheme";

/** Engraved into the paper, not printed on top — a soft antique presence. */
const FLOURISH_OPACITY = 0.18;

/** A wide, low engraved swash — ~18% smaller than before, sat closer in. */
const VIEW_W = 82;
const VIEW_H = 44;
const FLOURISH_WIDTH = 66;
const FLOURISH_HEIGHT = (VIEW_H * FLOURISH_WIDTH) / VIEW_W;
const CY = 22;

const gold = kindredGold.primary;

type Props = {
  /** Mirror for the left side of the nameplate. */
  mirrored?: boolean;
};

const stroke = {
  stroke: gold,
  fill: "none" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A spiral volute — the signature terminal of classical scrollwork. */
function volute(
  cx: number,
  cy: number,
  r0: number,
  a0: number,
  turns: number,
  shrink = 0.85,
  n = 48,
): string {
  const pts: string[] = [];
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    const ang = a0 + turns * 2 * Math.PI * f;
    const r = r0 * (1 - shrink * f);
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)} ${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${pts.join(" L")}`;
}

/** A single fine engraved leaf accent — outline only, sparingly used. */
function Leaf({
  x,
  y,
  rot,
  len,
  w,
}: {
  x: number;
  y: number;
  rot: number;
  len: number;
  w: number;
}) {
  return (
    <G transform={`translate(${x}, ${y}) rotate(${rot})`}>
      <Path
        d={`M0 0 C ${w} ${-len * 0.35} ${w} ${-len * 0.8} 0 ${-len} C ${-w} ${-len * 0.8} ${-w} ${-len * 0.35} 0 0 Z`}
        {...stroke}
        strokeWidth={0.5}
      />
    </G>
  );
}

const STEMS: { d: string; w: number }[] = [
  // Inner volute that quietly cradles the wordmark.
  { d: volute(11, CY, 4.2, rad(135), 1.1, 0.8), w: 0.7 },
  // Main engraved sweep flowing outward.
  { d: "M13 21 C 26 18 38 20 50 15 C 58 12 63 13 66 17", w: 0.85 },
  // Outer volute terminal.
  { d: volute(66, 21, 5, rad(-95), 1.15, 0.85), w: 0.85 },
  // Companion hairline beneath the sweep — double-line engraving.
  { d: "M14 24 C 26 24 36 27 46 24", w: 0.5 },
  // Fine upper tendril.
  { d: "M50 15 C 54 10 60 9 64 12", w: 0.45 },
];

const LEAVES = [
  { x: 40, y: 18, rot: 58, len: 7, w: 2 },
  { x: 30, y: 20.5, rot: 120, len: 6.5, w: 1.9 },
];

const BUDS = [
  { cx: 66, cy: 21, r: 1.6 },
  { cx: 55, cy: 12, r: 1.2 },
];

/**
 * Original engraved ornamental swash — sweeping calligraphic curves with
 * volute terminals and a few subtle botanical accents. Inspired by antique
 * bookplates and museum-catalog engraving, refined rather than floral.
 * Right-side by default; mirrored for the left so the pair frames the wordmark
 * as a single symmetrical composition.
 */
function ScrollworkOrnament() {
  return (
    <G>
      {STEMS.map((s, i) => (
        <Path key={i} d={s.d} {...stroke} strokeWidth={s.w} />
      ))}
      {LEAVES.map((l, i) => (
        <Leaf key={i} {...l} />
      ))}
      {BUDS.map((b, i) => (
        <Circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={gold} />
      ))}
    </G>
  );
}

export function KindredNameplateFlourish({ mirrored = false }: Props) {
  return (
    <View
      style={[styles.slot, mirrored && styles.mirrored]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Svg
        width={FLOURISH_WIDTH}
        height={FLOURISH_HEIGHT}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        opacity={FLOURISH_OPACITY}
      >
        <ScrollworkOrnament />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: FLOURISH_WIDTH,
    height: FLOURISH_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
});
