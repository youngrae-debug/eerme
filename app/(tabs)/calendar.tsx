import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
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
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { Entry } from "../../types/journal";
import { formatDateDisplay, toDateKey } from "../../utils/date";

type CalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  hasEntry: boolean;
};

export default function CalendarScreen() {
  const { entries, isReady, upsertEntry, removeEntry } = useJournalStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false); // TODO: 실제 프리미엄 상태로 연결

  const entryMap = useMemo(() => {
    const map = new Map<string, Entry>();
    entries.forEach((entry) => {
      map.set(entry.date, entry);
    });
    return map;
  }, [entries]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: CalendarDay[] = [];

    // 이전 달의 마지막 날들
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      const dateKey = toDateKey(date);
      days.push({
        date,
        dateKey,
        isCurrentMonth: false,
        hasEntry: entryMap.has(dateKey),
      });
    }

    // 현재 달
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = toDateKey(date);
      days.push({
        date,
        dateKey,
        isCurrentMonth: true,
        hasEntry: entryMap.has(dateKey),
      });
    }

    // 다음 달의 첫 날들 (6주 달력을 만들기 위해)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateKey = toDateKey(date);
      days.push({
        date,
        dateKey,
        isCurrentMonth: false,
        hasEntry: entryMap.has(dateKey),
      });
    }

    return days;
  }, [currentDate, entryMap]);

  const selectedEntry = selectedDate ? entryMap.get(selectedDate) : null;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDayPress = (day: CalendarDay) => {
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
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable onPress={handlePrevMonth} style={styles.navButton}>
            <ChevronLeft size={28} color={COLORS.textOnDark} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </Text>
          <Pressable onPress={handleNextMonth} style={styles.navButton}>
            <ChevronRight size={28} color={COLORS.textOnDark} />
          </Pressable>
        </View>

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
          {calendarDays.map((day, index) => (
            <Pressable
              key={index}
              onPress={() => handleDayPress(day)}
              style={styles.dayCell}
            >
              <View
                style={[
                  styles.dayContent,
                  !day.isCurrentMonth && styles.otherMonthDay,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !day.isCurrentMonth && styles.otherMonthText,
                    day.date.getDay() === 0 && styles.sundayText,
                    day.date.getDay() === 6 && styles.saturdayText,
                    day.dateKey === toDateKey() && styles.todayText,
                  ]}
                >
                  {day.date.getDate()}
                </Text>
                {day.hasEntry && <View style={styles.entryDot} />}
              </View>
            </Pressable>
          ))}
        </View>
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
        onUpgradeToPremium={() => {
          setIsPremium(true); // TODO: 실제 결제/광고 로직
          Alert.alert("프리미엄", "프리미엄 기능이 활성화되었습니다!");
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
  onUpgradeToPremium,
}: {
  visible: boolean;
  dateKey: string | null;
  entry: Entry | null | undefined;
  isPremium: boolean;
  onClose: () => void;
  onSave: (date: string, lines: [string, string, string]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpgradeToPremium: () => void;
}) {
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    if (entry) {
      setLine1(entry.lines[0] || "");
      setLine2(entry.lines[1] || "");
      setLine3(entry.lines[2] || "");
      setIsEditing(false);
    } else if (visible) {
      setLine1("");
      setLine2("");
      setLine3("");
      setIsEditing(true);
    }
  }, [entry, visible]);

  const handleSave = async () => {
    if (!dateKey) return;
    await onSave(dateKey, [line1, line2, line3]);
    onClose();
  };

  const handleEdit = () => {
    if (!isPremium) {
      Alert.alert(
        "프리미엄 기능",
        "일기 수정 기능은 프리미엄 사용자만 이용할 수 있습니다.\n광고를 시청하거나 프리미엄을 구독하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          { text: "광고 보기", onPress: onUpgradeToPremium },
          { text: "프리미엄 구독", onPress: onUpgradeToPremium },
        ]
      );
      return;
    }
    setIsEditing(true);
  };

  const handleDelete = () => {
    if (!isPremium) {
      Alert.alert(
        "프리미엄 기능",
        "일기 삭제 기능은 프리미엄 사용자만 이용할 수 있습니다.\n광고를 시청하거나 프리미엄을 구독하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          { text: "광고 보기", onPress: onUpgradeToPremium },
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
              <X size={24} color={COLORS.textOnDark} />
            </Pressable>
          </View>

          {/* 내용 */}
          <ScrollView style={styles.modalBody}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>첫 번째 줄</Text>
              <TextInput
                style={styles.input}
                value={line1}
                onChangeText={setLine1}
                placeholder="무엇을 했나요?"
                placeholderTextColor="#a0aec0"
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
                placeholderTextColor="#a0aec0"
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
                placeholderTextColor="#a0aec0"
                editable={isEditing}
                multiline
              />
            </View>
          </ScrollView>

          {/* 버튼 */}
          <View style={styles.modalFooter}>
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
    color: "#a0aec0",
    textAlign: "center",
    marginTop: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  navButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textOnDark,
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
    color: "#4a5568",
  },
  sundayText: {
    color: "#ef4444",
  },
  saturdayText: {
    color: "#3b82f6",
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
  },
  otherMonthDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#4a5568",
  },
  otherMonthText: {
    color: "#a0aec0",
  },
  todayText: {
    color: "#6366f1",
    fontWeight: "800",
  },
  entryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    position: "absolute",
    bottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textOnDark,
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
    color: "#4a5568",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1a202c",
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  warningText: {
    color: "#f59e0b",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginLeft: 6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  editButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginRight: 6,
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginLeft: 6,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  noActionText: {
    flex: 1,
    textAlign: "center",
    color: "#a0aec0",
    fontSize: 14,
  },
});
