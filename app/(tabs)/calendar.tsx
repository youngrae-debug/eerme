import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { ImagePlus, MoreVertical, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { formatDateDisplay, formatMonthTitle, toDateKey } from "../../utils/date";
import { t, tList, useLocale } from "../../utils/i18n";

type CalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  hasEntry: boolean;
  imageUri?: string | null;
  imageUris?: string[];
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
      imageUri: entry?.imageUris?.[0] ?? entry?.imageUri,
      imageUris: entry?.imageUris,
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
      imageUri: entry?.imageUris?.[0] ?? entry?.imageUri,
      imageUris: entry?.imageUris,
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
      imageUri: entry?.imageUris?.[0] ?? entry?.imageUri,
      imageUris: entry?.imageUris,
      isFuture: dateKey > todayKey,
    });
  }

  return { year, month, days };
}

export default function CalendarScreen() {
  const { entries, isReady, upsertEntry, removeEntry, isPremium } = useJournalStore();
  const locale = useLocale();
  const { date } = useLocalSearchParams<{ date?: string }>();
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

  React.useEffect(() => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return;
    }
    if (entryMap.has(date)) {
      setSelectedDate(date);
    }
  }, [date, entryMap]);

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
        <Text style={styles.loading}>{t("loadingRecords")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} key={locale}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 프리미엄 배지 */}
        {isPremium && (
          <View style={styles.premiumBadge}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.premiumLogo}
              contentFit="contain"
            />
            <Text style={styles.premiumText}>{t("premiumBadge")}</Text>
          </View>
        )}

        {months.map((monthData) => (
          <View key={`${monthData.year}-${monthData.month}`} style={styles.monthContainer}>
            {/* 월 헤더 */}
            <Text style={styles.monthTitle}>{formatMonthTitle(monthData.year, monthData.month)}</Text>

            {/* 요일 헤더 */}
            <View style={styles.weekDays}>
              {tList("weekdaysShort").map((day, index) => (
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
}: {
  visible: boolean;
  dateKey: string | null;
  entry: Entry | null | undefined;
  isPremium: boolean;
  onClose: () => void;
  onSave: (date: string, lines: [string, string, string], imageUri?: string | null, imageUris?: string[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  React.useEffect(() => {
    if (entry) {
      setLine1(entry.lines[0] || "");
      setLine2(entry.lines[1] || "");
      setLine3(entry.lines[2] || "");
      setImageUris(entry.imageUris?.length ? entry.imageUris : entry.imageUri ? [entry.imageUri] : []);
      setIsEditing(false);
      setIsMenuOpen(false);
    } else if (visible) {
      setLine1("");
      setLine2("");
      setLine3("");
      setImageUris([]);
      setIsEditing(true);
      setIsMenuOpen(false);
    }
  }, [entry, visible]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permissionTitle"), t("permissionPhotoBody"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const nextUri = result.assets[0].uri;
      setImageUris((prev) => {
        if (isPremium) {
          if (prev.length >= 5) {
            Alert.alert(t("premiumTitle"), t("premiumLimitBody"));
            return prev;
          }
          return [...prev, nextUri];
        }

        return [nextUri];
      });
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!dateKey) return;
    await onSave(dateKey, [line1, line2, line3], imageUris[0] ?? null, imageUris);
    onClose();
  };


  const handleEdit = () => {
    setIsMenuOpen(false);
    setIsEditing(true);
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    Alert.alert(t("entryDeleteTitle"), t("entryDeleteConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
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
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
      >
        <View style={styles.modalContent}>
          {isMenuOpen && <Pressable style={styles.menuBackdrop} onPress={() => setIsMenuOpen(false)} />}

          {/* 헤더 */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{formatDateDisplay(dateKey)}</Text>
            <View style={styles.headerActions}>
              {entry && !isEditing && (
                <View style={[styles.menuWrapper, isMenuOpen && styles.menuWrapperOpen]}>
                  <Pressable
                    onPress={() => setIsMenuOpen((prev) => !prev)}
                    style={styles.iconButton}
                  >
                    <MoreVertical size={22} color={COLORS.primaryText} />
                  </Pressable>
                  {isMenuOpen && (
                    <View style={styles.menuDropdown}>
                      <Pressable onPress={handleEdit} style={styles.menuItem}>
                        <Text style={styles.menuItemText}>{t("edit")}</Text>
                      </Pressable>
                      <Pressable onPress={handleDelete} style={[styles.menuItem, styles.menuItemDanger]}>
                        <Text style={[styles.menuItemText, styles.menuItemDangerText]}>{t("delete")}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
              <Pressable onPress={onClose} style={styles.iconButton} hitSlop={8}>
                <X size={24} color={COLORS.primaryText} />
              </Pressable>
            </View>
          </View>

          {/* 내용 */}
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentInsetAdjustmentBehavior="always"
            automaticallyAdjustKeyboardInsets
          >
            {/* Image section */}
            <View style={styles.inputContainer}>
              {imageUris.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalImageList}>
                  {imageUris.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.modalImageContainer}>
                      <Image source={{ uri }} style={styles.modalImage} contentFit="cover" />
                      {isEditing && (
                        <Pressable onPress={() => removeImage(index)} style={styles.removeModalImageButton} hitSlop={10}>
                          <X size={16} color="#fff" />
                        </Pressable>
                      )}
                    </View>
                  ))}
                  {isEditing && (isPremium ? imageUris.length < 5 : imageUris.length < 1) ? (
                    <Pressable onPress={pickImage} style={styles.addImageButton}>
                      <ImagePlus size={24} color={COLORS.secondaryText} />
                      <Text style={styles.addImageText}>{t("imageAdd")}</Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              ) : isEditing ? (
                <Pressable onPress={pickImage} style={styles.addImageButton}>
                  <ImagePlus size={24} color={COLORS.secondaryText} />
                  <Text style={styles.addImageText}>{t("imageAdd")}</Text>
                </Pressable>
              ) : (
                <Text style={styles.noImageText}>{t("imageNone")}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={line1}
                  onChangeText={setLine1}
                  placeholder={t("line1Placeholder")}
                  placeholderTextColor={COLORS.secondaryText}
                  editable={isEditing}
                  multiline
                />
              ) : (
                <Text style={styles.readonlyText}>{line1 || " "}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={line2}
                  onChangeText={setLine2}
                  placeholder={t("line2Placeholder")}
                  placeholderTextColor={COLORS.secondaryText}
                  editable={isEditing}
                  multiline
                />
              ) : (
                <Text style={styles.readonlyText}>{line2 || " "}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={line3}
                  onChangeText={setLine3}
                  placeholder={t("line3Placeholder")}
                  placeholderTextColor={COLORS.secondaryText}
                  editable={isEditing}
                  multiline
                />
              ) : (
                <Text style={styles.readonlyText}>{line3 || " "}</Text>
              )}
            </View>
          </ScrollView>

          {/* 버튼 */}
          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 16 }]}>
            {canSave && (
              <Pressable onPress={handleSave} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>{t("save")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
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
    position: "relative",
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.softBorder,
    backgroundColor: COLORS.background,
    zIndex: 20,
    elevation: 20,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  menuWrapper: {
    position: "relative",
  },
  menuWrapperOpen: {
    zIndex: 40,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  menuDropdown: {
    position: "absolute",
    top: 40,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    minWidth: 110,
    overflow: "hidden",
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  menuItem: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  menuItemText: {
    fontSize: 14,
    color: COLORS.primaryText,
    fontWeight: "600",
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: COLORS.softBorder,
  },
  menuItemDangerText: {
    color: COLORS.danger,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primaryText,
  },

  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalBodyContent: {
    paddingBottom: 20,
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
  readonlyText: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 16,
    color: COLORS.primaryText,
    lineHeight: 22,
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
  modalImageList: { gap: 10 },
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
    top: -10,
    right: -10,
    width: 32,
    height: 32,
    borderRadius: 16,
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
  imageLimitText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 8,
  },
  noImageText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    paddingVertical: 8,
  },
});
