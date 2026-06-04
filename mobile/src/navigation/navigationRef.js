// Shared navigation ref so code OUTSIDE the React tree (push-notification tap
// handlers in features/notifications/push.js) can navigate. The same ref is
// attached to <NavigationContainer> in RootNavigator.
//
// Cold-start safety: when the app is launched FROM a notification tap, the tap
// fires before the container mounts. navigateFromNotification() queues the
// target and flushPendingNavigation() (called from onReady) applies it.

import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

let pendingScreen = null;

// Map a notification's `screen` field to a real route + params. Screens the
// backend sends: 'reading' | 'chat' | 'daily' (see pushService.js,
// notificationSeed.js, engageService.js). Daily guidance lives inside the
// Reading screen (no standalone route), so it resolves there too.
function resolve(screen) {
  switch (screen) {
    case "chat":
      return ["Chat", undefined];
    case "daily":
    case "reading":
    default:
      return ["Reading", { tab: "kundali" }];
  }
}

// Navigate to a notification's deep-link target. If the container isn't ready
// yet (cold start), queue it for flushPendingNavigation(). Guarded: navigating
// to a logged-out app (only Login exists) throws and is swallowed — the app
// just opens normally.
export function navigateFromNotification(screen) {
  if (!screen) return;
  if (!navigationRef.isReady()) {
    pendingScreen = screen;
    return;
  }
  try {
    navigationRef.navigate(...resolve(screen));
  } catch {
    /* logged out / route absent — opening the app is enough */
  }
}

// Apply a queued deep-link once the container is ready. Called from
// NavigationContainer.onReady in RootNavigator.
export function flushPendingNavigation() {
  if (!pendingScreen) return;
  const screen = pendingScreen;
  pendingScreen = null;
  navigateFromNotification(screen);
}
