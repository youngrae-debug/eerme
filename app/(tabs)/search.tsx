import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { formatDateDisplay } from "../../utils/date";
import { t, useLocale } from "../../utils/i18n";

export default function SearchScreen() {
  const locale = useLocale();
  const [keyword, setKeyword] = React.useState("");
  const { searchEntries, entries, isReady } = useJournalStore();

  const trimmedKeyword = keyword.trim();
  const results = trimmedKeyword.length === 0 ? entries : searchEntries(trimmedKeyword);

  if (!isReady) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.empty}>{t("loadingRecords")}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      key={locale}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.screenTitle}>{t("tabSearch")}</Text>
      <Text style={styles.subtitle}>{t("searchPlaceholder")}</Text>
      <View style={styles.divider} />

      <TextInput
        value={keyword}
        onChangeText={setKeyword}
        placeholder={t("searchPlaceholder")}
        placeholderTextColor={COLORS.secondaryText}
        style={styles.input}
      />

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{t("searchCount", { count: results.length })}</Text>
      </View>
      <View style={styles.divider} />

      {results.length === 0 ? (
        <Text style={styles.empty}>{t("emptyEntries")}</Text>
      ) : (
        results.map((entry) => {
          const filteredLines = (entry.lines ?? []).filter((line) => {
            if (!line) return false;
            if (trimmedKeyword.length === 0) return true;
            return line.toLowerCase().includes(trimmedKeyword.toLowerCase());
          });

          return (
            <Pressable
              key={entry.id}
              style={styles.resultItem}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/calendar",
                  params: { date: entry.date },
                })
              }
            >
              <View style={styles.resultTopRow}>
                <Text style={styles.resultTitle} numberOfLines={1}>{filteredLines[0] ?? t("emptyEntries")}</Text>
                <Text style={styles.date}>{formatDateDisplay(entry.date)}</Text>
              </View>
              {filteredLines.slice(1, 2).map((line, idx) => (
                <Text key={`${entry.id}-${idx}`} style={styles.line} numberOfLines={2}>
                  {line}
                </Text>
              ))}
              {(entry.imageUris?.[0] || entry.imageUri) ? (
                <Image
                  source={{ uri: entry.imageUris?.[0] ?? entry.imageUri ?? "" }}
                  style={styles.resultImage}
                  contentFit="cover"
                />
              ) : null}
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  screenTitle: { color: COLORS.primaryText, fontSize: 28, fontWeight: "600", marginTop: 8 },
  subtitle: { color: COLORS.secondaryText, fontSize: 14, marginTop: 12, marginBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginBottom: 18 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    color: COLORS.primaryText,
    fontSize: 16,
    marginBottom: 18,
  },
  listHeader: { marginBottom: 10 },
  listTitle: { color: COLORS.secondaryText, fontSize: 13 },
  empty: { color: COLORS.secondaryText, fontSize: 14, paddingVertical: 6 },
  resultItem: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  resultTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  resultTitle: { flex: 1, color: COLORS.primaryText, fontSize: 18, lineHeight: 26 },
  date: { color: COLORS.secondaryText, fontSize: 12, marginTop: 4 },
  line: { color: COLORS.secondaryText, lineHeight: 24, marginTop: 8, fontSize: 15 },
  resultImage: { width: "100%", height: 120, borderRadius: 6, marginTop: 10 },
});
