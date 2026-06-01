import * as Haptics from "expo-haptics";

// Thin, fire-and-forget wrappers around expo-haptics. Every call is best-effort
// and swallows errors — haptics are unsupported on some devices/emulators and
// must never throw into a tap handler.
//
//   tap     — light press on any button / tappable row
//   medium  — a more substantial confirmation (e.g. starting an analysis)
//   select  — the subtle "tick" when switching tabs / segmented controls
//   success — a generated reading / completed action landed
//   warning — a recoverable problem (validation, gate rejection)
//   error   — a hard failure (request failed)
export const haptics = {
  tap:     () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium:  () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  select:  () => Haptics.selectionAsync().catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
