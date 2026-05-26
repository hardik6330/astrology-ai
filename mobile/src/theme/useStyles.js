import { useMemo } from "react";
import { useColors } from "./ThemeContext";

// Pattern: `const styles = useStyles((c) => StyleSheet.create({ ... c.bg ... }));`
// The factory is re-run whenever the active palette changes.

export function useStyles(factory) {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
