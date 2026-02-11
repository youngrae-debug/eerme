import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, MoreHorizontal, Trash2, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { formatDateDisplay, toDateKey } from "../../utils/date";
import { validateLines } from "../../utils/validate";

export default function TodayScreen() {
  const todayKey = toDateKey();
  const { entries, isReady, upsertTodayEntry, removeEntry, isPremium } = useJournalStore();
  const [isSaving, setIsSaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const todayEntry = useMemo(() => entries.find((entry) => entry.date === todayKey), [entries, todayKey]);

  const [lines, setLines] = useState<[string, string, string]>(todayEntry?.lines ?? ["", "", ""]);
  const [imageUri, setImageUri] = useState<string | null>(todayEntry?.imageUri ?? null);

  React.useEffect(() => {
    setLines(todayEntry?.lines ?? ["", "", ""]);
    setImageUri(todayEntry?.imageUri ?? null);
  }, [todayEntry]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "사진 라이브러리 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setImageUri(null);
  };

  const save = async () => {
    const validation = validateLines(lines);
    if (!validation.ok) {
      Alert.alert("입력 확인", validation.message);
      return;
    }

    setIsSaving(true);
    try {
      await upsertTodayEntry(validation.value, imageUri);
      Alert.alert("저장 완료", "오늘의 세 줄이 저장되었어요.");
    } catch (error) {
      Alert.alert("오류", "저장 중 문제가 발생했어요.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!todayEntry) {
      setLines(["", "", ""]);
      setImageUri(null);
      return;
    }

    setIsSaving(true);
    try {
      await removeEntry(todayEntry.id);
    } catch (error) {
      Alert.alert("오류", "삭제 중 문제가 발생했어요.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>저장된 기록을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      <Text style={styles.subtitle}>{formatDateDisplay(todayKey)}의 세 줄</Text>

      <NeumorphicCard style={styles.editorCard}>
        {/* Image Picker */}
        <View style={styles.imageSection}>
          <View style={styles.imageLabelRow}>
            <Text style={styles.imageLabel}>오늘의 사진</Text>
            {todayEntry && (
              <View style={styles.menuWrapper}>
                <Pressable onPress={() => setMenuVisible(!menuVisible)} style={styles.menuButton}>
                  <MoreHorizontal size={20} color={COLORS.secondaryText} />
                </Pressable>
                {menuVisible && (
                <View style={styles.dropdownMenu}>
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuVisible(false);
                      Alert.alert(
                        "삭제 확인",
                        "오늘의 기록을 삭제하시겠습니까?",
                        [
                          { text: "취소", style: "cancel" },
                          { text: "삭제", style: "destructive", onPress: remove },
                        ]
                      );
                    }}
                  >
                    <Trash2 size={18} color={COLORS.danger} />
                    <Text style={styles.menuItemTextDanger}>삭제</Text>
                  </Pressable>
                </View>
              )}
              </View>
            )}
          </View>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
              <Pressable onPress={removeImage} style={styles.removeImageButton}>
                <X size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={pickImage} style={styles.imagePlaceholder}>
              <ImagePlus size={24} color={COLORS.secondaryText} />
              <Text style={styles.imagePlaceholderText}>사진 추가</Text>
            </Pressable>
          )}
        </View>

        {lines.map((line, index) => (
          <TextInput
            key={index}
            value={line}
            onChangeText={(text) => {
              const next = [...lines] as [string, string, string];
              next[index] = text;
              setLines(next);
            }}
            placeholder={`${index + 1}번째 줄을 적어보세요`}
            placeholderTextColor={COLORS.secondaryText}
            maxLength={120}
            style={styles.input}
          />
        ))}
      </NeumorphicCard>

      <View style={styles.actions}>
        <NeumorphicButton label={isSaving ? "저장 중..." : "저장"} onPress={save} style={styles.buttonFlex} />
      </View>

      <Text style={styles.listTitle}>최근 기록</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>아직 기록이 없어요. 오늘 첫 줄을 남겨보세요.</Text>
      ) : (
        entries.slice(0, 7).map((entry) => (
          <NeumorphicCard key={entry.id} style={styles.listCard}>
            {entry.imageUri && (
              <Image source={{ uri: entry.imageUri }} style={styles.listImage} contentFit="cover" />
            )}
            <Text style={styles.dateLabel}>{formatDateDisplay(entry.date)}</Text>
            {(entry.lines ?? []).filter(Boolean).map((line, idx) => (
              <Text key={`${entry.id}-${idx}`} style={styles.lineText}>
                • {line}
              </Text>
            ))}
          </NeumorphicCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 16, paddingBottom: 42 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: COLORS.secondaryText, fontSize: 15 },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
    marginBottom: 4,
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
  title: { color: COLORS.primaryText, fontSize: 32, fontWeight: "800" },
  subtitle: { color: COLORS.secondaryText, fontSize: 15, marginBottom: 8 },
  editorCard: { borderRadius: 24 },
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
  imageSection: {
    marginBottom: 14,
  },
  imageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  imageLabel: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: "600",
  },
  imagePreviewContainer: {
    position: "relative",
    alignSelf: "flex-start",
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderStyle: "dashed",
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  imagePlaceholderText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "500",
  },
  actions: { flexDirection: "row", gap: 12, marginVertical: 4, alignItems: "center" },
  buttonFlex: { flex: 1 },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuWrapper: {
    position: "relative",
  },
  dropdownMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    minWidth: 120,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  menuItemTextDanger: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "600",
  },
  listTitle: { color: COLORS.primaryText, fontSize: 18, fontWeight: "700", marginTop: 8 },
  listCard: { borderRadius: 24, marginTop: 8 },
  listImage: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    marginBottom: 10,
  },
  dateLabel: { color: COLORS.primaryText, fontWeight: "600", marginBottom: 6 },
  lineText: { color: COLORS.secondaryText, lineHeight: 22 },
  empty: { color: COLORS.secondaryText },
});
