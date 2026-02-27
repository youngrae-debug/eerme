import { Redirect, router } from "expo-router";
import React from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../components/neumorphic";
import { useJournalStore } from "../store/journalStore";
import { COLORS } from "../theme/colors";
import { resolveAuthErrorMessage } from "../utils/authError";
import { t } from "../utils/i18n";

export default function SignUpScreen() {
  const { isReady, session, signUpWithEmail } = useJournalStore();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const emailTrimmed = email.trim();
  const passwordTrimmed = password.trim();
  const confirmPasswordTrimmed = confirmPassword.trim();
  const isPasswordConfirmed = passwordTrimmed.length > 0 && passwordTrimmed === confirmPasswordTrimmed;

  const runSignUp = React.useCallback(async () => {
    if (!emailTrimmed || passwordTrimmed.length < 6) {
      Alert.alert(t("errorTitle"), t("authValidation"));
      return;
    }

    if (!isPasswordConfirmed) {
      Alert.alert(t("errorTitle"), t("authPasswordMismatch"));
      return;
    }

    setBusy(true);
    try {
      await signUpWithEmail(emailTrimmed, passwordTrimmed);
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert(t("errorTitle"), resolveAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [emailTrimmed, isPasswordConfirmed, passwordTrimmed, signUpWithEmail]);

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <Text style={styles.helper}>{t("loadingSettings")}</Text>
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <NeumorphicCard style={styles.card}>
        <Text style={styles.title}>{t("authSignUpTitle")}</Text>

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

        <Text style={styles.label}>{t("authPasswordLabel")}</Text>
        <TextInput
          secureTextEntry
          placeholder={t("authPasswordPlaceholder")}
          placeholderTextColor={COLORS.secondaryText}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <Text style={styles.label}>{t("authPasswordConfirmLabel")}</Text>
        <TextInput
          secureTextEntry
          placeholder={t("authPasswordConfirmPlaceholder")}
          placeholderTextColor={COLORS.secondaryText}
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <NeumorphicButton
          label={busy ? t("processing") : t("authSignUp")}
          style={styles.fullButton}
          onPress={runSignUp}
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    marginBottom: 20,
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
