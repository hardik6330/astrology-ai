import "./src/theme/textScale"; // global ~1.1× text scale — must run before any UI mounts
import React, { useEffect, useState } from "react";
import { View, Linking, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import RootNavigator from "./src/navigation/RootNavigator";
import { ChartProvider, useForm } from "./src/context/ChartContext";
import { AuthProvider, useAuth } from "./src/features/auth/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import ErrorBoundary from "./src/components/ErrorBoundary";
import SplashScreen from "./src/components/SplashScreen";
import { warmupBackend, getCredits, getAuthConfig } from "./src/services/api";
import { setupForegroundNotifications, setupNotificationNavigation, requestDisplayPermission } from "./src/features/notifications/push";
import UpdateModal from "./src/components/UpdateModal";
import { isOutdated } from "./src/utils/version";
import { getItem, setItem } from "./src/utils/storage";

import Constants, { ExecutionEnvironment } from "expo-constants";
import * as ExpoSplash from "expo-splash-screen";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Hold the OS native splash up until our animated SplashScreen has painted its
// first frame — otherwise the native splash auto-hides whenever React mounts,
// flashing a gap before the animation. We hide it via onReady (below).
ExpoSplash.preventAutoHideAsync().catch(() => {});

// Remembers which version the user dismissed an OPTIONAL update prompt for, so
// we don't re-show it every launch. A newer latestVersion won't match → re-shows.
const UPDATE_SKIP_KEY = "update_skip_version";

// Store-listing redirect for the update prompt. No admin-configured URL — the
// link is derived from this app's own package id, so it always points at the
// right listing. iOS needs the numeric App Store id (fill once it exists).
const ANDROID_PKG = Constants.expoConfig?.android?.package || "com.astrologyai.app";
const IOS_APP_ID  = ""; // e.g. "1234567890" once the App Store listing is live

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === "light" ? "dark" : "light"} />;
}

// Watches the auth token and wipes all per-user state (form, chart,
// interpretations, palm reading) on logout — otherwise the next phone
// number to sign in inherits the previous user's data from disk.
function AuthLifecycle() {
  const { token } = useAuth();
  const { clearAll } = useForm();
  const prevTokenRef = React.useRef(token);
  useEffect(() => {
    const prev = prevTokenRef.current;
    if (prev && !token) clearAll();
    prevTokenRef.current = token;
  }, [token, clearAll]);

  // Load the credit balance the moment a session exists (login OR relaunch
  // with a saved token), so the badge/cost-gating is correct app-wide without
  // waiting for the user to open Profile. getCredits() no-ops without a token.
  useEffect(() => {
    if (token) getCredits();
  }, [token]);
  return null;
}

function AppShell() {
  const [splashing, setSplashing] = useState(true);
  const { hydrated, colors } = useTheme();
  // { latestVersion, mandatory } when an update prompt should show.
  const [update, setUpdate] = useState(null);

  // Wake the Vercel serverless backend in the background while the
  // splash plays, so the first real API call doesn't pay the cold start.
  useEffect(() => { warmupBackend(); }, []);

  // Update gate. When this build is older than the backend's latestVersion:
  //   • forceUpdate on  → mandatory (non-dismissible) prompt
  //   • forceUpdate off → optional prompt, unless the user already tapped
  //     "Later" for this exact version (remembered in storage so we don't nag
  //     every launch — a newer version clears it).
  // getAuthConfig fails open, so a network blip never blocks the user.
  useEffect(() => {
    getAuthConfig().then(async (cfg) => {
      const current = Constants.expoConfig?.version;
      if (!isOutdated(current, cfg.latestVersion)) return;

      if (cfg.forceUpdate) {
        setUpdate({ latestVersion: cfg.latestVersion, mandatory: true });
        return;
      }
      const skipped = await getItem(UPDATE_SKIP_KEY, null);
      if (skipped === cfg.latestVersion) return; // dismissed this version already
      setUpdate({ latestVersion: cfg.latestVersion, mandatory: false });
    });
  }, []);

  // Redirect straight to this app's store listing. market:// / itms-apps://
  // open the native store app; fall back to the https listing if it can't.
  const onUpdatePress = () => {
    const deep = Platform.OS === "ios"
      ? `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`
      : `market://details?id=${ANDROID_PKG}`;
    const web = Platform.OS === "ios"
      ? `https://apps.apple.com/app/id${IOS_APP_ID}`
      : `https://play.google.com/store/apps/details?id=${ANDROID_PKG}`;
    Linking.openURL(deep).catch(() => Linking.openURL(web).catch(() => {}));
  };
  // "Later" only exists on the optional prompt — remember the skip + dismiss.
  const onUpdateLater = () => {
    if (update?.latestVersion) setItem(UPDATE_SKIP_KEY, update.latestVersion);
    setUpdate(null);
  };

  // Arm the foreground notification handler once. FCM won't draw a banner
  // while the app is open — this listens and renders it via notifee. No-op in
  // Expo Go; only fires real notifications in a native build.
  useEffect(() => {
    setupForegroundNotifications();
    setupNotificationNavigation();
    requestDisplayPermission();
  }, []);

  // Block the splash from rendering until the saved theme has loaded from
  // AsyncStorage — otherwise the user sees a brief default-dark flash before
  // it switches to their saved light mode.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ThemedStatusBar />
      <AuthLifecycle />
      {!splashing && <RootNavigator />}
      {splashing && hydrated && (
        <SplashScreen
          onReady={() => ExpoSplash.hideAsync().catch(() => {})}
          onDone={() => setSplashing(false)}
        />
      )}
      <UpdateModal
        visible={!!update}
        mandatory={update?.mandatory}
        latestVersion={update?.latestVersion}
        onUpdate={onUpdatePress}
        onLater={onUpdateLater}
      />
    </View>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <ChartProvider>
                <AppShell />
              </ChartProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
