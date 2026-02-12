import React, { PropsWithChildren } from "react";
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { COLORS } from "../theme/colors";

type NeumorphicCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function NeumorphicCard({ children, style }: NeumorphicCardProps) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

type NeumorphicButtonProps = {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: "primary" | "secondary" | "peach" | "mint";
};

export function NeumorphicButton({ label, onPress, style, textStyle, variant = "primary" }: NeumorphicButtonProps) {
  const variantStyles = {
    primary: { backgroundColor: '#C6B193' },
    secondary: { backgroundColor: '#BFA888' },
    peach: { backgroundColor: '#C6B193' },
    mint: { backgroundColor: '#BFA888' },
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyles[variant],
        style,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={[styles.buttonLabel, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  button: {
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonLabel: {
    color: '#5A4E42',
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
  },
});
