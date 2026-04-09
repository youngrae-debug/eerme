import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, MoreHorizontal, Trash2, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { formatDateDisplay, toDateKey } from "../../utils/date";
import { t, useLocale } from "../../utils/i18n";
import { validateLines } from "../../utils/validate";

export default function TodayScreen() {
  const locale = useLocale();
  const todayKey = toDateKey();
  const { entries, isReady, upsertTodayEntry, removeEntry, isPremium } = useJournalStore();
  const [isSaving, setIsSaving] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const todayEntry = useMemo(() => entries.find((entry) => entry.date === todayKey), [entries, todayKey]);

  const [lines, setLines] = useState<[string, string, string]>(todayEntry?.lines ?? ["", "", ""]);
  const [imageUris, setImageUris] = useState<string[]>(todayEntry?.imageUris?.length ? todayEntry.imageUris : todayEntry?.imageUri ? [todayEntry.imageUri] : []);

  React.useEffect(() => {
    setLines(todayEntry?.lines ?? ["", "", ""]);
    setImageUris(todayEntry?.imageUris?.length ? todayEntry.imageUris : todayEntry?.imageUri ? [todayEntry.imageUri] : []);
  }, [todayEntry]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permissionTitle"), t("permissionPhotoBody"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const nextUri = result.assets[0].uri;
      setImageUris((prev) => {
        if (isPremium) {
          if (prev.length >= 10) {
            Alert.alert(t("premiumTitle"), t("premiumLimitBody"));
            return prev;
          }
          return [...prev, nextUri];
        }

        if (prev.length >= 3) {
          Alert.alert(t("freeTitle"), t("freeLimitBody"));
          return prev;
        }

        return [...prev, nextUri];
      });
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    const validation = validateLines(lines);
    if (!validation.ok) {
      Alert.alert(t("confirmTitle"), validation.message);
      return;
    }

    setIsSaving(true);
    try {
      await upsertTodayEntry(validation.value, imageUris[0] ?? null, imageUris);
      Alert.alert(t("saveDoneTitle"), t("saveDoneBody"));
    } catch (error) {
      Alert.alert(t("errorTitle"), t("saveErrorBody"));
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!todayEntry) {
      setLines(["", "", ""]);
      setImageUris([]);
      return;
    }

    setIsSaving(true);
    try {
      await removeEntry(todayEntry.id);
    } catch (error) {
      Alert.alert(t("errorTitle"), t("deleteErrorBody"));
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>{t("loadingRecords")}</Text>
      </View>
    );
  }

  return (
    <ScrollView key={locale} style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>{t("recentEntriesTitle")}</Text>
      <Text style={styles.subtitle}>{t("todayLinesTitle", { date: formatDateDisplay(todayKey) })}</Text>
      <View style={styles.divider} />

      <View style={styles.editorSection}>
        <View style={styles.imageLabelRow}>
          <Text style={styles.imageLabel}>{t("todayPhotoLabel")}</Text>
          {todayEntry && (
            <View style={styles.menuWrapper}>
              <Pressable onPress={() => setMenuVisible(!menuVisible)} style={styles.menuButton}>
                <MoreHorizontal size={20} color={COLORS.secondaryText} />
              </Pressable>
              {menuVisible && (
                <View style={styles.dropdownMenu}>
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuVisible(false);
                      Alert.alert(t("todayDeleteTitle"), t("todayDeleteConfirm"), [
                        { text: t("cancel"), style: "cancel" },
                        { text: t("delete"), style: "destructive", onPress: remove },
                      ]);
                    }}
                  >
                    <Trash2 size={16} color={COLORS.danger} />
                    <Text style={styles.menuItemTextDanger}>{t("delete")}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {imageUris.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageList}>
            {imageUris.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.imagePreviewContainer}>
                <Image source={{ uri }} style={styles.imagePreview} contentFit="cover" />
                <Pressable onPress={() => removeImage(index)} style={styles.removeImageButton} hitSlop={10}>
                  <X size={14} color={COLORS.surface} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={pickImage} style={styles.inlineAddImageButton}>
              <ImagePlus size={20} color={COLORS.secondaryText} />
            </Pressable>
          </ScrollView>
        ) : (
          <Pressable onPress={pickImage} style={styles.imagePlaceholder}>
            <ImagePlus size={20} color={COLORS.secondaryText} />
            <Text style={styles.imagePlaceholderText}>{t("imageAdd")}</Text>
          </Pressable>
        )}

        <Text style={styles.imageLimitText}>
          {isPremium ? t("imageLimitPremium", { count: imageUris.length }) : t("imageLimitFree", { count: imageUris.length })}
        </Text>

        {lines.map((line, index) => (
          <TextInput
            key={index}
            value={line}
            onChangeText={(text) => {
              const next = [...lines] as [string, string, string];
              next[index] = text;
              setLines(next);
            }}
            placeholder={t("linePlaceholder", { index: index + 1 })}
            placeholderTextColor={COLORS.secondaryText}
            maxLength={120}
            style={styles.input}
          />
        ))}

        <Pressable style={styles.primaryButton} onPress={save}>
          <Text style={styles.primaryButtonText}>{isSaving ? t("saveInProgress") : t("save")}</Text>
        </Pressable>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{t("recentEntriesTitle")}</Text>
        <Text style={styles.listMeta}>{entries.length}</Text>
      </View>
      <View style={styles.divider} />

      {entries.length === 0 ? (
        <Text style={styles.empty}>{t("emptyEntries")}</Text>
      ) : (
        entries.slice(0, 7).map((entry) => {
          const nonEmptyLines = (entry.lines ?? []).filter(Boolean);
          const titleLine = nonEmptyLines[0];


          return (
            <View key={entry.id} style={styles.listItem}>
              <View style={styles.listItemHeader}>
                {titleLine ? <Text style={styles.listItemTitle}>{titleLine}</Text> : <View style={styles.listItemTitleSpacer} />}
                <Text style={styles.dateLabel}>{formatDateDisplay(entry.date)}</Text>
              </View>
              {nonEmptyLines.slice(1).map((line, idx) => (
                <Text key={`${entry.id}-line-${idx}`} style={styles.lineText}>
                  {line}
                </Text>
              ))}
              {(entry.imageUris?.[0] || entry.imageUri) && (
                <Image source={{ uri: entry.imageUris?.[0] ?? entry.imageUri ?? "" }} style={styles.listImage} contentFit="cover" />
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 44 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: COLORS.secondaryText, fontSize: 15 },
  screenTitle: {
    color: COLORS.primaryText,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.3,
    marginTop: 8,
  },
  subtitle: {
    color: COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginBottom: 20,
  },
  editorSection: {
    marginBottom: 26,
  },
  imageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  imageLabel: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontWeight: "500",
  },
  imageList: { gap: 10, marginBottom: 4 },
  imagePreviewContainer: { position: "relative", alignSelf: "flex-start" },
  imagePreview: { width: 96, height: 96, borderRadius: 6 },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineAddImageButton: {
    width: 96,
    height: 96,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  imagePlaceholderText: { color: COLORS.secondaryText, fontSize: 13 },
  imageLimitText: { color: COLORS.secondaryText, fontSize: 12, marginTop: 8, marginBottom: 14 },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 0,
    color: COLORS.primaryText,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 16,
    minHeight: 46,
  },
  primaryButton: {
    backgroundColor: COLORS.primaryText,
    borderRadius: 4,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  primaryButtonText: {
    color: COLORS.surface,
    fontWeight: "600",
    fontSize: 15,
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuWrapper: { position: "relative" },
  dropdownMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    padding: 4,
    minWidth: 110,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  menuItemTextDanger: { color: COLORS.danger, fontSize: 14, fontWeight: "500" },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  listTitle: { color: COLORS.primaryText, fontSize: 21, fontWeight: "500" },
  listMeta: { color: COLORS.secondaryText, fontSize: 13 },
  listItem: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  listItemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  listItemTitle: {
    flex: 1,
    color: COLORS.primaryText,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "400",
  },
  listItemTitleSpacer: { flex: 1 },
  dateLabel: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  lineText: {
    color: COLORS.secondaryText,
    lineHeight: 25,
    fontSize: 15,
    marginTop: 8,
  },
  listImage: {
    width: "100%",
    height: 130,
    borderRadius: 6,
    marginTop: 10,
  },
  empty: { color: COLORS.secondaryText, paddingVertical: 10 },
});
