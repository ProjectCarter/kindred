import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { paper, press } from "../lib/edition/newspaperTheme";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Catches render failures so a single bad edition payload cannot white-screen
 * the session. Recovery copy stays calm and on-brand — no stack traces.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error("[AppErrorBoundary]", error.message, info.componentStack);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.screen}>
          <View style={styles.column} accessibilityRole="summary">
            <Text style={styles.kicker}>Kindred</Text>
            <Text style={styles.title}>The page couldn’t be set.</Text>
            <Text style={styles.body}>
              Something interrupted this screen. You can try again — your paper
              is still waiting.
            </Text>
            <Pressable
              onPress={this.handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              style={({ pressed }) => [
                styles.action,
                pressed && styles.actionPressed,
              ]}
            >
              <Text style={styles.actionText}>Try again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: paper.cream,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  column: {
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  kicker: {
    fontFamily: "Georgia",
    fontSize: 12,
    letterSpacing: 4.2,
    fontWeight: "600",
    color: paper.inkMuted,
    marginBottom: 18,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600",
    color: paper.ink,
    marginBottom: 14,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 28,
    color: paper.inkBody,
    marginBottom: 28,
  },
  action: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  actionPressed: {
    opacity: press.opacity,
  },
  actionText: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.2,
  },
});
