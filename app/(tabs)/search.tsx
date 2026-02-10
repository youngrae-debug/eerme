import React from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { formatDateDisplay } from "../../utils/date";

export default function SearchScreen() {
  const [keyword, setKeyword] = React.useState("");
  const { searchEntries, isReady } = useJournalStore();

  const results = searchEntries(keyword);


  if (!isReady) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.empty}>저장된 기록을 불러오는 중...</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>검색</Text>
      <NeumorphicCard style={styles.searchCard}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="기록에서 키워드를 찾아보세요"
          placeholderTextColor="#6b7280"
          style={styles.input}
        />
      </NeumorphicCard>

      <Text style={styles.count}>검색 결과 {results.length}건</Text>
      {results.map((entry) => (
        <NeumorphicCard key={entry.id} style={styles.resultCard}>
          <Text style={styles.date}>{formatDateDisplay(entry.date)}</Text>
          {entry.lines
            .filter((line) => line && line.toLowerCase().includes(keyword.toLowerCase()))
            .map((line) => (
              <Text key={`${entry.id}-${line}`} style={styles.line}>
                • {line}
              </Text>
            ))}
        </NeumorphicCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 32, gap: 12 },
  title: { color: COLORS.textOnDark, fontSize: 28, fontWeight: "800" },
  searchCard: { borderRadius: 20 },
  input: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 12,
    color: COLORS.textOnSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  count: { color: "#d1d5db" },
  empty: { color: "#9ca3af" },
  resultCard: { borderRadius: 20 },
  date: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 4 },
  line: { color: COLORS.textOnSurface },
});
