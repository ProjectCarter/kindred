import { Text, StyleSheet, type TextProps, type TextStyle } from "react-native";
import { editorialTitleWithIcon } from "../lib/edition/categoryIcon";

type Props = TextProps & {
  icon?: string | null;
  title: string;
  style?: TextStyle;
};

/** Category icon + title — one emoji immediately before the headline. */
export function EditorialTitle({
  icon,
  title,
  style,
  maxFontSizeMultiplier = 1.15,
  ...rest
}: Props) {
  return (
    <Text
      style={[styles.title, style]}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
    >
      {editorialTitleWithIcon(icon, title)}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {},
});
