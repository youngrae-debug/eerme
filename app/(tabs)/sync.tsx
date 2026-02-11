import React from "react";
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { NeumorphicButton, NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";

const BACKUP_FILE_PREFIX = "eerme-backup-";

type BackupFileItem = {
  uri: string;
  name: string;
};

export default function SyncScreen() {
  const {
    isReady,
    session,
    isGuest,
    syncStatus,
    syncError,
    lastSyncedAt,
    pendingSyncCount,
    signInWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut,
    syncNow,
    exportBackup,
    importBackup,
  } = useJournalStore();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [appleTokenInput, setAppleTokenInput] = React.useState("");
  const [googleTokenInput, setGoogleTokenInput] = React.useState("");
  const [backupText, setBackupText] = React.useState("");
  const [backupFileUri, setBackupFileUri] = React.useState("");
  const [backupFiles, setBackupFiles] = React.useState<BackupFileItem[]>([]);
  const [busy, setBusy] = React.useState(false);

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
        <Text style={styles.loadingText}>동기화 상태를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>동기화</Text>
      <Text style={styles.subtitle}>로컬 sqlite 저장 후 백그라운드로 원격 push/pull을 수행합니다.</Text>

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
          Apple / Google 가이드라인에 맞춘 버튼 스타일입니다. 발급받은 identity token을 입력한 뒤 버튼을 눌러주세요.{"\n"}
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
          <Text style={styles.googleSignInLabel}>{busy ? "처리 중..." : "Sign in with Google"}</Text>
        </Pressable>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 36, gap: 12 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: COLORS.textOnDark },
  title: { color: COLORS.textOnDark, fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#d1d5db" },
  card: { borderRadius: 20 },
  label: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 6 },
  value: { color: COLORS.textOnSurface, marginBottom: 2 },
  errorText: { color: COLORS.danger, marginTop: 4 },
  hintText: { color: "#4b5563", marginBottom: 10, lineHeight: 18 },
  socialInputLabel: { color: COLORS.textOnSurface, fontSize: 13, marginBottom: 6, marginTop: 2 },
  platformInfoText: { color: "#6b7280", marginBottom: 12 },
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
  textArea: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 12,
    color: COLORS.textOnSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    minHeight: 130,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 10, marginBottom: 8 },
  buttonFlex: { flex: 1 },
  brandButtonPressed: { opacity: 0.8 },
  appleSignInButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  appleIcon: { color: "#FFFFFF", fontSize: 20, marginRight: 10, marginTop: -1 },
  appleSignInLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  googleSignInButton: {
    height: 48,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderColor: "#dadce0",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginBottom: 4,
  },
  googleLogoWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#dadce0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  googleLogoText: { color: "#4285F4", fontSize: 12, fontWeight: "700" },
  googleSignInLabel: { color: "#3c4043", fontSize: 15, fontWeight: "500" },
  emptyText: { color: COLORS.textOnSurface, marginTop: 6 },
  listWrap: { marginTop: 6, gap: 8 },
  fileItem: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 10,
  },
  fileName: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 2 },
  fileUri: { color: "#4b5563", marginBottom: 8 },
});
