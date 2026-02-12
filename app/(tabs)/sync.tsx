import * as FileSystem from "expo-file-system/legacy";
import React from "react";
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";

const BACKUP_FILE_PREFIX = "eerme-backup-";

type BackupFileItem = {
  uri: string;
  name: string;
};

type MyPageTab = "login" | "status" | "subscription" | "backup";

export default function SyncScreen() {
  const {
    entries,
    isReady,
    session,
    syncStatus,
    syncError,
    lastSyncedAt,
    pendingSyncCount,
    isPremium,
    setPremium,
    isGuest,
    signInWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut,
    syncNow,
    exportBackup,
    importBackup,
  } = useJournalStore();

  const [activeTab, setActiveTab] = React.useState<MyPageTab>("status");
  const [selectedPlan, setSelectedPlan] = React.useState<"free" | "premium">(isPremium ? "premium" : "free");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [tokenInput, setTokenInput] = React.useState("");
  const [appleTokenInput, setAppleTokenInput] = React.useState("");
  const [googleTokenInput, setGoogleTokenInput] = React.useState("");
  const [backupText, setBackupText] = React.useState("");
  const [backupFileUri, setBackupFileUri] = React.useState("");
  const [backupFiles, setBackupFiles] = React.useState<BackupFileItem[]>([]);
  const [busy, setBusy] = React.useState(false);

  const tabItems = React.useMemo(
    () => [
      { key: "login" as const, label: "로그인", visible: !session || isGuest },
      { key: "status" as const, label: "상태", visible: true },
      { key: "subscription" as const, label: "구독", visible: true },
      { key: "backup" as const, label: "백업", visible: true },
    ],
    [isGuest, session],
  );

  const visibleTabs = React.useMemo(() => tabItems.filter((item) => item.visible), [tabItems]);

  React.useEffect(() => {
    if (!visibleTabs.some((item) => item.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? "status");
    }
  }, [activeTab, visibleTabs]);

  const loadBackupFiles = React.useCallback(async () => {
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      setBackupFiles([]);
      return;
    }

    const fileNames = await FileSystem.readDirectoryAsync(baseDir);
    const candidates = fileNames
      .filter((name) => name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a))
      .map((name) => ({
        name,
        uri: `${baseDir}${name}`,
      }));

    setBackupFiles(candidates);
  }, []);

  React.useEffect(() => {
    if (!isReady) return;

    loadBackupFiles().catch((error) => {
      console.error("Failed to load backup files", error);
    });
  }, [isReady, loadBackupFiles]);

  React.useEffect(() => {
    setSelectedPlan(isPremium ? "premium" : "free");
  }, [isPremium]);

  const run = async (task: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    try {
      await task();
      if (successMessage) {
        Alert.alert("완료", successMessage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "작업에 실패했습니다.";
      Alert.alert("오류", message);
    } finally {
      setBusy(false);
    }
  };

  const restoreFromFile = React.useCallback(
    async (uri: string) => {
      const raw = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await importBackup(raw);
      setBackupFileUri(uri);
    },
    [importBackup],
  );

  if (!isReady) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>설정을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>마이페이지</Text>
      <Text style={styles.subtitle}>로그인, 상태, 구독, 백업 정보를 탭으로 관리할 수 있어요.</Text>

      <View style={styles.tabRow}>
        {visibleTabs.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "login" ? (
        <>
          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>로그인</Text>
            <Text style={styles.value}>
              {isGuest
                ? "게스트 모드입니다. 아래 Google/Apple 또는 이메일 로그인을 통해 계정을 연동할 수 있어요."
                : "로그인하지 않은 상태입니다. 이메일/소셜 로그인을 진행해 주세요."}
            </Text>
          </NeumorphicCard>

          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>이메일 로그인</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email"
              autoCapitalize="none"
              keyboardType="email-address"
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
              onPress={() => run(() => signInWithEmail(email.trim(), password), "이메일 로그인 성공")}
            />
          </NeumorphicCard>

          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>소셜 로그인 (identity token)</Text>
            <Text style={styles.hintText}>
              게스트 로그인 중이라면 아래 버튼으로 계정을 연동할 수 있어요.{"\n"}
              Apple 로그인은 iOS에서만 노출됩니다.
            </Text>

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
        </>
      ) : null}

      {activeTab === "status" ? (
        <>
          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>로그인 상태</Text>
            {session ? (
              <>
                <Text style={styles.value}>provider: {session.provider}</Text>
                <Text style={styles.value}>email: {session.user.email}</Text>
              </>
            ) : isGuest ? (
              <Text style={styles.value}>게스트 모드</Text>
            ) : (
              <Text style={styles.value}>로그인 필요</Text>
            )}
            <Text style={styles.value}>sync status: {syncStatus}</Text>
            <Text style={styles.value}>last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("ko-KR") : "-"}</Text>
            <Text style={styles.value}>pending queue: {pendingSyncCount}건</Text>
            {syncError ? <Text style={styles.errorText}>최근 오류: {syncError}</Text> : null}
          </NeumorphicCard>

          <View style={styles.row}>
            <NeumorphicButton
              label={busy ? "처리 중..." : "지금 동기화"}
              style={styles.buttonFlex}
              onPress={() => run(syncNow, "동기화를 완료했어요")}
            />
            <NeumorphicButton
              label={busy ? "처리 중..." : "로그아웃"}
              style={styles.buttonFlex}
              textStyle={{ color: COLORS.danger }}
              onPress={() => run(signOut, "로그아웃 했어요")}
            />
          </View>
        </>
      ) : null}

      {activeTab === "subscription" ? (
        <NeumorphicCard style={styles.card}>
          <Text style={styles.label}>구독</Text>
          <Text style={styles.value}>아직 구독 상품이 준비되지 않았어요.</Text>
          <Text style={styles.value}>추후 이 탭에서 플랜/결제 상태를 확인할 수 있도록 확장할 예정입니다.</Text>
        </NeumorphicCard>
      ) : null}

      {activeTab === "backup" ? (
        <>
          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>파일 백업 / 복원</Text>
            <Text style={styles.value}>앱 내부 문서 폴더에 백업 파일을 저장하고 URI로 복원할 수 있어요.</Text>
            <TextInput
              value={backupFileUri}
              onChangeText={setBackupFileUri}
              placeholder="backup file uri (예: file:///.../eerme-backup-123.json)"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.row}>
              <NeumorphicButton
                label={busy ? "처리 중..." : "파일로 저장"}
                style={styles.buttonFlex}
                onPress={() =>
                  run(async () => {
                    const json = await exportBackup();
                    const baseDir = FileSystem.documentDirectory;
                    if (!baseDir) {
                      throw new Error("파일 시스템 경로를 찾지 못했습니다.");
                    }
                    const uri = `${baseDir}${BACKUP_FILE_PREFIX}${Date.now()}.json`;
                    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
                    setBackupFileUri(uri);
                    await loadBackupFiles();
                  }, "백업 파일을 저장했어요")
                }
              />
              <NeumorphicButton
                label={busy ? "처리 중..." : "파일로 복원"}
                style={styles.buttonFlex}
                onPress={() => run(() => restoreFromFile(backupFileUri.trim()), "파일에서 복원을 완료했어요")}
              />
            </View>
            <View style={styles.row}>
              <NeumorphicButton
                label={busy ? "처리 중..." : "파일 URI 공유"}
                style={styles.buttonFlex}
                onPress={() =>
                  run(async () => {
                    if (!backupFileUri.trim()) {
                      throw new Error("공유할 파일 URI가 없습니다. 먼저 파일로 저장해 주세요.");
                    }
                    await Share.share({
                      message: `eerme backup file uri\n${backupFileUri.trim()}`,
                    });
                  }, "공유 시트를 열었어요")
                }
              />
              <NeumorphicButton
                label={busy ? "처리 중..." : "파일 URI 확인"}
                style={styles.buttonFlex}
                onPress={() =>
                  run(async () => {
                    if (!backupFileUri.trim()) {
                      throw new Error("확인할 파일 URI를 입력해 주세요.");
                    }
                    const info = await FileSystem.getInfoAsync(backupFileUri.trim());
                    if (!info.exists) {
                      throw new Error("해당 URI에 파일이 없습니다.");
                    }
                  }, "파일 URI가 유효합니다")
                }
              />
            </View>

            <View style={styles.row}>
              <NeumorphicButton
                label={busy ? "처리 중..." : "목록 새로고침"}
                style={styles.buttonFlex}
                onPress={() => run(loadBackupFiles, "백업 파일 목록을 갱신했어요")}
              />
            </View>

            {backupFiles.length === 0 ? (
              <Text style={styles.emptyText}>저장된 백업 파일이 없습니다.</Text>
            ) : (
              <View style={styles.listWrap}>
                {backupFiles.map((file) => (
                  <View key={file.uri} style={styles.fileItem}>
                    <Text style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileUri} numberOfLines={1}>
                      {file.uri}
                    </Text>
                    <View style={styles.row}>
                      <NeumorphicButton
                        label={busy ? "처리 중..." : "선택"}
                        style={styles.buttonFlex}
                        onPress={() => setBackupFileUri(file.uri)}
                      />
                      <NeumorphicButton
                        label={busy ? "처리 중..." : "복원"}
                        style={styles.buttonFlex}
                        onPress={() => run(() => restoreFromFile(file.uri), "백업 파일에서 복원을 완료했어요")}
                      />
                    </View>
                    <View style={styles.row}>
                      <NeumorphicButton
                        label={busy ? "처리 중..." : "공유"}
                        style={styles.buttonFlex}
                        onPress={() =>
                          run(async () => {
                            await Share.share({ message: file.uri });
                          }, "공유 시트를 열었어요")
                        }
                      />
                      <NeumorphicButton
                        label={busy ? "처리 중..." : "삭제"}
                        style={styles.buttonFlex}
                        textStyle={{ color: COLORS.danger }}
                        onPress={() =>
                          run(async () => {
                            await FileSystem.deleteAsync(file.uri, { idempotent: true });
                            if (backupFileUri === file.uri) {
                              setBackupFileUri("");
                            }
                            await loadBackupFiles();
                          }, "백업 파일을 삭제했어요")
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </NeumorphicCard>

          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>백업 / 복원 (JSON)</Text>
            <Text style={styles.value}>백업 JSON을 복사해 다른 기기에서 복원할 수 있어요.</Text>
            <TextInput
              value={backupText}
              onChangeText={setBackupText}
              placeholder="백업 JSON을 여기에 붙여넣거나 내보낸 내용을 확인하세요"
              placeholderTextColor="#6b7280"
              multiline
              style={styles.textArea}
            />
            <View style={styles.row}>
              <NeumorphicButton
                label={busy ? "처리 중..." : "백업 내보내기"}
                style={styles.buttonFlex}
                onPress={() =>
                  run(async () => {
                    const json = await exportBackup();
                    setBackupText(json);
                  }, "백업 데이터를 불러왔어요")
                }
              />
              <NeumorphicButton
                label={busy ? "처리 중..." : "백업 가져오기"}
                style={styles.buttonFlex}
                onPress={() => run(() => importBackup(backupText), "복원을 완료했어요")}
              />
            </View>
            <View style={styles.row}>
              <NeumorphicButton
                label={busy ? "처리 중..." : "JSON 공유"}
                style={styles.buttonFlex}
                onPress={() =>
                  run(async () => {
                    if (!backupText.trim()) {
                      throw new Error("공유할 JSON이 없습니다. 먼저 백업 내보내기를 실행해 주세요.");
                    }
                    await Share.share({ message: backupText });
                  }, "공유 시트를 열었어요")
                }
              />
            </View>
          </NeumorphicCard>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 36, gap: 14 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: COLORS.textOnDark },
  title: { color: COLORS.textOnDark, fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#d1d5db" },
  tabRow: { flexDirection: "row", gap: 8, marginTop: 2, marginBottom: 2 },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#111827",
  },
  tabButtonActive: {
    borderColor: COLORS.surface,
    backgroundColor: "#1f2937",
  },
  tabLabel: { color: "#9ca3af", fontWeight: "600" },
  tabLabelActive: { color: COLORS.surface },
  card: { borderRadius: 20 },
  label: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 6 },
  value: { color: COLORS.textOnSurface, marginBottom: 2 },
  errorText: { color: COLORS.danger, marginTop: 4 },
  input: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.softBorder,
    borderWidth: 1,
    borderRadius: 16,
    color: COLORS.primaryText,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    fontSize: 15,
  },
  textArea: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.softBorder,
    borderWidth: 1,
    borderRadius: 16,
    color: COLORS.primaryText,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    minHeight: 130,
    textAlignVertical: "top",
    fontSize: 15,
  },
  row: { flexDirection: "row", gap: 12, marginBottom: 8 },
  buttonFlex: { flex: 1 },
  brandButtonPressed: { opacity: 0.8 },
  appleSignInButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginBottom: 10,
    gap: 10,
  },
  subscriptionBadge: {
    backgroundColor: COLORS.accentLavender,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subscriptionBadgePremium: {
    backgroundColor: COLORS.accentPeach,
  },
  subscriptionBadgeText: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  subscriptionPlanName: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: "700",
  },
  subscriptionDesc: {
    color: COLORS.secondaryText,
    marginBottom: 12,
    lineHeight: 22,
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
  emptyText: { color: COLORS.textOnSurface, marginTop: 6 },
  listWrap: { marginTop: 6, gap: 8 },
  fileItem: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 10,
  },
  hintText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginBottom: 12,
  },
  socialInputLabel: {
    color: COLORS.textOnSurface,
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 6,
  },
  platformInfoText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 12,
  },
  fileName: {
    color: COLORS.primaryText,
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 4,
  },
  fileUri: {
    color: COLORS.secondaryText,
    fontSize: 12,
  },
});
