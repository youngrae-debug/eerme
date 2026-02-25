import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, MoreHorizontal, Trash2, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../../components/neumorphic";
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
          if (prev.length >= 5) {
            Alert.alert(t("premiumTitle"), t("premiumLimitBody"));
            return prev;
          }
          return [...prev, nextUri];
        }

        return [nextUri];
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
      {/* 프리미엄 배지 */}
      {isPremium && (
        <View style={styles.premiumBadge}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.premiumLogo}
            contentFit="contain"
          />
          <Text style={styles.premiumText}>{t("premiumBadge")}</Text>
        </View>
      )}

      <Text style={styles.subtitle}>{t("todayLinesTitle", { date: formatDateDisplay(todayKey) })}</Text>

      <NeumorphicCard style={styles.editorCard}>
        {/* Image Picker */}
        <View style={styles.imageSection}>
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
                      Alert.alert(
                        t("todayDeleteTitle"),
                        t("todayDeleteConfirm"),
                        [
                          { text: t("cancel"), style: "cancel" },
                          { text: t("delete"), style: "destructive", onPress: remove },
                        ],
                      );
                    }}
                  >
                    <Trash2 size={18} color={COLORS.danger} />
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
                    <X size={16} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {(isPremium ? imageUris.length < 5 : imageUris.length < 1) ? (
                <Pressable onPress={pickImage} style={styles.imagePlaceholder}>
                  <ImagePlus size={24} color={COLORS.secondaryText} />
                  <Text style={styles.imagePlaceholderText}>{t("imageAdd")}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          ) : (
            <Pressable onPress={pickImage} style={styles.imagePlaceholder}>
              <ImagePlus size={24} color={COLORS.secondaryText} />
              <Text style={styles.imagePlaceholderText}>{t("imageAdd")}</Text>
            </Pressable>
          )}
          <Text style={styles.imageLimitText}>
            {isPremium
              ? t("imageLimitPremium", { count: imageUris.length })
              : t("imageLimitFree", { count: imageUris.length })}
          </Text>
        </View>

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
      </NeumorphicCard>

      <View style={styles.actions}>
        <NeumorphicButton
          label={isSaving ? t("saveInProgress") : t("save")}
          onPress={save}
          style={styles.buttonFlex}
        />
      </View>

      <Text style={styles.listTitle}>{t("recentEntriesTitle")}</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>{t("emptyEntries")}</Text>
      ) : (
        entries.slice(0, 7).map((entry) => (
          <NeumorphicCard key={entry.id} style={styles.listCard}>
            {(entry.imageUris?.[0] || entry.imageUri) && (
              <Image source={{ uri: entry.imageUris?.[0] ?? entry.imageUri ?? "" }} style={styles.listImage} contentFit="cover" />
            )}
            <Text style={styles.dateLabel}>{formatDateDisplay(entry.date)}</Text>
            {(entry.lines ?? []).filter(Boolean).map((line, idx) => (
              <Text key={`${entry.id}-${idx}`} style={styles.lineText}>
                • {line}
              </Text>
            ))}
          </NeumorphicCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 16, paddingBottom: 42 },
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
    paddingVertical: 8,
    gap: 8,
    marginBottom: 4,
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
  title: { color: COLORS.primaryText, fontSize: 32, fontWeight: "800" },
  subtitle: { color: COLORS.secondaryText, fontSize: 15, marginBottom: 8 },
  editorCard: { borderRadius: 24 },
  input: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.softBorder,
    borderWidth: 1,
    borderRadius: 16,
    color: COLORS.primaryText,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    fontSize: 15,
  },
  imageSection: {
    marginBottom: 14,
  },
  imageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  imageLabel: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: "600",
  },
  imageList: { gap: 8 },
  imagePreviewContainer: {
    position: "relative",
    alignSelf: "flex-start",
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  removeImageButton: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  imageLimitText: { color: COLORS.secondaryText, fontSize: 12, marginTop: 8 },
  imagePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderStyle: "dashed",
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  imagePlaceholderText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "500",
  },
  actions: { flexDirection: "row", gap: 12, marginVertical: 4, alignItems: "center" },
  buttonFlex: { flex: 1 },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuWrapper: {
    position: "relative",
  },
  dropdownMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    minWidth: 120,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  menuItemTextDanger: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "600",
  },
  listTitle: { color: COLORS.primaryText, fontSize: 18, fontWeight: "700", marginTop: 8 },
  listCard: { borderRadius: 24, marginTop: 8 },
  listImage: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    marginBottom: 10,
  },
  dateLabel: { color: COLORS.primaryText, fontWeight: "600", marginBottom: 6 },
  lineText: { color: COLORS.secondaryText, lineHeight: 22 },
  empty: { color: COLORS.secondaryText },
});
