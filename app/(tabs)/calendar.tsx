import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { formatDateDisplay } from "../../utils/date";

export default function CalendarScreen() {
  const { entries, isReady } = useJournalStore();


  if (!isReady) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.empty}>저장된 기록을 불러오는 중...</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>달력 요약</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>기록이 쌓이면 날짜별 요약이 보여요.</Text>
      ) : (
        entries.map((entry) => (
          <NeumorphicCard key={entry.id} style={styles.card}>
            <Text style={styles.date}>{formatDateDisplay(entry.date)}</Text>
            <Text style={styles.count}>{entry.lines.filter(Boolean).length}줄 기록</Text>
          </NeumorphicCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 32 },
  title: { color: COLORS.textOnDark, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  card: { marginBottom: 10 },
  date: { color: COLORS.textOnSurface, fontSize: 16, fontWeight: "700" },
  count: { color: COLORS.textOnSurface, marginTop: 4 },
  empty: { color: "#9ca3af" },
});
