import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NeumorphicButton } from "../components/neumorphic";
import { COLORS } from "../theme/colors";

export default function ExampleScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sample UI</Text>
      <View style={styles.row}>
        <NeumorphicButton label="Play" style={styles.button} />
        <NeumorphicButton label="Order Now" style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  title: {
    color: COLORS.textOnDark,
    fontSize: 28,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    minWidth: 120,
  },
});
