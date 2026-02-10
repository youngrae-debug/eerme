import { Entry } from "../types/journal";

const WORD_SPLIT_REGEX = /[\s.,!?;:"'()\[\]{}<>/\\|`~@#$%^&*+=_-]+/;

export type JournalStats = {
  monthlyActiveDays: number;
  monthlyLineCount: number;
  totalLineCount: number;
  streakDays: number;
  topKeywords: Array<{ keyword: string; count: number }>;
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

  return {
    monthlyActiveDays,
    monthlyLineCount,
    totalLineCount,
    streakDays,
    topKeywords,
  };
}
