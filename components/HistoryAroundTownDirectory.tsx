import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import type { HistoryDirectoryCard } from "../lib/edition/historyAroundTown/cards";

const BATCH_SIZE = 24;

type Props = {
  cards: HistoryDirectoryCard[];
  onOpenCard: (card: HistoryDirectoryCard) => void;
  emptyCopy?: string;
};

/** Full History Around Town directory — lazy batches for large metros. */
export function HistoryAroundTownDirectory({
  cards,
  onOpenCard,
  emptyCopy = "No historic places are ready for this city yet — check back as the library grows.",
}: Props) {
  if (!cards.length) {
    return (
      <Text style={styles.empty} maxFontSizeMultiplier={1.15}>
        {emptyCopy}
      </Text>
    );
  }

  return (
    <FlatList
      data={cards}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      initialNumToRender={Math.min(BATCH_SIZE, cards.length)}
      maxToRenderPerBatch={BATCH_SIZE}
      windowSize={5}
      removeClippedSubviews
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <DirectoryCard card={item} onPress={() => onOpenCard(item)} />
      )}
    />
  );
}

function DirectoryCard({
  card,
  onPress,
}: {
  card: HistoryDirectoryCard;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[card.overline, card.title, card.note]
        .filter(Boolean)
        .join(". ")}
      style={({ pressed }) => [styles.card, pressed && { opacity: press.opacity }]}
    >
      {card.imageUrl ? (
        <Image
          source={{ uri: card.imageUrl }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel={card.title}
        />
      ) : (
        <View style={styles.photoFallback} />
      )}
      <View style={styles.copy}>
        {card.overline ? (
          <Text style={styles.overline} maxFontSizeMultiplier={1.1}>
            {card.overline}
          </Text>
        ) : null}
        <Text style={styles.title} maxFontSizeMultiplier={1.15}>
          {card.title}
        </Text>
        {card.subtitle ? (
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.12}>
            {card.subtitle}
          </Text>
        ) : null}
        {card.historicalMetadataLine ? (
          <Text style={styles.metadata} maxFontSizeMultiplier={1.12}>
            {card.historicalMetadataLine}
          </Text>
        ) : null}
        {card.note ? (
          <Text style={styles.note} numberOfLines={3} maxFontSizeMultiplier={1.15}>
            {card.note}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkMuted,
    fontStyle: "italic",
  },
  separator: {
    height: 20,
  },
  card: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: paper.creamWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    borderRadius: 10,
    overflow: "hidden",
    padding: 12,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 6,
    backgroundColor: paper.creamDeep,
  },
  photoFallback: {
    width: 96,
    height: 96,
    borderRadius: 6,
    backgroundColor: paper.creamDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
  },
  copy: {
    flex: 1,
    paddingVertical: 2,
  },
  overline: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 6,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600",
    color: paper.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    color: paper.inkMuted,
    marginBottom: 4,
  },
  metadata: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    color: paper.terracottaSoft,
    marginBottom: 6,
  },
  note: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    color: paper.inkBody,
  },
});
