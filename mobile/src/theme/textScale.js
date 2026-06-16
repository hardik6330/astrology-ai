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
    // Nothing explicitly sized → leave it (RN's default size is fine as-is).
    if (extra.fontSize === undefined && extra.lineHeight === undefined) return element;

    // Append AFTER the element's own style so our scaled values win.
    return React.cloneElement(element, { style: [element.props.style, extra] });
  }
  scaledRender.__fontScaled = true;
  Component.render = scaledRender;
}

if (SCALE !== 1) {
  patchFontScale(Text);
  patchFontScale(TextInput);
}
