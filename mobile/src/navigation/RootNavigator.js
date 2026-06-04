import React, { useRef } from "react";
import { View, Text } from "react-native";
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
import { color } from "../theme/tokens";
import { useAuth } from "../features/auth/AuthContext";
import { useChart } from "../context/ChartContext";

const Drawer = createDrawerNavigator();
const Stack  = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: color.bg, card: color.bg, primary: color.primary,
    text: color.text, border: color.cardBorder,
  },
};

function MainDrawer() {
  // Returning users already have a saved chart → open straight on the Birth
  // Chart tab (Reading), skipping the Home birth-detail form. New users (no
  // chart yet) start on Home so they can enter their details. The chart is
  // set synchronously by applySavedForm before login flips the token, so it's
  // already present when this drawer first mounts.
  const { chart } = useChart();
  return (
    <Drawer.Navigator
      initialRouteName={chart ? "Reading" : "Home"}
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: {
          backgroundColor: color.bg, width: 280,
          borderRightWidth: 1, borderRightColor: color.cardBorder,
        },
        overlayColor: "rgba(0,0,0,0.55)",
        sceneContainerStyle: { backgroundColor: color.bg },
        swipeEdgeWidth: 40,
      }}
    >
      <Drawer.Screen name="Home"     component={HomeScreen} />
      <Drawer.Screen
        name="PalmStep"
        component={PalmStepScreen}
        options={{ swipeEnabled: false, drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="PalmCompare"
        component={PalmCompareScreen}
        options={{ swipeEnabled: false, drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen name="Reading"  component={ReadingScreen} />
      <Drawer.Screen name="Palm"     component={PalmScreen} />
      <Drawer.Screen name="Chat"    component={ChatScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen
        name="Credits"
        component={CreditsScreen}
        options={{ swipeEnabled: false, drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen name="Help"    component={HelpSupportScreen} />
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const { token, hydrating } = useAuth();
  // navigationRef is the shared container ref (also used by push-tap handlers).
  const routeNameRef = useRef();

  // While AsyncStorage is being read, show a neutral placeholder so we
  // don't flash the Login screen over a valid existing session.
  if (hydrating) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: color.textDim, fontSize: 28 }}>✨</Text>
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
