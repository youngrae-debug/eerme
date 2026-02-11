import React from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { NeumorphicButton, NeumorphicCard } from "../components/neumorphic";
import { useJournalStore } from "../store/journalStore";
import { COLORS } from "../theme/colors";

export default function LoginScreen() {
  const { isReady, session, isGuest, signInWithEmail, signInAsGuest } = useJournalStore();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
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
