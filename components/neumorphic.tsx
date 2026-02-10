import React, { PropsWithChildren } from "react";
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { COLORS } from "../theme/colors";

type NeumorphicCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function NeumorphicCard({ children, style }: NeumorphicCardProps) {
  return (
    <View style={[styles.outer, style]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

type NeumorphicButtonProps = {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function NeumorphicButton({ label, onPress, style, textStyle }: NeumorphicButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.85 }]}>
      <NeumorphicCard>
        <Text style={[styles.buttonLabel, textStyle]}>{label}</Text>
      </NeumorphicCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    shadowColor: COLORS.accentDarkShadow,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },
  inner: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    shadowColor: COLORS.accentLightShadow,
    shadowOffset: { width: -8, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonLabel: {
    color: COLORS.textOnSurface,
    fontWeight: "700",
    textAlign: "center",
  },
});
