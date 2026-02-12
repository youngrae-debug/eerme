import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import React from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";

const BACKUP_FILE_PREFIX = "eerme-backup-";

type BackupFileItem = {
  uri: string;
  name: string;
};

type TabKey = "status" | "subscription" | "login" | "backup";

const TABS: { key: TabKey; label: string }[] = [
  { key: "status", label: "상태" },
  { key: "subscription", label: "구독" },
  { key: "login", label: "로그인" },
  { key: "backup", label: "백업" },
];

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
    signInWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut,
    syncNow,
    exportBackup,
    importBackup,
  } = useJournalStore();

  const [activeTab, setActiveTab] = React.useState<TabKey>("status");
  const [selectedPlan, setSelectedPlan] = React.useState<"free" | "premium">(isPremium ? "premium" : "free");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [tokenInput, setTokenInput] = React.useState("");
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
      {/* 프리미엄 배지 */}
      {isPremium && (
        <View style={styles.premiumBadge}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.premiumLogo}
            contentFit="contain"
          />
          <Text style={styles.premiumText}>Premium</Text>
        </View>
      )}

      <Text style={styles.title}>든든한 계정 시스템</Text>
      <Text style={styles.subtitle}>
        내 계정에 기록을 저장하고 언제든 로그인해 불러올 수 있어요
      </Text>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "status" && (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>내 정보</Text>
            {session ? (
              <>
                <Text style={styles.infoText}>닉네임: {session.user.email?.split("@")[0] ?? "사용자"}</Text>
                <Text style={[styles.infoText, { marginTop: 6 }]}>이메일: {session.user.email}</Text>
              </>
            ) : (
              <Text style={styles.infoText}>로그인이 필요합니다</Text>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>나의 기록</Text>
            <Text style={styles.infoText}>기록 수: {entries.length}개</Text>
            <Text style={[styles.infoText, { marginTop: 6 }]}>
              총 문장 수: {entries.reduce((sum, e) => sum + e.lines.filter(l => l.trim()).length, 0)}줄
            </Text>
          </View>

          <NeumorphicCard style={styles.card}>
            <Text style={styles.cardTitle}>동기화 상태</Text>
            <Text style={styles.value}>상태: {syncStatus === "idle" ? "대기중" : syncStatus === "syncing" ? "동기화중" : "오류"}</Text>
            <Text style={styles.value}>
              마지막 동기화: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("ko-KR") : "-"}
            </Text>
            <Text style={styles.value}>대기 중: {pendingSyncCount}건</Text>
            {syncError ? <Text style={styles.errorText}>오류: {syncError}</Text> : null}
            <View style={[styles.row, { marginTop: 12 }]}>
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
          </NeumorphicCard>
        </>
      )}

      {activeTab === "subscription" && (
        <NeumorphicCard style={styles.card}>
          <Text style={styles.label}>구독</Text>
          {/* 플랜 선택 버튼 */}
          <Text style={styles.planSelectLabel}>플랜 선택</Text>
          <View style={styles.planSelectRow}>
            <TouchableOpacity
              style={[styles.planOption, selectedPlan === "free" && styles.planOptionSelected]}
              onPress={() => setSelectedPlan("free")}
            >
              <Text style={[styles.planOptionText, selectedPlan === "free" && styles.planOptionTextSelected]}>무료</Text>
              <Text style={[styles.planOptionPrice, selectedPlan === "free" && styles.planOptionPriceSelected]}>$0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.planOption, selectedPlan === "premium" && styles.planOptionSelected]}
              onPress={() => setSelectedPlan("premium")}
            >
              <Text style={[styles.planOptionText, selectedPlan === "premium" && styles.planOptionTextSelected]}>프리미엄</Text>
              <Text style={[styles.planOptionPrice, selectedPlan === "premium" && styles.planOptionPriceSelected]}>$3/월</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.subscriptionHeader}>
            <View style={[styles.subscriptionBadge, selectedPlan === "premium" && styles.subscriptionBadgePremium]}>
              <Text style={styles.subscriptionBadgeText}>{selectedPlan === "premium" ? "PREMIUM" : "FREE"}</Text>
            </View>
            <Text style={styles.subscriptionPlanName}>{selectedPlan === "premium" ? "프리미엄 플랜" : "무료 플랜"}</Text>
            <Text style={styles.subscriptionPrice}>{selectedPlan === "premium" ? "$3/월" : "$0"}</Text>
          </View>

          <Text style={styles.subscriptionDesc}>
            {selectedPlan === "premium"
              ? "모든 프리미엄 기능을 이용할 수 있습니다."
              : "기본 기능을 무료로 이용할 수 있어요.\n프리미엄으로 업그레이드하면 더 많은 기능을 이용할 수 있습니다."
            }
          </Text>

          <View style={styles.subscriptionFeatures}>
            <Text style={styles.subscriptionFeatureItem}>✓ 일기 작성 및 저장</Text>
            <Text style={styles.subscriptionFeatureItem}>✓ 캘린더 보기</Text>
            <Text style={styles.subscriptionFeatureItem}>✓ 로컬 백업</Text>
            <Text style={selectedPlan === "premium" ? styles.subscriptionFeatureItem : styles.subscriptionFeatureItemLocked}>
              {selectedPlan === "premium" ? "✓" : "✗"} 클라우드 동기화
            </Text>
            <Text style={selectedPlan === "premium" ? styles.subscriptionFeatureItem : styles.subscriptionFeatureItemLocked}>
              {selectedPlan === "premium" ? "✓" : "✗"} 고급 통계
            </Text>
            <Text style={selectedPlan === "premium" ? styles.subscriptionFeatureItem : styles.subscriptionFeatureItemLocked}>
              {selectedPlan === "premium" ? "✓" : "✗"} 테마 커스터마이징
            </Text>
          </View>

          {selectedPlan === "premium" && !isPremium && (
            <NeumorphicButton
              label="프리미엄 업그레이드"
              style={{ marginTop: 12 }}
              onPress={() => {
                Alert.alert(
                  "프리미엄 구독",
                  "프리미엄을 구독하시겠습니까?\n\n• 과거 일기 수정/삭제 무제한\n• 광고 없이 이용",
                  [
                    { text: "취소", style: "cancel" },
                    {
                      text: "구독하기",
                      onPress: () => {
                        setPremium(true);
                        Alert.alert("프리미엄", "프리미엄 기능이 활성화되었습니다!");
                      },
                    },
                  ]
                );
              }}
            />
          )}
          {selectedPlan === "free" && isPremium && (
            <NeumorphicButton
              label="무료 플랜으로 변경"
              style={{ marginTop: 12 }}
              textStyle={{ color: COLORS.secondaryText }}
              onPress={() => {
                Alert.alert(
                  "플랜 변경",
                  "무료 플랜으로 변경하시겠습니까?\n\n프리미엄 기능을 더 이상 이용할 수 없습니다.",
                  [
                    { text: "취소", style: "cancel" },
                    {
                      text: "변경하기",
                      onPress: () => {
                        setPremium(false);
                        Alert.alert("플랜 변경", "무료 플랜으로 변경되었습니다.");
                      },
                    },
                  ]
                );
              }}
            />
          )}
        </NeumorphicCard>
      )}

      {activeTab === "login" && (
        <>
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
            <Text style={styles.label}>Apple / Google 로그인 (identity token)</Text>
            <TextInput
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="identity token"
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.row}>
              <NeumorphicButton
                label={busy ? "처리 중..." : "Apple 로그인"}
                style={styles.buttonFlex}
                onPress={() => run(() => signInWithApple(tokenInput.trim()), "Apple 로그인 성공")}
              />
              <NeumorphicButton
                label={busy ? "처리 중..." : "Google 로그인"}
                style={styles.buttonFlex}
                onPress={() => run(() => signInWithGoogle(tokenInput.trim()), "Google 로그인 성공")}
              />
            </View>
          </NeumorphicCard>
        </>
      )}

      {activeTab === "backup" && (
        <>
          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>파일 백업 / 복원</Text>
            <Text style={styles.value}>앱 내부 문서 폴더에 백업 파일을 저장하고 URI로 복원할 수 있어요.</Text>
            <TextInput
              value={backupFileUri}
              onChangeText={setBackupFileUri}
              placeholder="backup file uri (예: file:///.../eerme-backup-123.json)"
              placeholderTextColor={COLORS.secondaryText}
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
              placeholderTextColor={COLORS.secondaryText}
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
      )}
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
  loadingText: { color: COLORS.secondaryText, fontSize: 15 },
  title: { color: COLORS.primaryText, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: COLORS.secondaryText, fontSize: 14, marginBottom: 16 },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: { fontWeight: "700", marginBottom: 10, color: COLORS.primaryText, fontSize: 16 },
  infoText: { color: COLORS.secondaryText, fontSize: 14 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 4,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 16,
  },
  tabItemActive: {
    backgroundColor: '#C6B193',
  },
  tabText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: '#5A4E42',
  },
  card: { borderRadius: 26 },
  label: { color: COLORS.primaryText, fontWeight: "600", marginBottom: 6 },
  value: { color: COLORS.secondaryText, marginBottom: 2, fontSize: 14 },
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
  emptyText: { color: COLORS.secondaryText, marginTop: 6 },
  listWrap: { marginTop: 6, gap: 10 },
  fileItem: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    padding: 12,
  },
  fileName: { color: COLORS.primaryText, fontWeight: "600", marginBottom: 2 },
  fileUri: { color: COLORS.secondaryText, marginBottom: 8 },
  subscriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
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
  subscriptionFeatures: {
    marginBottom: 16,
    gap: 8,
  },
  subscriptionFeatureItem: {
    color: COLORS.primaryText,
    fontSize: 14,
  },
  subscriptionFeatureItemLocked: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  planSelectLabel: {
    color: COLORS.primaryText,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 8,
  },
  planSelectRow: {
    flexDirection: "row",
    gap: 12,
  },
  planOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.card,
  },
  planOptionSelected: {
    borderColor: COLORS.accentPeach,
    backgroundColor: "#FFF9F5",
  },
  planOptionText: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  planOptionTextSelected: {
    color: COLORS.primaryText,
  },
  planOptionPrice: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  planOptionPriceSelected: {
    color: COLORS.accentPeach,
  },
  subscriptionPrice: {
    color: COLORS.accentPeach,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: "auto",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  premiumLogo: {
    width: 28,
    height: 28,
  },
  premiumText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.accentPeach,
  },
});
