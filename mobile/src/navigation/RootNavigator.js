import React from "react";
import { View, Text } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen        from "../screens/HomeScreen";
import ReadingScreen     from "../screens/ReadingScreen";
import ChatScreen        from "../screens/ChatScreen";
import PalmScreen        from "../screens/PalmScreen";
import ProfileScreen     from "../screens/ProfileScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";
import LoginScreen       from "../screens/LoginScreen";
import DrawerContent     from "../components/DrawerContent";
import { color } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";

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
  return (
    <Drawer.Navigator
      initialRouteName="Home"
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
      <Drawer.Screen name="Home"    component={HomeScreen} />
      <Drawer.Screen name="Reading" component={ReadingScreen} />
      <Drawer.Screen name="Palm"    component={PalmScreen} />
      <Drawer.Screen name="Chat"    component={ChatScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="Help"    component={HelpSupportScreen} />
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const { token, hydrating } = useAuth();

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
    <NavigationContainer theme={navTheme}>
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
