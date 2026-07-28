import { MastheadLink } from "./KindredMasthead";

type Props = {
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

/**
 * Consistent upper-left back control for detail and list screens.
 * Matches the article reader / masthead link styling.
 */
export function KindredDetailBackButton({
  label = "← Back to Homepage",
  onPress,
  accessibilityLabel,
}: Props) {
  return (
    <MastheadLink
      label={label}
      onPress={onPress}
      accessibilityLabel={
        accessibilityLabel ?? label.replace(/^←\s*/, "Back to ")
      }
    />
  );
}
