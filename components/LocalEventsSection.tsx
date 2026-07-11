import { Text, View, Pressable, StyleSheet, Linking } from "react-native";
import {
  parseLocalEventsBody,
  type LocalEventCard,
} from "../lib/edition/localEvents";

type Props = {
  headline: string;
  body: string;
  sourceNote?: string | null;
};

function openMaps(event: LocalEventCard) {
  const query = [event.venue, event.city].filter(Boolean).join(", ");
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  Linking.openURL(url);
}

function openEvent(event: LocalEventCard) {
  if (event.sourceUrl) {
    Linking.openURL(event.sourceUrl);
  }
}

export function LocalEventsSection({ headline, body, sourceNote }: Props) {
  const events = parseLocalEventsBody(body);

  // Legacy paragraph editions fall back to plain text.
  if (!events) {
    return (
      <View>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.legacyBody}>{body}</Text>
        {sourceNote ? <Text style={styles.sourceNote}>{sourceNote}</Text> : null}
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.headline}>{headline}</Text>
      {events.map((event, index) => (
        <View
          key={`${event.name}-${event.date}-${index}`}
          style={[
            styles.eventBlock,
            index === events.length - 1 && styles.eventBlockLast,
          ]}
        >
          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.eventMeta}>
            {event.date}
            {event.time ? `  ·  ${event.time}` : ""}
          </Text>
          <Text style={styles.eventVenue}>
            {event.venue}
            {event.city ? `, ${event.city}` : ""}
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={() => openMaps(event)} hitSlop={8}>
              <Text style={styles.actionLink}>Open in Maps</Text>
            </Pressable>
            {event.sourceUrl ? (
              <>
                <Text style={styles.actionRule}>|</Text>
                <Pressable onPress={() => openEvent(event)} hitSlop={8}>
                  <Text style={styles.actionLink}>View Event</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      ))}
      {sourceNote ? <Text style={styles.sourceNote}>{sourceNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 19,
    fontWeight: "600",
    color: "#2B2620",
    marginBottom: 18,
    fontFamily: "Georgia",
  },
  legacyBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#2B2620DD",
  },
  eventBlock: {
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#2B262012",
  },
  eventBlockLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
    paddingBottom: 8,
  },
  eventName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#2B2620",
    fontFamily: "Georgia",
    marginBottom: 6,
    lineHeight: 24,
  },
  eventMeta: {
    fontSize: 13,
    letterSpacing: 0.3,
    color: "#2B262099",
    marginBottom: 4,
  },
  eventVenue: {
    fontSize: 14,
    lineHeight: 20,
    color: "#2B2620CC",
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionLink: {
    fontSize: 13,
    color: "#C1622D",
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  actionRule: {
    fontSize: 13,
    color: "#2B262033",
  },
  sourceNote: {
    fontSize: 12,
    color: "#2B262066",
    marginTop: 12,
    fontStyle: "italic",
  },
});
