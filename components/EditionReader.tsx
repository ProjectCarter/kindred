import { Text, View, Pressable, StyleSheet } from "react-native";
import {
  SECTION_LABELS,
  type EditionSection,
} from "../lib/edition/types";
import { LocalEventsSection } from "./LocalEventsSection";

type Props = {
  sections: EditionSection[];
  clippedSectionIds?: Set<string>;
  onToggleClip?: (section: EditionSection) => void;
  clipPendingId?: string | null;
  endText?: string;
};

export function EditionReader({
  sections,
  clippedSectionIds,
  onToggleClip,
  clipPendingId,
  endText = "That's your edition for today.",
}: Props) {
  const greeting = sections.find((s) => s.section_type === "greeting");
  const otherSections = sections.filter((s) => s.section_type !== "greeting");

  return (
    <View>
      <Text style={styles.greeting}>
        {greeting?.headline || "Good morning."}
      </Text>
      {greeting?.body ? (
        <Text style={styles.greetingBody}>{greeting.body}</Text>
      ) : null}

      {otherSections.map((section) => {
        const clipped = clippedSectionIds?.has(section.id) ?? false;
        const pending = clipPendingId === section.id;

        return (
          <View key={section.id} style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>
              {SECTION_LABELS[section.section_type] ?? section.section_type}
            </Text>

            {section.section_type === "local_events" ? (
              <LocalEventsSection
                headline={section.headline}
                body={section.body}
                sourceNote={section.source_note}
              />
            ) : (
              <>
                <Text style={styles.sectionHeadline}>{section.headline}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
                {section.source_note && (
                  <Text style={styles.sourceNote}>{section.source_note}</Text>
                )}
              </>
            )}

            {onToggleClip ? (
              <Pressable
                style={styles.clipButton}
                onPress={() => onToggleClip(section)}
                disabled={pending}
              >
                <Text style={styles.clipButtonText}>
                  {pending ? "Saving…" : clipped ? "Saved" : "Save clipping"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <View style={styles.endMarker}>
        <Text style={styles.endText}>{endText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: {
    fontSize: 28,
    fontWeight: "600",
    color: "#2B2620",
    marginBottom: 8,
    fontFamily: "Georgia",
  },
  greetingBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#2B2620CC",
    marginBottom: 32,
  },
  sectionCard: {
    marginBottom: 28,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#2B26201A",
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#C1622D",
    marginBottom: 8,
    fontWeight: "600",
  },
  sectionHeadline: {
    fontSize: 19,
    fontWeight: "600",
    color: "#2B2620",
    marginBottom: 6,
    fontFamily: "Georgia",
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#2B2620DD",
  },
  sourceNote: {
    fontSize: 12,
    color: "#2B262066",
    marginTop: 8,
    fontStyle: "italic",
  },
  clipButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#2B262033",
    borderRadius: 8,
  },
  clipButtonText: {
    fontSize: 13,
    color: "#2B2620",
    fontWeight: "500",
  },
  endMarker: {
    alignItems: "center",
    paddingVertical: 32,
  },
  endText: {
    fontSize: 14,
    color: "#2B262066",
    fontStyle: "italic",
  },
});
