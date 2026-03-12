import React from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { t, useLocale } from "../../utils/i18n";
import { getJournalStats } from "../../utils/stats";

const screenWidth = Dimensions.get("window").width;

export default function StatsScreen() {
  const locale = useLocale();
  const { entries, isReady } = useJournalStore();
  const stats = React.useMemo(() => getJournalStats(entries), [entries]);
  const [chartWidth, setChartWidth] = React.useState(screenWidth - 88);

  const chartData = React.useMemo(() => {
    const labels = stats.dailyStats.map((d) => {
      const [year, month, day] = d.date.split("-").map(Number);
      const date = new Date(year, (month ?? 1) - 1, day ?? 1);
      return new Intl.DateTimeFormat(locale, {
        month: "numeric",
        day: "numeric",
      }).format(date);
    });

    const lineSeries = stats.dailyStats.map((d) => Number.isFinite(d.lineCount) ? d.lineCount : 0);
    const photoSeries = stats.dailyStats.map((d) => Number.isFinite(d.photoCount) ? d.photoCount : 0);

    return {
      labels,
      datasets: [
        {
          data: lineSeries.some((v) => v > 0) ? lineSeries : [0, 0, 0, 0, 0, 0, 0],
          color: () => COLORS.primaryText,
          strokeWidth: 2,
        },
        {
          data: photoSeries.some((v) => v > 0) ? photoSeries : [0, 0, 0, 0, 0, 0, 0],
          color: () => COLORS.secondaryText,
          strokeWidth: 2,
        },
      ],
      legend: [t("statsLegendLines"), t("statsLegendPhotos")],
    };
  }, [locale, stats.dailyStats]);

  if (!isReady) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>{t("loadingStats")}</Text>
      </View>
    );
  }

  return (
    <ScrollView key={locale} style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>{t("tabStats")}</Text>
      <Text style={styles.subtitle}>{t("statsSubtitle")}</Text>
      <View style={styles.divider} />

      <View
        style={styles.section}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width - 28;
          if (nextWidth > 240 && Math.abs(nextWidth - chartWidth) > 1) {
            setChartWidth(nextWidth);
          }
        }}
      >
        <Text style={styles.sectionTitle}>{t("statsWeeklyTitle")}</Text>
        <Text style={styles.sectionMeta}>{t("statsWeeklyDesc")}</Text>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={208}
          chartConfig={{
            backgroundColor: COLORS.surface,
            backgroundGradientFrom: COLORS.surface,
            backgroundGradientTo: COLORS.surface,
            color: () => COLORS.primaryText,
            labelColor: () => COLORS.secondaryText,
            decimalPlaces: 0,
            propsForDots: {
              r: "3",
              strokeWidth: "1",
              stroke: COLORS.surface,
            },
            propsForBackgroundLines: {
              stroke: COLORS.border,
              strokeWidth: 1,
            },
            propsForLabels: {
              fontSize: 11,
            },
          }}
          style={styles.chart}
          fromZero
          yAxisLabel=""
          yAxisSuffix=""
          withVerticalLines={false}
          withInnerLines
          withOuterLines={false}
        />
      </View>

      <View style={styles.metricRow}>
        <View style={[styles.metricBox, styles.metricHalf]}>
          <Text style={styles.metricLabel}>{t("statsMonthlyLines")}</Text>
          <Text style={styles.metricValue}>{t("statsLinesValue", { count: stats.monthlyLineCount })}</Text>
        </View>
        <View style={[styles.metricBox, styles.metricHalf]}>
          <Text style={styles.metricLabel}>{t("statsTotalLines")}</Text>
          <Text style={styles.metricValue}>{t("statsLinesValue", { count: stats.totalLineCount })}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("statsTopKeywords")}</Text>
        <View style={styles.innerDivider} />
        {stats.topKeywords.length === 0 ? (
          <Text style={styles.emptyText}>{t("statsNoKeywords")}</Text>
        ) : (
          stats.topKeywords.map((item, index) => (
            <View style={styles.keywordRow} key={item.keyword}>
              <Text style={styles.keywordText}>{index + 1}. {item.keyword}</Text>
              <Text style={styles.keywordCount}>{t("statsKeywordCount", { count: item.count })}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  loadingWrap: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center" },
  loadingText: { color: COLORS.secondaryText, fontSize: 15 },
  screenTitle: { color: COLORS.primaryText, fontSize: 28, fontWeight: "600", marginTop: 8 },
  subtitle: { color: COLORS.secondaryText, fontSize: 14, marginTop: 12, marginBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: 18 },
  section: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: { color: COLORS.primaryText, fontSize: 18, fontWeight: "500" },
  sectionMeta: { color: COLORS.secondaryText, fontSize: 13, marginTop: 4, marginBottom: 12 },
  chart: { marginLeft: -24, borderRadius: 6 },
  metricRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metricBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 14,
    backgroundColor: COLORS.surface,
  },
  metricHalf: { flex: 1 },
  metricLabel: { color: COLORS.secondaryText, fontSize: 13, marginBottom: 8 },
  metricValue: { color: COLORS.primaryText, fontSize: 20, fontWeight: "500" },
  innerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: 12 },
  emptyText: { color: COLORS.secondaryText, fontSize: 14 },
  keywordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  keywordText: { color: COLORS.primaryText, fontSize: 15 },
  keywordCount: { color: COLORS.secondaryText, fontSize: 13 },
});
