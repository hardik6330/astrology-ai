import React, { useRef, useEffect } from "react";
import { View, BackHandler, ToastAndroid, Platform } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { logScreenView } from "../features/notifications/analytics";
import { navigationRef, flushPendingNavigation } from "./navigationRef";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen        from "../features/home/HomeScreen";
import ReadingScreen     from "../features/reading/ReadingScreen";
import ChatScreen        from "../features/chat/ChatScreen";
import PalmScreen        from "../features/palm/PalmScreen";
import PalmStepScreen    from "../features/palm/PalmStepScreen";
import PalmCompareScreen from "../features/palm/PalmCompareScreen";
import ProfileScreen     from "../features/profile/ProfileScreen";
import CreditsScreen     from "../features/credits/CreditsScreen";
import HelpSupportScreen from "../features/profile/HelpSupportScreen";
import LoginScreen       from "../features/auth/LoginScreen";
import DrawerContent     from "../components/DrawerContent";
import SolarSystemLoader from "../components/SolarSystemLoader";
import { withErrorBoundary } from "../components/ErrorBoundary";
import { color as tokensColor } from "../theme/tokens";
import { useAuth } from "../features/auth/AuthContext";
import { useForm } from "../context/ChartContext";
import { useTheme } from "../theme/ThemeContext";
import LoginBackdrop from "../components/cosmic/LoginBackdrop";

const Drawer = createDrawerNavigator();
const Stack  = createNativeStackNavigator();

// Per-screen error isolation: a crash in one screen shows the fallback in just
// that screen, leaving the drawer + other screens usable.
const Home        = withErrorBoundary(HomeScreen);
const Reading     = withErrorBoundary(ReadingScreen);
const Chat        = withErrorBoundary(ChatScreen);
const Palm        = withErrorBoundary(PalmScreen);
const PalmStep    = withErrorBoundary(PalmStepScreen);
const PalmCompare = withErrorBoundary(PalmCompareScreen);
const Profile     = withErrorBoundary(ProfileScreen);
const Credits     = withErrorBoundary(CreditsScreen);
const Help        = withErrorBoundary(HelpSupportScreen);

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: tokensColor.bg, card: tokensColor.bg, primary: tokensColor.primary,
    text: tokensColor.text, border: tokensColor.cardBorder,
  },
};

function MainDrawer() {
  // Returning users already have a saved chart → open straight on the Birth
  // Chart tab (Reading), skipping the Home birth-detail form. New users (no
  // chart yet) start on Home so they can enter their details. The chart is
  // set synchronously by applySavedForm before login flips the token, so it's
  // already present when this drawer first mounts.
  const { chart } = useForm();
  const initialRoute = chart ? "Reading" : "Home";

  useEffect(() => {
    let backPressCount = 0;
    const onBackPress = () => {
      // If we can go back in the stack/drawer history, let React Navigation handle it.
      if (navigationRef.current?.canGoBack()) {
        return false;
      }

      // If we are on the initial screen and can't go back further, handle double-tap to exit on Android.
      if (Platform.OS === "android") {
        if (backPressCount === 0) {
          backPressCount++;
          ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
          setTimeout(() => { backPressCount = 0; }, 2000);
          return true;
        }
        BackHandler.exitApp();
        return true;
      }
      
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, []);

  return (
    <Drawer.Navigator
      initialRouteName={initialRoute}
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        // Freeze (not unmount) blurred screens: stops their re-renders while
        // keeping them mounted, so local screen state survives navigation —
        // the app relies on that (palm scan, chat input, etc.). Pairs with the
        // split ChartContext to keep background screens fully idle.
        freezeOnBlur: true,
        drawerType: "front",
        drawerStyle: {
          backgroundColor: tokensColor.bg, width: 280,
          borderRightWidth: 1, borderRightColor: tokensColor.cardBorder,
        },
        overlayColor: "rgba(0,0,0,0.55)",
        sceneContainerStyle: { backgroundColor: tokensColor.bg },
        swipeEdgeWidth: 40,
        // "history" means the back button will go back through the drawer
        // items visited. This prevents jumping straight to Home/Reading.
        backBehavior: "history",
      }}
    >
      <Drawer.Screen name="Home"     component={Home} />
      <Drawer.Screen
        name="PalmStep"
        component={PalmStep}
        options={{ swipeEnabled: false, drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="PalmCompare"
        component={PalmCompare}
        options={{ swipeEnabled: false, drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen name="Reading"  component={Reading} />
      <Drawer.Screen name="Palm"     component={Palm} />
      <Drawer.Screen name="Chat"    component={Chat} />
      <Drawer.Screen name="Profile" component={Profile} />
      <Drawer.Screen
        name="Credits"
        component={Credits}
        options={{ swipeEnabled: false, drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen name="Help"    component={Help} />
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const { token, hydrating } = useAuth();
  // Chart hydration is async too. We must not mount the drawer until it's
  // settled — otherwise MainDrawer's initialRoute is computed with chart=null,
  // lands on Home ("step 1"), then bounces to Reading via redirectToReading,
  // leaving a stale Home at the bottom of the back history. Waiting here makes
  // initialRoute deterministic so back order is a clean Credits → Profile → Reading.
  const { hydrated: chartHydrated } = useForm();
  const { theme, colors } = useTheme();
  // navigationRef is the shared container ref (also used by push-tap handlers).
  const routeNameRef = useRef();

  // While AsyncStorage is being read, show a neutral placeholder so we
  // don't flash the Login screen over a valid existing session.
  if (hydrating || (token && !chartHydrated)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <LoginBackdrop color={colors} theme={theme} hidePlanets />
        <SolarSystemLoader />
      </View>
    );
  }

  return (
    <NavigationContainer 
      theme={navTheme}
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current.getCurrentRoute().name;
        // Apply any deep-link queued by a cold-start notification tap.
        flushPendingNavigation();
      }}
      onStateChange={async () => {
        const previousRouteName = routeNameRef.current;
        const currentRouteName = navigationRef.current.getCurrentRoute().name;

        if (previousRouteName !== currentRouteName) {
          await logScreenView(currentRouteName);
        }
        routeNameRef.current = currentRouteName;
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Main"  component={MainDrawer} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
