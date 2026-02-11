import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { Entry } from "../../types/journal";
import { formatDateDisplay, toDateKey } from "../../utils/date";

type CalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  hasEntry: boolean;
  imageUri?: string | null;
  isFuture: boolean;
};

type MonthData = {
  year: number;
  month: number;
  days: CalendarDay[];
};

// 월 데이터 생성 함수
function generateMonthData(year: number, month: number, entryMap: Map<string, Entry>, todayKey: string): MonthData {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days: CalendarDay[] = [];

  // 이전 달의 마지막 날들 (빈 칸)
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    const dateKey = toDateKey(date);
    const entry = entryMap.get(dateKey);
    days.push({
      date,
      dateKey,
      isCurrentMonth: false,
      hasEntry: !!entry,
      imageUri: entry?.imageUri,
      isFuture: dateKey > todayKey,
    });
  }

  // 현재 달
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);
    const entry = entryMap.get(dateKey);
    days.push({
      date,
      dateKey,
      isCurrentMonth: true,
      hasEntry: !!entry,
      imageUri: entry?.imageUri,
      isFuture: dateKey > todayKey,
    });
  }

  // 다음 달 날짜 (6주 맞추기)
  const remainingDays = 42 - days.length;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    const dateKey = toDateKey(date);
    const entry = entryMap.get(dateKey);
    days.push({
      date,
      dateKey,
      isCurrentMonth: false,
      hasEntry: !!entry,
      imageUri: entry?.imageUri,
      isFuture: dateKey > todayKey,
    });
  }

  return { year, month, days };
}

export default function CalendarScreen() {
  const { entries, isReady, upsertEntry, removeEntry, isPremium, setPremium } = useJournalStore();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const entryMap = useMemo(() => {
    const map = new Map<string, Entry>();
    entries.forEach((entry) => {
      map.set(entry.date, entry);
    });
    return map;
  }, [entries]);

  // 최근 12개월 + 현재월 생성 (위에서 아래로 최신 순)
  const months = useMemo(() => {
    const todayKey = toDateKey();
    const today = new Date();
    const result: MonthData[] = [];

    // 현재 월부터 12개월 전까지 (위에서부터 최신)
    for (let i = 0; i <= 12; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      result.push(generateMonthData(targetDate.getFullYear(), targetDate.getMonth(), entryMap, todayKey));
    }

    return result;
  }, [entryMap]);

  const selectedEntry = selectedDate ? entryMap.get(selectedDate) : null;

  const handleDayPress = (day: CalendarDay) => {
    if (day.isFuture) return;
    setSelectedDate(day.dateKey);
  };

  const handleCloseModal = () => {
    setSelectedDate(null);
  };

  if (!isReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>저장된 기록을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

        {months.map((monthData) => (
          <View key={`${monthData.year}-${monthData.month}`} style={styles.monthContainer}>
            {/* 월 헤더 */}
            <Text style={styles.monthTitle}>
              {monthData.year}년 {monthData.month + 1}월
            </Text>

            {/* 요일 헤더 */}
            <View style={styles.weekDays}>
              {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
                <Text
                  key={index}
                  style={[
                    styles.weekDayText,
                    index === 0 && styles.sundayText,
                    index === 6 && styles.saturdayText,
                  ]}
                >
                  {day}
                </Text>
              ))}
            </View>

            {/* 달력 그리드 */}
            <View style={styles.calendar}>
              {monthData.days.map((day, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleDayPress(day)}
                  style={styles.dayCell}
                  disabled={day.isFuture}
                >
                  <View
                    style={[
                      styles.dayContent,
                      !day.isCurrentMonth && styles.otherMonthDay,
                      day.isFuture && styles.futureDay,
                    ]}
                  >
                    {day.imageUri ? (
                      <Image
                        source={{ uri: day.imageUri }}
                        style={styles.dayImage}
                        contentFit="cover"
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.dayText,
                        !day.isCurrentMonth && styles.otherMonthText,
                        day.date.getDay() === 0 && styles.sundayText,
                        day.date.getDay() === 6 && styles.saturdayText,
                        day.dateKey === toDateKey() && styles.todayText,
                        day.imageUri && styles.dayTextWithImage,
                        day.isFuture && styles.futureText,
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                    {day.hasEntry && !day.imageUri && <View style={styles.entryDot} />}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 일기 보기/작성 모달 */}
      <EntryModal
        visible={selectedDate !== null}
        dateKey={selectedDate}
        entry={selectedEntry}
        isPremium={isPremium}
        onClose={handleCloseModal}
        onSave={upsertEntry}
        onDelete={removeEntry}
        onWatchAd={() => {
          // TODO: 실제 광고 시청 로직 구현
          Alert.alert("광고", "광고 시청이 완료되었습니다. 이번 작업만 허용됩니다.");
        }}
        onUpgradeToPremium={() => {
          Alert.alert(
            "프리미엄 구독",
            "프리미엄을 구독하시겠습니까?\n\n• 과거 일기 수정/삭제 무제한\n• 광고 없이 이용",
            [
              { text: "취소", style: "cancel" },
              {
                text: "구독하기",
                onPress: () => {
                  setPremium(true); // TODO: 실제 결제 로직
                  Alert.alert("프리미엄", "프리미엄 기능이 활성화되었습니다!");
                },
              },
            ]
          );
        }}
      />
    </View>
  );
}

function EntryModal({
  visible,
  dateKey,
  entry,
  isPremium,
  onClose,
  onSave,
  onDelete,
  onWatchAd,
  onUpgradeToPremium,
}: {
  visible: boolean;
  dateKey: string | null;
  entry: Entry | null | undefined;
  isPremium: boolean;
  onClose: () => void;
  onSave: (date: string, lines: [string, string, string], imageUri?: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onWatchAd: () => void;
  onUpgradeToPremium: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    if (entry) {
      setLine1(entry.lines[0] || "");
      setLine2(entry.lines[1] || "");
      setLine3(entry.lines[2] || "");
      setImageUri(entry.imageUri ?? null);
      setIsEditing(false);
    } else if (visible) {
      setLine1("");
      setLine2("");
      setLine3("");
      setImageUri(null);
      setIsEditing(true);
    }
  }, [entry, visible]);

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

  const handleSave = async () => {
    if (!dateKey) return;
    await onSave(dateKey, [line1, line2, line3], imageUri);
    onClose();
  };

  const isToday = dateKey === toDateKey();

  const handleEdit = () => {
    if (!isPremium && !isToday) {
      Alert.alert(
        "프리미엄 기능",
        "과거 일기 수정 기능은 프리미엄 사용자만 이용할 수 있습니다.\n광고를 시청하거나 프리미엄을 구독하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          { text: "광고 보기", onPress: onWatchAd },
          { text: "프리미엄 구독", onPress: onUpgradeToPremium },
        ]
      );
      return;
    }
    setIsEditing(true);
  };

  const handleDelete = () => {
    if (!isPremium && !isToday) {
      Alert.alert(
        "프리미엄 기능",
        "과거 일기 삭제 기능은 프리미엄 사용자만 이용할 수 있습니다.\n광고를 시청하거나 프리미엄을 구독하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          { text: "광고 보기", onPress: onWatchAd },
          { text: "프리미엄 구독", onPress: onUpgradeToPremium },
        ]
      );
      return;
    }

    Alert.alert("일기 삭제", "정말 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          if (entry) {
            await onDelete(entry.id);
            onClose();
          }
        },
      },
    ]);
  };

  if (!visible || !dateKey) return null;

  const canSave = isEditing;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* 헤더 */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{formatDateDisplay(dateKey)}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={COLORS.primaryText} />
            </Pressable>
          </View>

          {/* 내용 */}
          <ScrollView style={styles.modalBody}>
            {/* Image section */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>사진</Text>
              {imageUri ? (
                <View style={styles.modalImageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.modalImage} contentFit="cover" />
                  {isEditing && (
                    <Pressable onPress={removeImage} style={styles.removeModalImageButton}>
                      <X size={16} color="#fff" />
                    </Pressable>
                  )}
                </View>
              ) : isEditing ? (
                <Pressable onPress={pickImage} style={styles.addImageButton}>
                  <ImagePlus size={24} color={COLORS.secondaryText} />
                  <Text style={styles.addImageText}>사진 추가</Text>
                </Pressable>
              ) : (
                <Text style={styles.noImageText}>등록된 사진이 없습니다</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>첫 번째 줄</Text>
              <TextInput
                style={styles.input}
                value={line1}
                onChangeText={setLine1}
                placeholder="무엇을 했나요?"
                placeholderTextColor={COLORS.secondaryText}
                editable={isEditing}
                multiline
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>두 번째 줄</Text>
              <TextInput
                style={styles.input}
                value={line2}
                onChangeText={setLine2}
                placeholder="어떤 감정이 들었나요?"
                placeholderTextColor={COLORS.secondaryText}
                editable={isEditing}
                multiline
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>세 번째 줄</Text>
              <TextInput
                style={styles.input}
                value={line3}
                onChangeText={setLine3}
                placeholder="무엇을 배웠나요?"
                placeholderTextColor={COLORS.secondaryText}
                editable={isEditing}
                multiline
              />
            </View>
          </ScrollView>

          {/* 버튼 */}
          <View style={[styles.modalFooter, { paddingBottom: 20 + insets.bottom }]}>
            {entry && !isEditing && (
              <>
                <Pressable onPress={handleEdit} style={styles.editButton}>
                  <Text style={styles.editButtonText}>수정</Text>
                </Pressable>
                <Pressable onPress={handleDelete} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>삭제</Text>
                </Pressable>
              </>
            )}
            {canSave && (
              <Pressable onPress={handleSave} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>저장</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loading: {
    color: COLORS.secondaryText,
    textAlign: "center",
    marginTop: 40,
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
  scrollContent: {
    paddingBottom: 20,
  },
  monthContainer: {
    marginBottom: 24,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primaryText,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  weekDays: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.secondaryText,
  },
  sundayText: {
    color: COLORS.danger,
  },
  saturdayText: {
    color: COLORS.accentLavender,
  },
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
  },
  dayCell: {
    width: "14.28%", // 7일
    aspectRatio: 1,
    padding: 2,
  },
  dayContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  otherMonthDay: {
    opacity: 0.3,
  },
  futureDay: {
    opacity: 0.4,
  },
  futureText: {
    color: COLORS.softBorder,
  },
  dayText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.primaryText,
  },
  otherMonthText: {
    color: COLORS.secondaryText,
  },
  todayText: {
    color: COLORS.accentPink,
    fontWeight: "800",
  },
  entryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accentMint,
    position: "absolute",
    bottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.softBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primaryText,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: COLORS.primaryText,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  warningText: {
    color: COLORS.accentPeach,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.softBorder,
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#C6B193',
    borderRadius: 50,
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: {
    color: '#5A4E42',
    fontSize: 16,
    fontWeight: "600",
  },
  editButton: {
    flex: 1,
    backgroundColor: '#BFA888',
    borderRadius: 50,
    padding: 16,
    alignItems: "center",
  },
  editButtonText: {
    color: '#5A4E42',
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: COLORS.danger,
    borderRadius: 50,
    padding: 16,
    alignItems: "center",
  },
  deleteButtonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
  noActionText: {
    flex: 1,
    textAlign: "center",
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  dayImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  dayTextWithImage: {
    color: "#ffffff",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    zIndex: 1,
  },
  modalImageContainer: {
    position: "relative",
    alignSelf: "flex-start",
  },
  modalImage: {
    width: 150,
    height: 150,
    borderRadius: 16,
  },
  removeModalImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  addImageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderStyle: "dashed",
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  addImageText: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontWeight: "500",
  },
  noImageText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    paddingVertical: 8,
  },
});
