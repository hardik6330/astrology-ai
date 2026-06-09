import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import { useStyles } from "../theme/useStyles";
import { radius } from "../theme/tokens";

function MenuButton({ style }) {
  const navigation = useNavigation();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }, style]}
      hitSlop={10}
    >
      <Text style={styles.icon}>☰</Text>
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
    icon: { color: c.text, fontSize: 22, lineHeight: 24 },
  });
