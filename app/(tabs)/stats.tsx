import { Image } from "expo-image";
import React from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { getJournalStats } from "../../utils/stats";

const screenWidth = Dimensions.get("window").width;

export default function StatsScreen() {
  const { entries, isReady, isPremium } = useJournalStore();
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

      <Text style={styles.subtitle}>작성 습관을 빠르게 확인해 보세요.</Text>

      {/* 주간 기록 현황 차트 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>주간 기록 현황</Text>
        <Text style={styles.cardDesc}>최근 7일간의 기록이에요</Text>
        <View style={styles.chartWrapper}>
          <LineChart
            data={{
              labels: stats.dailyStats.map((d) => d.label),
              datasets: [
                {
                  data: stats.dailyStats.map((d) => d.photoCount),
                  color: () => COLORS.accentPeach,
                  strokeWidth: 2,
                },
                {
                  data: stats.dailyStats.map((d) => d.lineCount),
                  color: () => COLORS.accentGreen,
                  strokeWidth: 2,
                },
              ],
              legend: ["사진", "문장"],
            }}
            width={screenWidth - 80}
            height={200}
            chartConfig={{
              backgroundColor: COLORS.card,
              backgroundGradientFrom: COLORS.card,
              backgroundGradientTo: COLORS.card,
              color: () => COLORS.secondaryText,
              labelColor: () => COLORS.secondaryText,
              decimalPlaces: 0,
              propsForDots: {
                r: "4",
                strokeWidth: "1",
              },
              propsForLabels: {
                fontSize: 11,
              },
            }}
            bezier
            style={styles.chart}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            withVerticalLines={false}
          />
        </View>
      </View>

      {/* 이번 달 문장수 / 총 문장수 카드 */}
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
  content: { padding: 20, paddingBottom: 36, gap: 14 },
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
  title: { color: COLORS.primaryText, fontSize: 28, fontWeight: "800" },
  subtitle: { color: COLORS.secondaryText, marginBottom: 8 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 20,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: { fontWeight: "700", marginBottom: 4, color: COLORS.primaryText, fontSize: 16 },
  cardDesc: { color: COLORS.secondaryText, fontSize: 13, marginBottom: 12 },
  chartWrapper: { alignItems: "center", justifyContent: "center", marginLeft: -20 },
  chart: { borderRadius: 20, marginTop: 8 },
  legendContainer: { marginTop: 12, gap: 8 },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 100,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: COLORS.secondaryText,
    fontSize: 13,
  },
  metricRow: { flexDirection: "row", gap: 12 },
  metricCard: { borderRadius: 24 },
  metricHalf: { flex: 1 },
  metricLabel: { color: COLORS.secondaryText, fontWeight: "600", marginBottom: 8 },
  metricValue: { color: COLORS.primaryText, fontSize: 28, fontWeight: "800" },
  emptyText: { color: COLORS.secondaryText },
  keywordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.softBorder,
  },
  keywordText: { color: COLORS.primaryText, fontWeight: "600" },
  keywordCount: { color: COLORS.secondaryText },
});
