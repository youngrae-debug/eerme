import { Entry } from "../types/journal";

const WORD_SPLIT_REGEX = /[\s.,!?;:"'()\[\]{}<>/\\|`~@#$%^&*+=_-]+/;

export type ChartDataPoint = {
  label: string;
  value: number;
};

export type DailyData = {
  date: string;
  label: string;
  photoCount: number;
  lineCount: number;
  hasRecord: boolean;
};

export type JournalStats = {
  monthlyActiveDays: number;
  monthlyLineCount: number;
  totalLineCount: number;
  streakDays: number;
  topKeywords: Array<{ keyword: string; count: number }>;
  chartData: ChartDataPoint[];
  monthlyGrowth: number;
  // 주간 통계
  weeklyPhotoCount: number;
  weeklyLineCount: number;
  weeklyActiveDays: number;
  weeklyStreakDays: number;
  // 일별 데이터 (최근 7일)
  dailyStats: DailyData[];
};

const toMidnight = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

export function getJournalStats(entries: Entry[], now: Date = new Date()): JournalStats {
  const thisMonth = now.toISOString().slice(0, 7);

  const monthlyEntries = entries.filter((entry) => entry.date.startsWith(thisMonth));
  const monthlyActiveDays = new Set(monthlyEntries.map((entry) => entry.date)).size;

  const countLines = (targetEntries: Entry[]) =>
    targetEntries.reduce(
      (sum, entry) => sum + entry.lines.filter((line) => line.trim().length > 0).length,
      0,
    );

  const totalLineCount = countLines(entries);
  const monthlyLineCount = countLines(monthlyEntries);

  const uniqueDates = [...new Set(entries.map((entry) => entry.date))].sort((a, b) => b.localeCompare(a));
  let streakDays = 0;
  if (uniqueDates.length > 0) {
    const today = toMidnight(now.toISOString().slice(0, 10));
    for (let i = 0; i < uniqueDates.length; i += 1) {
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      const expectedKey = expected.toISOString().slice(0, 10);
      if (uniqueDates[i] === expectedKey) {
        streakDays += 1;
      } else {
        break;
      }
    }
  }

  const keywordCount = new Map<string, number>();
  entries.forEach((entry) => {
    entry.lines.forEach((line) => {
      line
        .toLowerCase()
        .split(WORD_SPLIT_REGEX)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2)
        .forEach((word) => {
          keywordCount.set(word, (keywordCount.get(word) ?? 0) + 1);
        });
    });
  });

  const topKeywords = [...keywordCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([keyword, count]) => ({ keyword, count }));

  // 이번 달 일별 기록 수 (차트용)
  const dailyLineCountMap = new Map<string, number>();
  monthlyEntries.forEach((entry) => {
    const day = entry.date.slice(8, 10);
    const lineCount = entry.lines.filter((line) => line.trim().length > 0).length;
    dailyLineCountMap.set(day, (dailyLineCountMap.get(day) ?? 0) + lineCount);
  });

  const sortedDays = [...dailyLineCountMap.keys()].sort((a, b) => parseInt(a) - parseInt(b));
  const chartData: ChartDataPoint[] = sortedDays.map((day) => ({
    label: `${parseInt(day)}`,
    value: dailyLineCountMap.get(day) ?? 0,
  }));

  // 지난 달 대비 성장률 계산
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const lastMonthEntries = entries.filter((entry) => entry.date.startsWith(lastMonth));
  const lastMonthLineCount = countLines(lastMonthEntries);
  const monthlyGrowth = lastMonthLineCount > 0
    ? Math.round(((monthlyLineCount - lastMonthLineCount) / lastMonthLineCount) * 100)
    : monthlyLineCount > 0 ? 100 : 0;

  // 주간 통계 계산 (최근 7일)
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = weekStart.toISOString().slice(0, 10);
  const todayKey = now.toISOString().slice(0, 10);

  const weeklyEntries = entries.filter((entry) => {
    return entry.date >= weekStartKey && entry.date <= todayKey;
  });

  const weeklyPhotoCount = weeklyEntries.filter((entry) => entry.imageUri).length;
  const weeklyLineCount = countLines(weeklyEntries);
  const weeklyActiveDays = new Set(weeklyEntries.map((entry) => entry.date)).size;

  // 주간 연속 기록일 계산
  let weeklyStreakDays = 0;
  const weeklyUniqueDates = [...new Set(weeklyEntries.map((entry) => entry.date))].sort((a, b) => b.localeCompare(a));
  if (weeklyUniqueDates.length > 0) {
    const todayMidnight = toMidnight(todayKey);
    for (let i = 0; i < 7; i += 1) {
      const expected = new Date(todayMidnight);
      expected.setDate(todayMidnight.getDate() - i);
      const expectedKey = expected.toISOString().slice(0, 10);
      if (weeklyUniqueDates.includes(expectedKey)) {
        weeklyStreakDays += 1;
      } else {
        break;
      }
    }
  }

  // 일별 데이터 (최근 7일)
  const dailyStats: DailyData[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - i);
    const dateKey = targetDate.toISOString().slice(0, 10);
    const dayLabel = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
    
    const dayEntries = entries.filter((entry) => entry.date === dateKey);
    const photoCount = dayEntries.filter((entry) => entry.imageUri).length;
    const lineCount = dayEntries.reduce(
      (sum, entry) => sum + entry.lines.filter((line) => line.trim().length > 0).length,
      0,
    );
    const hasRecord = dayEntries.length > 0;
    
    dailyStats.push({
      date: dateKey,
      label: dayLabel,
      photoCount,
      lineCount,
      hasRecord,
    });
  }

  return {
    monthlyActiveDays,
    monthlyLineCount,
    totalLineCount,
    streakDays,
    topKeywords,
    chartData,
    monthlyGrowth,
    weeklyPhotoCount,
    weeklyLineCount,
    weeklyActiveDays,
    weeklyStreakDays,
    dailyStats,
  };
}
