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
    primary: { backgroundColor: COLORS.primaryText },
    secondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
    peach: { backgroundColor: COLORS.primaryText },
    mint: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyles[variant],
        style,
        pressed && { opacity: 0.86 },
      ]}
    >
      <Text style={[styles.buttonLabel, variant === "secondary" || variant === "mint" ? styles.buttonLabelMuted : styles.buttonLabelInverted, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    borderRadius: 4,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
  },
  buttonLabelInverted: {
    color: COLORS.surface,
  },
  buttonLabelMuted: {
    color: COLORS.primaryText,
  },
});
