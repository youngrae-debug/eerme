import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { NeumorphicButton, NeumorphicCard } from "../components/neumorphic";
import { useJournalStore } from "../store/journalStore";
import { COLORS } from "../theme/colors";

export default function LoginScreen() {
  const { isReady, session, isGuest, signInWithEmail, signInWithApple, signInWithGoogle, signInAsGuest } = useJournalStore();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [appleTokenInput, setAppleTokenInput] = React.useState("");
  const [googleTokenInput, setGoogleTokenInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const run = async (task: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    try {
      await task();
      if (successMessage) {
        Alert.alert("완료", successMessage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "로그인에 실패했습니다.";
      Alert.alert("오류", message);
    } finally {
      setBusy(false);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>앱 준비 중...</Text>
      </View>
    );
  }

  if (session || isGuest) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>eerme 로그인</Text>
      <Text style={styles.subtitle}>계정으로 로그인하거나 게스트로 바로 시작할 수 있어요.</Text>

      <NeumorphicCard style={styles.card}>
        <Text style={styles.label}>이메일 로그인</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="email"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="password"
          secureTextEntry
          style={styles.input}
        />
        <NeumorphicButton
          label={busy ? "처리 중..." : "이메일 로그인"}
          onPress={() => run(() => signInWithEmail(email.trim(), password), "로그인 성공")}
        />
      </NeumorphicCard>

      <NeumorphicCard style={styles.card}>
        <Text style={styles.label}>게스트 로그인</Text>
        <Text style={styles.description}>계정 없이 로컬 기록부터 시작합니다. 이후 동기화 탭에서 계정 로그인을 할 수 있어요.</Text>
        <NeumorphicButton
          label={busy ? "처리 중..." : "게스트로 시작"}
          onPress={() => run(signInAsGuest, "게스트 모드로 시작합니다")}
        />
      </NeumorphicCard>

      <NeumorphicCard style={styles.card}>
        <Text style={styles.label}>소셜 로그인</Text>

        {Platform.OS === "ios" ? (
          <>
            <Text style={styles.socialInputLabel}>Apple identity token</Text>
            <TextInput
              value={appleTokenInput}
              onChangeText={setAppleTokenInput}
              placeholder="Apple identity token"
              autoCapitalize="none"
              style={styles.input}
            />

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.appleSignInButton, pressed && styles.brandButtonPressed]}
              onPress={() => run(() => signInWithApple(appleTokenInput.trim()), "Apple 로그인 성공")}
              disabled={busy}
            >
              <Text style={styles.appleIcon}></Text>
              <Text style={styles.appleSignInLabel}>{busy ? "처리 중..." : "Sign in with Apple"}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.platformInfoText}>Apple 로그인은 iOS 기기에서만 지원됩니다.</Text>
        )}

        <Text style={styles.socialInputLabel}>Google identity token</Text>
        <TextInput
          value={googleTokenInput}
          onChangeText={setGoogleTokenInput}
          placeholder="Google identity token"
          autoCapitalize="none"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.googleSignInButton, pressed && styles.brandButtonPressed]}
          onPress={() => run(() => signInWithGoogle(googleTokenInput.trim()), "Google 로그인 성공")}
          disabled={busy}
        >
          <View style={styles.googleLogoWrap}>
            <Text style={styles.googleLogoText}>G</Text>
          </View>
          <Text style={styles.googleSignInLabel}>{busy ? "처리 중..." : "Continue with Google"}</Text>
        </Pressable>
      </NeumorphicCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 60, gap: 12 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: COLORS.textOnDark },
  title: { color: COLORS.textOnDark, fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#d1d5db", marginBottom: 8 },
  card: { borderRadius: 20 },
  label: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 8 },
  description: { color: "#4b5563", marginBottom: 10, lineHeight: 18 },
  socialInputLabel: { color: COLORS.textOnSurface, fontSize: 13, marginBottom: 6, marginTop: 2 },
  platformInfoText: { color: "#6b7280", marginBottom: 12 },
  brandButtonPressed: { opacity: 0.8 },
  appleSignInButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  appleIcon: { color: "#FFFFFF", fontSize: 20, marginRight: 10, marginTop: -1 },
  appleSignInLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  googleSignInButton: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderColor: "#dadce0",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  googleLogoWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dadce0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  googleLogoText: { color: "#4285F4", fontSize: 12, fontWeight: "700" },
  googleSignInLabel: { color: "#3c4043", fontSize: 16, fontWeight: "500" },
  input: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 12,
    color: COLORS.textOnSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
});
