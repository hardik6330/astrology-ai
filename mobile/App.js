import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import RootNavigator from "./src/navigation/RootNavigator";
import { ChartProvider, useChart } from "./src/context/ChartContext";
import { AuthProvider, useAuth } from "./src/features/auth/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import ErrorBoundary from "./src/components/ErrorBoundary";
import SplashScreen from "./src/components/SplashScreen";
import { warmupBackend, getCredits } from "./src/services/api";
import { setupForegroundNotifications, requestDisplayPermission } from "./src/features/notifications/push";

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

  // Wake the Vercel serverless backend in the background while the
  // splash plays, so the first real API call doesn't pay the cold start.
  useEffect(() => { warmupBackend(); }, []);

  // Arm the foreground notification handler once. FCM won't draw a banner
  // while the app is open — this listens and renders it via notifee. No-op in
  // Expo Go; only fires real notifications in a native build.
  useEffect(() => {
    setupForegroundNotifications();
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
    </View>
  );
}

export default function App() {
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
