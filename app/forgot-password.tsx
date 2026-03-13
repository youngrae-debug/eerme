import { router } from "expo-router";
import React from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../components/neumorphic";
import { useJournalStore } from "../store/journalStore";
import { COLORS } from "../theme/colors";
import { resolveAuthErrorMessage } from "../utils/authError";
import { t } from "../utils/i18n";

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useJournalStore();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const emailTrimmed = email.trim();

  const runResetPassword = React.useCallback(async () => {
    if (!emailTrimmed) {
      Alert.alert(t("errorTitle"), t("authResetEmailRequired"));
      return;
    }

    setBusy(true);
    try {
      await requestPasswordReset(emailTrimmed);
      Alert.alert(t("doneTitle"), t("authResetEmailSent"), [
        {
          text: t("confirmTitle"),
          onPress: () => router.replace("/login"),
        },
      ]);
    } catch (error) {
      Alert.alert(t("errorTitle"), resolveAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [emailTrimmed, requestPasswordReset]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <NeumorphicCard style={styles.card}>
        <Text style={styles.title}>{t("authForgotPasswordTitle")}</Text>
        <Text style={styles.helper}>{t("authForgotPasswordSubtitle")}</Text>

        <Text style={styles.label}>{t("authEmailLabel")}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder={t("authEmailPlaceholder")}
          placeholderTextColor={COLORS.secondaryText}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        <NeumorphicButton
          label={busy ? t("processing") : t("authResetPasswordButton")}
          style={styles.fullButton}
          onPress={runResetPassword}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchHelper}>{t("authHasAccount")}</Text>
          <Text style={styles.switchAction} onPress={() => router.replace("/login")}>{t("authSwitchToSignIn")}</Text>
        </View>
      </NeumorphicCard>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: COLORS.background,
  },
  card: {
    borderRadius: 24,
  },
  title: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.primaryText,
    marginBottom: 10,
  },
  helper: {
    color: COLORS.secondaryText,
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 20,
  },
  label: {
    color: COLORS.textOnSurface,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    color: COLORS.primaryText,
    marginBottom: 14,
  },
  fullButton: {
    marginTop: 14,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
    gap: 6,
  },
  switchHelper: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  switchAction: {
    color: COLORS.primaryText,
    fontWeight: "700",
    fontSize: 14,
  },
});
