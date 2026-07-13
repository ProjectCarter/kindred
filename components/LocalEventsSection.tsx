import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Linking,
  type ColorValue,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import type { SFSymbol } from "expo-symbols";
import {
  parseLocalEventsBody,
  type LocalEventCard,
} from "../lib/edition/localEvents";
import { paper } from "../lib/edition/newspaperTheme";

type Props = {
  headline: string;
  body: string;
  sourceNote?: string | null;
};

type NewspaperColors = {
  ink: string;
  inkBody: string;
  inkMuted: string;
  inkFaint: string;
  terracotta: string;
  rule: string;
};

function useNewspaperColors(): NewspaperColors {
  return {
    ink: paper.ink,
    inkBody: paper.inkBody,
    inkMuted: paper.inkMuted,
    inkFaint: paper.inkFaint,
    terracotta: paper.terracotta,
    rule: paper.border,
  };
}

function openMaps(event: LocalEventCard) {
  const query = [event.venue, event.city].filter(Boolean).join(", ");
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  void Linking.openURL(url).catch(() => {
    /* Ignore — device may have no browser/handler. */
  });
}

function openEvent(event: LocalEventCard) {
  if (event.sourceUrl) {
    void Linking.openURL(event.sourceUrl).catch(() => {
      /* Ignore broken / blocked URLs. */
    });
  }
}

function MetaIcon({
  symbol,
  ion,
  color,
}: {
  symbol: SFSymbol;
  ion: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
}) {
  return (
    <SymbolView
      name={symbol}
      size={12}
      weight="regular"
      tintColor={color}
      style={styles.metaIcon}
      accessibilityElementsHidden
      importantForAccessibility="no"
      fallback={<Ionicons name={ion} size={12} color={color} />}
    />
  );
}

function MetaRow({
  symbol,
  ion,
  children,
  colors,
}: {
  symbol: SFSymbol;
  ion: keyof typeof Ionicons.glyphMap;
  children: string;
  colors: NewspaperColors;
}) {
  if (!children) return null;
  return (
    <View
      style={styles.metaRow}
      accessible
      accessibilityRole="text"
      accessibilityLabel={children}
    >
      <MetaIcon symbol={symbol} ion={ion} color={colors.inkMuted} />
      <Text
        style={[styles.metaText, { color: colors.inkMuted }]}
        maxFontSizeMultiplier={1.35}
        accessible={false}
      >
        {children}
      </Text>
    </View>
  );
}

function ActionLink({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress: () => void;
  colors: NewspaperColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionPressable,
        pressed && styles.actionPressed,
      ]}
    >
      <Text
        style={[styles.actionLink, { color: colors.terracotta }]}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function LocalEventsSection({ headline, body, sourceNote }: Props) {
  const events = parseLocalEventsBody(body);
  const colors = useNewspaperColors();

  if (!events) {
    return (
      <View>
        <Text style={[styles.headline, { color: colors.ink }]}>{headline}</Text>
        <Text style={[styles.legacyBody, { color: colors.inkBody }]}>
          {body}
        </Text>
        {sourceNote ? (
          <Text style={[styles.sourceNote, { color: colors.inkMuted }]}>
            {sourceNote}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Text
        style={[styles.headline, { color: colors.ink }]}
        maxFontSizeMultiplier={1.4}
      >
        {headline}
      </Text>

      {events.map((event, index) => {
        const venueLine = [event.venue, event.city].filter(Boolean).join(", ");
        const isLast = index === events.length - 1;

        return (
          <View
            key={`${event.name}-${event.date}-${index}`}
            style={[
              styles.eventBlock,
              { borderBottomColor: colors.rule },
              isLast && styles.eventBlockLast,
            ]}
            accessible={false}
          >
            <Pressable
              onPress={event.sourceUrl ? () => openEvent(event) : undefined}
              disabled={!event.sourceUrl}
              accessibilityRole={event.sourceUrl ? "link" : undefined}
              accessibilityLabel={
                event.sourceUrl
                  ? `Open event: ${event.name}`
                  : event.name
              }
              hitSlop={{ top: 6, bottom: 4, left: 2, right: 2 }}
              style={({ pressed }) => [
                styles.eventMain,
                event.sourceUrl && pressed && styles.actionPressed,
              ]}
            >
              <Text
                style={[styles.eventName, { color: colors.ink }]}
                maxFontSizeMultiplier={1.4}
              >
                {event.name}
              </Text>

              <View style={styles.metaBlock}>
                <MetaRow
                  symbol="calendar"
                  ion="calendar-outline"
                  colors={colors}
                >
                  {event.date}
                </MetaRow>
                <MetaRow symbol="clock" ion="time-outline" colors={colors}>
                  {event.time}
                </MetaRow>
                <View
                  style={styles.venueRow}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={venueLine}
                >
                  <View style={styles.venueIconWrap}>
                    <MetaIcon
                      symbol="location"
                      ion="location-outline"
                      color={colors.inkBody}
                    />
                  </View>
                  <Text
                    style={[styles.venueText, { color: colors.inkBody }]}
                    maxFontSizeMultiplier={1.35}
                    accessible={false}
                  >
                    {venueLine}
                  </Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.actions}>
              <ActionLink
                label="Directions"
                onPress={() => openMaps(event)}
                colors={colors}
              />
              {event.sourceUrl ? (
                <>
                  <Text
                    style={[styles.actionRule, { color: colors.inkFaint }]}
                    accessible={false}
                  >
                    ·
                  </Text>
                  <ActionLink
                    label="Details"
                    onPress={() => openEvent(event)}
                    colors={colors}
                  />
                </>
              ) : null}
            </View>
          </View>
        );
      })}

      {sourceNote ? (
        <Text style={[styles.sourceNote, { color: colors.inkMuted }]}>
          {sourceNote}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 19,
    fontWeight: "600",
    marginBottom: 22,
    fontFamily: "Georgia",
    lineHeight: 26,
  },
  legacyBody: {
    fontSize: 15,
    lineHeight: 23,
  },
  eventBlock: {
    paddingBottom: 26,
    marginBottom: 26,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventBlockLast: {
    borderBottomWidth: 0,
    marginBottom: 6,
    paddingBottom: 10,
  },
  eventMain: {
    marginBottom: 0,
  },
  eventName: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Georgia",
    marginBottom: 12,
    lineHeight: 26,
    letterSpacing: -0.1,
  },
  metaBlock: {
    gap: 6,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaIcon: {
    width: 12,
    height: 12,
  },
  metaText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.35,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 2,
  },
  venueIconWrap: {
    paddingTop: 4,
  },
  venueText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6,
  },
  actionPressable: {
    paddingVertical: 2,
  },
  actionPressed: {
    opacity: 0.45,
  },
  actionLink: {
    fontFamily: "Georgia",
    fontSize: 13,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  actionRule: {
    fontSize: 13,
    lineHeight: 16,
  },
  sourceNote: {
    fontFamily: "Georgia",
    fontSize: 12,
    marginTop: 14,
    fontStyle: "italic",
  },
});
