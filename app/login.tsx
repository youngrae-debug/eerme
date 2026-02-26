import { Redirect, router } from "expo-router";
import React from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../components/neumorphic";
import { useJournalStore } from "../store/journalStore";
import { COLORS } from "../theme/colors";
import { t } from "../utils/i18n";

export default function LoginScreen() {
  const { isReady, session, signInWithEmail, signUpWithEmail } = useJournalStore();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const emailTrimmed = email.trim();
  const passwordTrimmed = password.trim();
  const canSubmit = emailTrimmed.length > 0 && passwordTrimmed.length >= 6;

  const runAuth = React.useCallback(
    async (mode: "signin" | "signup") => {
      if (!canSubmit) {
        Alert.alert(t("errorTitle"), t("authValidation"));
        return;
      }

      setBusy(true);
      try {
        if (mode === "signin") {
          await signInWithEmail(emailTrimmed, passwordTrimmed);
        } else {
          await signUpWithEmail(emailTrimmed, passwordTrimmed);
        }
        router.replace("/(tabs)");
      } catch (error) {
        const message = error instanceof Error ? error.message : t("authFailed");
        Alert.alert(t("errorTitle"), message);
      } finally {
        setBusy(false);
      }
    },
    [canSubmit, emailTrimmed, passwordTrimmed, signInWithEmail, signUpWithEmail],
  );

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
        <Text style={styles.title}>{t("authTitle")}</Text>
        <Text style={styles.helper}>{t("authSubtitle")}</Text>

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
        <Text style={styles.helper}>{t("authPasswordHint")}</Text>

        <View style={styles.row}>
          <NeumorphicButton
            label={busy ? t("processing") : t("authSignIn")}
            style={styles.button}
            onPress={() => runAuth("signin")}
          />
          <NeumorphicButton
            label={busy ? t("processing") : t("authSignUp")}
            style={styles.button}
            onPress={() => runAuth("signup")}
          />
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
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  helper: {
    color: COLORS.secondaryText,
    marginBottom: 12,
    lineHeight: 20,
  },
  label: {
    color: COLORS.textOnSurface,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    color: COLORS.primaryText,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  button: {
    flex: 1,
  },
});
