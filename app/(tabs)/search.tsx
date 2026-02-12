import { Image } from "expo-image";
import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicCard } from "../../components/neumorphic";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { formatDateDisplay } from "../../utils/date";

export default function SearchScreen() {
  const [keyword, setKeyword] = React.useState("");
  const { searchEntries, isReady, isPremium } = useJournalStore();

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

      <NeumorphicCard style={styles.searchCard}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="기록에서 키워드를 찾아보세요"
          placeholderTextColor={COLORS.secondaryText}
          style={styles.input}
        />
      </NeumorphicCard>

      <Text style={styles.count}>검색 결과 {results.length}건</Text>
      {results.map((entry) => (
        <NeumorphicCard key={entry.id} style={styles.resultCard}>
          <Text style={styles.date}>{formatDateDisplay(entry.date)}</Text>
          {(entry.lines ?? [])
            .filter((line) => line && line.toLowerCase().includes(keyword.toLowerCase()))
            .map((line, idx) => (
              <Text key={`${entry.id}-${idx}`} style={styles.line}>
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
  content: { padding: 20, paddingBottom: 32, gap: 14 },
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
  searchCard: { borderRadius: 24 },
  input: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.softBorder,
    borderWidth: 1,
    borderRadius: 16,
    color: COLORS.primaryText,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  count: { color: COLORS.secondaryText },
  empty: { color: COLORS.secondaryText },
  resultCard: { borderRadius: 24 },
  date: { color: COLORS.primaryText, fontWeight: "600", marginBottom: 4 },
  line: { color: COLORS.secondaryText, lineHeight: 22 },
});
