import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { getJournalStats } from "../../utils/stats";

export default function StatsScreen() {
  const { entries, isReady } = useJournalStore();
  const stats = React.useMemo(() => getJournalStats(entries), [entries]);

  if (!isReady) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>통계를 계산하는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>통계</Text>
      <Text style={styles.subtitle}>작성 습관을 빠르게 확인해 보세요.</Text>

      <View style={styles.metricRow}>
        <NeumorphicCard style={[styles.metricCard, styles.metricHalf]}>
          <Text style={styles.metricLabel}>이번 달 기록일</Text>
          <Text style={styles.metricValue}>{stats.monthlyActiveDays}일</Text>
        </NeumorphicCard>

        <NeumorphicCard style={[styles.metricCard, styles.metricHalf]}>
          <Text style={styles.metricLabel}>연속 기록</Text>
          <Text style={styles.metricValue}>{stats.streakDays}일</Text>
        </NeumorphicCard>
      </View>

      <View style={styles.metricRow}>
        <NeumorphicCard style={[styles.metricCard, styles.metricHalf]}>
          <Text style={styles.metricLabel}>이번 달 문장 수</Text>
          <Text style={styles.metricValue}>{stats.monthlyLineCount}줄</Text>
        </NeumorphicCard>

        <NeumorphicCard style={[styles.metricCard, styles.metricHalf]}>
          <Text style={styles.metricLabel}>총 문장 수</Text>
          <Text style={styles.metricValue}>{stats.totalLineCount}줄</Text>
        </NeumorphicCard>
      </View>

      <NeumorphicCard style={styles.metricCard}>
        <Text style={styles.metricLabel}>자주 쓴 키워드</Text>
        {stats.topKeywords.length === 0 ? (
          <Text style={styles.emptyText}>아직 분석할 키워드가 없어요.</Text>
        ) : (
          stats.topKeywords.map((item, index) => (
            <View style={styles.keywordRow} key={item.keyword}>
              <Text style={styles.keywordText}>{index + 1}. {item.keyword}</Text>
              <Text style={styles.keywordCount}>{item.count}회</Text>
            </View>
          ))
        )}
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
  metricRow: { flexDirection: "row", gap: 10 },
  metricCard: { borderRadius: 20 },
  metricHalf: { flex: 1 },
  metricLabel: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 8 },
  metricValue: { color: COLORS.textOnSurface, fontSize: 28, fontWeight: "800" },
  emptyText: { color: COLORS.textOnSurface },
  keywordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d1d5db",
  },
  keywordText: { color: COLORS.textOnSurface, fontWeight: "600" },
  keywordCount: { color: COLORS.textOnSurface },
});
