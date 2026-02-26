import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicCard } from "../../components/neumorphic";
import {
  attachPurchaseListener,
  closeSubscriptionConnection,
  getFallbackSubscriptionProducts,
  loadSubscriptionProducts,
  requestSubscription,
  restoreSubscription,
  type Product,
} from "../../services/subscription";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { setLocale, t, useLocale } from "../../utils/i18n";

type MyPageTab = "subscription" | "backup";
const PROFILE_STORAGE_KEY = "@eerme/my-profile";

type ProfileDraft = {
  name: string;
  imageUri: string | null;
};

export default function SyncScreen() {
  const locale = useLocale();
  const {
    isReady,
    isPremium,
    setPremium,
    syncStatus,
    syncError,
    lastSyncedAt,
    pendingSyncCount,
    session,
    signOut,
    deleteAccount,
    updatePassword,
    syncNow,
  } = useJournalStore();

  const [activeTab, setActiveTab] = React.useState<MyPageTab>("subscription");
  const [busy, setBusy] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [subscriptionBusy, setSubscriptionBusy] = React.useState(false);
  const [subscriptionError, setSubscriptionError] = React.useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [nextPassword, setNextPassword] = React.useState("");
  const [profileModalVisible, setProfileModalVisible] = React.useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const [profileName, setProfileName] = React.useState("");
  const [profileImageUri, setProfileImageUri] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    let listener: { remove: () => void } | null = null;

    try {
      listener = attachPurchaseListener((purchase) => {
        if (!mounted) return;
        setPremium(true);
        setSubscriptionBusy(false);
        Alert.alert(t("subscriptionDoneTitle"), t("subscriptionDoneBody", { productId: purchase.productId }));
      });
      setSubscriptionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("iapLoadFailed");
      setSubscriptionError(message);
    }

    return () => {
      mounted = false;
      listener?.remove();
      closeSubscriptionConnection().catch(() => {
        // noop
      });
    };
  }, [setPremium]);

  React.useEffect(() => {
    if (!isReady) return;
    setSubscriptionBusy(true);
    loadSubscriptionProducts()
      .then((items) => setProducts(items))
      .catch((error) => {
        console.error("Failed to load subscription products", error);
        const message = error instanceof Error ? error.message : t("subscriptionProductLoadFailed");
        setSubscriptionError(message);
        setProducts(getFallbackSubscriptionProducts());
      })
      .finally(() => setSubscriptionBusy(false));
  }, [isReady, locale]);

  React.useEffect(() => {
    if (products.length === 0 || selectedProductId) return;
    setSelectedProductId(products[0].productId);
  }, [products, selectedProductId]);

  React.useEffect(() => {
    const fallbackName = session?.user.displayName ?? (session?.user.email?.includes("@") ? session.user.email.split("@")[0] : "Me");
    setProfileName(fallbackName);

    AsyncStorage.getItem(PROFILE_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as ProfileDraft;
        if (saved.name?.trim()) setProfileName(saved.name);
        if (saved.imageUri) setProfileImageUri(saved.imageUri);
      })
      .catch(() => {
        // noop
      });
  }, [session?.user.displayName, session?.user.email]);

  const run = React.useCallback(async (task: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    try {
      await task();
      if (successMessage) Alert.alert(t("doneTitle"), successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("taskFailed");
      Alert.alert(t("errorTitle"), message);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDeleteAccount = React.useCallback(() => {
    Alert.alert(t("authDeleteTitle"), t("authDeleteBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("authDeleteAction"),
        style: "destructive",
        onPress: () => {
          run(deleteAccount, t("authDeleteDone")).catch((error) => {
            console.error("deleteAccount failed", error);
          });
        },
      },
    ]);
  }, [deleteAccount, run]);

  const handleChangePassword = React.useCallback(() => {
    const trimmedPassword = nextPassword.trim();
    if (trimmedPassword.length < 6) {
      Alert.alert(t("errorTitle"), t("authValidation"));
      return;
    }

    run(async () => {
      await updatePassword(trimmedPassword);
      setNextPassword("");
    }, t("authPasswordUpdated")).catch((error) => {
      console.error("updatePassword failed", error);
    });
  }, [nextPassword, run, updatePassword]);

  const pickProfileImage = React.useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("errorTitle"), t("profilePhotoPermissionDenied"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0]?.uri;
      if (uri) setProfileImageUri(uri);
    }
  }, []);

  const saveProfile = React.useCallback(() => {
    const trimmed = profileName.trim();
    if (!trimmed) {
      Alert.alert(t("errorTitle"), t("profileNameRequired"));
      return;
    }

    const draft: ProfileDraft = { name: trimmed, imageUri: profileImageUri };
    AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(draft))
      .then(() => {
        setProfileName(trimmed);
        Alert.alert(t("doneTitle"), t("profileSaveSuccess"));
      })
      .catch(() => {
        Alert.alert(t("errorTitle"), t("profileSaveFailed"));
      });
  }, [profileImageUri, profileName]);

  const handleSubscribe = React.useCallback(() => {
    if (!selectedProductId) {
      Alert.alert(t("errorTitle"), t("selectPlanFirst"));
      return;
    }
    setSubscriptionBusy(true);
    requestSubscription(selectedProductId)
      .catch((error) => {
        const message = error instanceof Error ? error.message : t("purchaseRequestFailed");
        Alert.alert(t("errorTitle"), message);
      })
      .finally(() => setSubscriptionBusy(false));
  }, [selectedProductId]);

  const handleRestorePurchase = React.useCallback(() => {
    setSubscriptionBusy(true);
    restoreSubscription()
      .then((restored) => {
        setPremium(restored);
        Alert.alert(t("restoreTitle"), restored ? t("restoreSuccess") : t("restoreNone"));
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : t("restoreFailed");
        Alert.alert(t("errorTitle"), message);
      })
      .finally(() => setSubscriptionBusy(false));
  }, [setPremium]);

  const syncStatusText =
    syncStatus === "syncing" ? t("syncStatusSyncing") : syncStatus === "error" ? t("syncStatusError") : t("syncStatusIdle");
  const lastSyncedLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : t("syncNever");

  if (!isReady) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>{t("loadingSettings")}</Text>
      </View>
    );
  }

  const email = session?.user.email ?? "-";
  const displayName = profileName.trim() || (email.includes("@") ? email.split("@")[0] : email);
  const initial = displayName[0]?.toUpperCase() ?? "M";

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <NeumorphicCard style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Pressable style={styles.avatarWrap} onPress={() => setProfileModalVisible(true)}>
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </Pressable>

            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Pressable onPress={() => setProfileModalVisible(true)}>
                  <Text style={styles.profileName}>{displayName}</Text>
                </Pressable>
                <Pressable
                  style={styles.smallTextButton}
                  onPress={() =>
                    run(async () => {
                      await signOut();
                    }, t("authSignedOut"))
                  }
                >
                  <Text style={styles.smallTextButtonLabel}>{busy ? t("processing") : t("authSignOut")}</Text>
                </Pressable>
              </View>
              <Text style={styles.profileMeta}>{email}</Text>
            </View>
          </View>

          <View style={styles.profileInfoList}>
            <View style={styles.profileInfoRow}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.secondaryText} />
              <Text style={styles.profileInfoText}>{lastSyncedLabel}</Text>
            </View>
            <View style={styles.profileInfoRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.secondaryText} />
              <Text style={styles.profileInfoText}>{isPremium ? t("subscriptionStatusPremium") : t("subscriptionStatusFree")}</Text>
            </View>
          </View>
        </NeumorphicCard>

        <NeumorphicCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t("languageSectionTitle")}</Text>
          <View style={styles.languageRow}>
            {([
              { key: "en", label: t("languageEnglish") },
              { key: "ko", label: t("languageKorean") },
              { key: "ja", label: t("languageJapanese") },
            ] as const).map((item) => {
              const isActive = locale === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setLocale(item.key)}
                  style={[styles.softButton, styles.languageItem, isActive && styles.languageItemActive]}
                >
                  <Text style={styles.softButtonLabel}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </NeumorphicCard>

        <View style={styles.tabContainer}>
          <Pressable accessibilityRole="tab" onPress={() => setActiveTab("subscription")} style={styles.tabItem}>
            <Text style={[styles.tabText, activeTab === "subscription" && styles.tabTextActive]}>{t("tabSubscription")}</Text>
            <View style={[styles.tabIndicator, activeTab === "subscription" && styles.tabIndicatorActive]} />
          </Pressable>
          <Pressable accessibilityRole="tab" onPress={() => setActiveTab("backup")} style={styles.tabItem}>
            <Text style={[styles.tabText, activeTab === "backup" && styles.tabTextActive]}>{t("tabBackup")}</Text>
            <View style={[styles.tabIndicator, activeTab === "backup" && styles.tabIndicatorActive]} />
          </Pressable>
        </View>

        {activeTab === "subscription" ? (
          <NeumorphicCard style={styles.card}>
            <Text style={styles.sectionTitle}>{t("subscriptionProductsLabel")}</Text>
            {subscriptionError ? <Text style={styles.emptyText}>{subscriptionError}</Text> : null}
            {products.length === 0 ? (
              <Text style={styles.emptyText}>{t("subscriptionProductsEmpty")}</Text>
            ) : (
              products.map((product) => (
                <Pressable
                  key={product.productId}
                  accessibilityRole="button"
                  onPress={() => setSelectedProductId(product.productId)}
                  style={[styles.planItem, selectedProductId === product.productId && styles.planItemSelected]}
                >
                  <View style={styles.planIndicatorOuter}>
                    {selectedProductId === product.productId ? <View style={styles.planIndicatorInner} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>{product.title ?? product.productId}</Text>
                    <Text style={styles.planPrice}>{product.price ?? t("priceUnavailable")}</Text>
                    <Text style={styles.planDescription}>{product.description ?? t("premiumAllFeatures")}</Text>
                  </View>
                </Pressable>
              ))
            )}
            <View style={styles.row}>
              <Pressable style={[styles.accentButton, styles.buttonFlex]} onPress={handleSubscribe}>
                <Text style={styles.accentButtonLabel}>{subscriptionBusy ? t("requestInProgress") : t("subscribeButton")}</Text>
              </Pressable>
              <Pressable style={[styles.accentButton, styles.buttonFlex]} onPress={handleRestorePurchase}>
                <Text style={styles.accentButtonLabel}>{subscriptionBusy ? t("processing") : t("restoreSubscriptionButton")}</Text>
              </Pressable>
            </View>
          </NeumorphicCard>
        ) : (
          <NeumorphicCard style={styles.card}>
            <Text style={styles.sectionTitle}>{t("syncSectionTitle")}</Text>
            <Text style={styles.helperText}>{t("syncStatusLabel", { status: syncStatusText })}</Text>
            <Text style={styles.helperText}>{t("syncPendingLabel", { count: pendingSyncCount })}</Text>
            <Text style={styles.helperText}>{t("syncLastLabel", { value: lastSyncedLabel })}</Text>
            {syncError ? <Text style={styles.syncErrorText}>{syncError}</Text> : null}
            <Pressable style={styles.accentButton} onPress={() => run(syncNow, t("syncDone"))}>
              <Text style={styles.accentButtonLabel}>{busy || syncStatus === "syncing" ? t("processing") : t("syncNowButton")}</Text>
            </Pressable>
          </NeumorphicCard>
        )}
      </ScrollView>

      <Modal visible={profileModalVisible} animationType="slide" transparent onRequestClose={() => setProfileModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProfileModalVisible(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.sectionTitle}>{t("profileEditTitle")}</Text>
            <View style={styles.modalHeaderRight}>
              <View style={styles.menuWrap}>
                <Pressable style={styles.iconButtonWhite} onPress={() => setProfileMenuOpen((prev) => !prev)}>
                  <Ionicons name="ellipsis-vertical" size={16} color={COLORS.primaryText} />
                </Pressable>
                {profileMenuOpen ? (
                  <Pressable
                    style={styles.dropdownItem}
                    onPress={() => {
                      setProfileMenuOpen(false);
                      handleDeleteAccount();
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{t("authDeleteAction")}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable style={styles.iconButtonWhite} onPress={() => setProfileModalVisible(false)}>
                <Ionicons name="close" size={18} color={COLORS.primaryText} />
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.modalAvatarWrap} onPress={() => {
            pickProfileImage().catch(() => {
              Alert.alert(t("errorTitle"), t("profilePhotoPickFailed"));
            });
          }}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.modalAvatarImage} contentFit="cover" />
            ) : (
              <View style={styles.modalAvatarFallback}>
                <Text style={styles.modalAvatarFallbackText}>{initial}</Text>
              </View>
            )}
            <View style={styles.modalAvatarEditBadge}>
              <Text style={styles.modalAvatarEditText}>{t("edit")}</Text>
            </View>
          </Pressable>

          <TextInput
            placeholder={t("profileNamePlaceholder")}
            placeholderTextColor={COLORS.secondaryText}
            style={styles.input}
            value={profileName}
            onChangeText={setProfileName}
          />

          <Pressable style={styles.softButton} onPress={saveProfile}>
            <Text style={styles.softButtonLabel}>{busy ? t("processing") : t("profileSaveButton")}</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>{t("profilePasswordSectionTitle")}</Text>
          <TextInput
            secureTextEntry
            placeholder={t("authPasswordPlaceholder")}
            placeholderTextColor={COLORS.secondaryText}
            style={styles.input}
            value={nextPassword}
            onChangeText={setNextPassword}
          />
          <Pressable style={styles.softButton} onPress={handleChangePassword}>
            <Text style={styles.softButtonLabel}>{busy ? t("processing") : t("authPasswordUpdateButton")}</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: COLORS.textOnDark },
  profileCard: { borderRadius: 24, padding: 18 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.softBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: COLORS.primaryText, fontWeight: "800", fontSize: 26 },
  avatarImage: { width: "100%", height: "100%", borderRadius: 36 },
  nameRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  smallTextButton: { paddingBottom: 3 },
  smallTextButtonLabel: { color: COLORS.danger, fontSize: 12, fontWeight: "700" },
  profileName: { color: COLORS.primaryText, fontSize: 28, fontWeight: "800" },
  profileMeta: { color: COLORS.secondaryText, fontSize: 14 },
  profileInfoList: { gap: 10, marginBottom: 12 },
  profileInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileInfoText: { color: COLORS.primaryText, fontSize: 15 },
  card: { borderRadius: 22, padding: 16 },
  sectionTitle: { color: COLORS.textOnSurface, fontWeight: "800", marginBottom: 10, fontSize: 18 },
  softButton: {
    backgroundColor: "#C6B193",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  softButtonLabel: { color: COLORS.primaryText, fontWeight: "700", fontSize: 15 },
  accentButton: {
    backgroundColor: "#C6B193",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  accentButtonLabel: { color: "#5A4E42", fontWeight: "700", fontSize: 15 },
  helperText: { color: COLORS.primaryText, marginBottom: 6, lineHeight: 20 },
  languageRow: { flexDirection: "row", gap: 10 },
  languageItem: { flex: 1, backgroundColor: "#EFE6DA", borderWidth: 1, borderColor: COLORS.softBorder },
  languageItemActive: { backgroundColor: "#C6B193", borderColor: "#C6B193" },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.softBorder,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 0,
  },
  tabText: {
    color: COLORS.secondaryText,
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 8,
  },
  tabTextActive: { color: COLORS.primaryText },
  tabIndicator: { width: "100%", height: 2, backgroundColor: "transparent" },
  tabIndicatorActive: { backgroundColor: COLORS.primaryText },
  input: {
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    color: COLORS.primaryText,
    marginBottom: 10,
  },
  planItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#d8dee9",
  },
  planIndicatorOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.accentPeach,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  planIndicatorInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accentPeach,
  },
  planItemSelected: {
    borderColor: COLORS.accentPeach,
    backgroundColor: "#F4E7D7",
  },
  planTitle: { color: COLORS.primaryText, fontWeight: "700", marginBottom: 2 },
  planPrice: { color: COLORS.textOnSurface, fontWeight: "600", marginBottom: 2 },
  planDescription: { color: COLORS.secondaryText, fontSize: 12 },
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  buttonFlex: { flex: 1 },
  emptyText: { color: COLORS.textOnSurface, marginTop: 6 },
  syncErrorText: { color: COLORS.danger, marginBottom: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButtonWhite: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  menuWrap: { position: "relative" },
  dropdownItem: {
    position: "absolute",
    right: 0,
    top: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 90,
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  dropdownItemText: { color: COLORS.primaryText, fontWeight: "700", fontSize: 13 },
  modalAvatarWrap: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignSelf: "center",
    marginBottom: 14,
    position: "relative",
    overflow: "visible",
  },
  modalAvatarImage: { width: "100%", height: "100%", borderRadius: 54 },
  modalAvatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 54,
    backgroundColor: COLORS.softBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAvatarFallbackText: { color: COLORS.primaryText, fontWeight: "800", fontSize: 32 },
  modalAvatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: "#C6B193",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modalAvatarEditText: { color: "#5A4E42", fontSize: 11, fontWeight: "700" },
});
