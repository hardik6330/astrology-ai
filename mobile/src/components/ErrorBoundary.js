import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { color, radius, spacing, fontSize } from "../theme/tokens";

// Standalone — uses static dark palette since it must render even if the
// theme context has failed.

export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { if (__DEV__) console.error("[ErrorBoundary]", error, info); }
  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong ✨</Text>
        <Text style={styles.msg}>{String(this.state.error.message || this.state.error)}</Text>
        <Pressable style={styles.btn} onPress={this.reset}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

// Wrap a screen so its crash is contained — the drawer/nav chrome stays alive
// and the user can navigate elsewhere instead of the whole app blanking.
export function withErrorBoundary(Component) {
  function Wrapped(props) {
    return (
      <ErrorBoundary>
        <Component {...props} />
      </ErrorBoundary>
    );
  }
  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Screen"})`;
  return Wrapped;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: color.bg,
    alignItems: "center", justifyContent: "center",
    padding: spacing.xl,
  },
  title:   { color: color.text, fontSize: fontSize.xl, fontWeight: "700", marginBottom: spacing.md },
  msg:     { color: color.textDim, textAlign: "center", marginBottom: spacing.xl },
  btn: {
    backgroundColor: color.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
