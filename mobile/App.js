import React, { useEffect, useState } from "react";
import { View, Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import RootNavigator from "./src/navigation/RootNavigator";
import { ChartProvider, useChart } from "./src/context/ChartContext";
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

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Remembers which version the user dismissed an OPTIONAL update prompt for, so
// we don't re-show it every launch. A newer latestVersion won't match → re-shows.
const UPDATE_SKIP_KEY = "update_skip_version";

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === "light" ? "dark" : "light"} />;
}

// Watches the auth token and wipes all per-user state (form, chart,
// interpretations, palm reading) on logout — otherwise the next phone
// number to sign in inherits the previous user's data from disk.
function AuthLifecycle() {
  const { token } = useAuth();
  const { clearAll } = useChart();
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
  // { latestVersion, updateUrl, mandatory } when an update prompt should show.
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
        setUpdate({ latestVersion: cfg.latestVersion, updateUrl: cfg.updateUrl, mandatory: true });
        return;
      }
      const skipped = await getItem(UPDATE_SKIP_KEY, null);
      if (skipped === cfg.latestVersion) return; // dismissed this version already
      setUpdate({ latestVersion: cfg.latestVersion, updateUrl: cfg.updateUrl, mandatory: false });
    });
  }, []);

  const onUpdatePress = () => {
    if (update?.updateUrl) Linking.openURL(update.updateUrl).catch(() => {});
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
        <SplashScreen onDone={() => setSplashing(false)} />
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
