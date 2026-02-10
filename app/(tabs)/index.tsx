import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { formatDateDisplay, toDateKey } from "../../utils/date";
import { validateLines } from "../../utils/validate";

export default function TodayScreen() {
  const todayKey = toDateKey();
  const { entries, isReady, upsertTodayEntry, removeEntry } = useJournalStore();
  const [isSaving, setIsSaving] = useState(false);

  const todayEntry = useMemo(() => entries.find((entry) => entry.date === todayKey), [entries, todayKey]);

  const [lines, setLines] = useState<[string, string, string]>(todayEntry?.lines ?? ["", "", ""]);

  React.useEffect(() => {
    setLines(todayEntry?.lines ?? ["", "", ""]);
  }, [todayEntry]);

  const save = async () => {
    const validation = validateLines(lines);
    if (!validation.ok) {
      Alert.alert("입력 확인", validation.message);
      return;
    }

    setIsSaving(true);
    try {
      await upsertTodayEntry(validation.value);
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
      <Text style={styles.title}>eerme</Text>
      <Text style={styles.subtitle}>{formatDateDisplay(todayKey)}의 세 줄</Text>

      <NeumorphicCard style={styles.editorCard}>
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
            placeholderTextColor="#6b7280"
            maxLength={120}
            style={styles.input}
          />
        ))}
      </NeumorphicCard>

      <View style={styles.actions}>
        <NeumorphicButton label={isSaving ? "저장 중..." : "저장"} onPress={save} style={styles.buttonFlex} />
        <NeumorphicButton
          label={isSaving ? "처리 중..." : "삭제"}
          style={styles.buttonFlex}
          textStyle={{ color: COLORS.danger }}
          onPress={remove}
        />
      </View>

      <Text style={styles.listTitle}>최근 기록</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>아직 기록이 없어요. 오늘 첫 줄을 남겨보세요.</Text>
      ) : (
        entries.slice(0, 7).map((entry) => (
          <NeumorphicCard key={entry.id} style={styles.listCard}>
            <Text style={styles.dateLabel}>{formatDateDisplay(entry.date)}</Text>
            {entry.lines.filter(Boolean).map((line) => (
              <Text key={`${entry.id}-${line}`} style={styles.lineText}>
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
  content: { padding: 20, gap: 14, paddingBottom: 42 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: COLORS.textOnDark },
  title: { color: COLORS.textOnDark, fontSize: 32, fontWeight: "800" },
  subtitle: { color: "#718096", fontSize: 15, marginBottom: 8 },
  editorCard: { borderRadius: 26 },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 12,
    color: COLORS.textOnSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  actions: { flexDirection: "row", gap: 12, marginVertical: 4 },
  buttonFlex: { flex: 1 },
  listTitle: { color: COLORS.textOnDark, fontSize: 18, fontWeight: "700", marginTop: 8 },
  listCard: { borderRadius: 20, marginTop: 8 },
  dateLabel: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 6 },
  lineText: { color: COLORS.textOnSurface, lineHeight: 20 },
  empty: { color: "#a0aec0" },
});
