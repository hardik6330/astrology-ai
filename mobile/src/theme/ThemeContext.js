import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from "react";
import { palettes } from "./tokens";
import { getItem, setItem } from "../utils/storage";

const KEY = "astro_theme_v1";

const ThemeContext = createContext({
  theme: "dark",
  colors: palettes.dark,
  hydrated: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    getItem(KEY, "dark").then((saved) => {
      if (saved === "light" || saved === "dark") setThemeState(saved);
      setHydrated(true);
    });
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    setItem(KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      setItem(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, colors: palettes[theme], hydrated, setTheme, toggleTheme }),
    [theme, hydrated, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Convenience hook: returns just the colors object.
export function useColors() {
  return useContext(ThemeContext).colors;
}
