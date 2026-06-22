// Global text scale — multiplies every <Text>/<TextInput> font size app-wide so
// copy reads comfortably on all screens without editing each component's styles.
// The app hardcodes font sizes per component (no shared scale), so this root
// patch is the single lever that reaches every screen.
//
// It scales the EXPLICIT fontSize (and lineHeight, in the same ratio, so glyphs
// never clip — see the Android tight-lineHeight clipping note) on each render.
// Imported once at the very top of App.js, before any UI mounts.
//
// Reversible: set SCALE = 1 (no-op) or remove the import from App.js.

import React from "react";
import { Text, TextInput, StyleSheet } from "react-native";

const SCALE = 1.1;

// Default body font = Inter (self-bundled via @expo-google-fonts/inter, loaded
// in App.js before any UI mounts). RN does NOT synthesize weight from a single
// named font file (esp. on Android), so we must name the EXACT weighted face per
// fontWeight. Anything that names its own fontFamily (e.g. the Space Grotesk
// brand wordmark) is left untouched. Before the font finishes loading the name
// simply falls back to the system font — no crash.
function interFamily(weight) {
  const w = String(weight ?? "400");
  if (w === "700" || w === "800" || w === "900" || w === "bold") return "Inter_700Bold";
  if (w === "600") return "Inter_600SemiBold";
  if (w === "500") return "Inter_500Medium";
  return "Inter_400Regular";
}

function patchFontScale(Component) {
  const original = Component.render;
  // forwardRef components expose their inner render as `.render`; bail if the
  // shape is unexpected or we've already patched (idempotent on fast refresh).
  if (typeof original !== "function" || original.__fontScaled) return;

  function scaledRender(props, ref) {
    const element = original.call(this, props, ref);
    if (!element || !element.props) return element;

    const flat = StyleSheet.flatten(element.props.style) || {};
    const extra = {};
    if (typeof flat.fontSize === "number") extra.fontSize = Math.round(flat.fontSize * SCALE);
    if (typeof flat.lineHeight === "number") extra.lineHeight = Math.round(flat.lineHeight * SCALE);
    // Default body font: inject the matching weighted Inter face unless the
    // element named its own font. Clear fontWeight too — the face already
    // encodes it, and leaving it set makes Android double-bold.
    if (flat.fontFamily === undefined) {
      extra.fontFamily = interFamily(flat.fontWeight);
      if (flat.fontWeight !== undefined) extra.fontWeight = "normal";
    }
    // Nothing to add → leave the element as-is.
    if (extra.fontSize === undefined && extra.lineHeight === undefined && extra.fontFamily === undefined) {
      return element;
    }

    // Append AFTER the element's own style so our values win.
    return React.cloneElement(element, { style: [element.props.style, extra] });
  }
  scaledRender.__fontScaled = true;
  Component.render = scaledRender;
}

// Always patch now — even at SCALE 1 we inject the default Inter font family.
patchFontScale(Text);
patchFontScale(TextInput);
