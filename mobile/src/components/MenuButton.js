import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import { useStyles } from "../theme/useStyles";
import { useColors } from "../theme/ThemeContext";
import { radius } from "../theme/tokens";

function MenuButton({ style }) {
  const navigation = useNavigation();
  const styles = useStyles(makeStyles);
  const c = useColors();
  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }, style]}
      hitSlop={10}
    >
      {/* Ionicons "menu" renders the platform-native hamburger — the bare ☰
          glyph is a text character, not an iOS affordance. */}
      <Ionicons name="menu" size={22} color={c.text} />
    </Pressable>
  );
}

export default React.memo(MenuButton);

const makeStyles = (c) =>
  StyleSheet.create({
    btn: {
      width: 40, height: 40, borderRadius: radius.md,
      alignItems: "center", justifyContent: "center",
      backgroundColor: c.cardBgSolid,
      borderWidth: 1, borderColor: c.cardBorder,
    },
  });
