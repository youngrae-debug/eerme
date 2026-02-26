import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../../components/neumorphic";
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
  const [profileEditOpen, setProfileEditOpen] = React.useState(false);
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
        Alert.alert(
          t("subscriptionDoneTitle"),
          t("subscriptionDoneBody", { productId: purchase.productId }),
        );
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
    if (activeTab !== "subscription" && activeTab !== "backup") {
      setActiveTab("subscription");
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (!isReady) return;

    setSubscriptionBusy(true);
    loadSubscriptionProducts()
      .then((items) => {
        setProducts(items);
      })
      .catch((error) => {
        console.error("Failed to load subscription products", error);
        const message = error instanceof Error ? error.message : t("subscriptionProductLoadFailed");
        setSubscriptionError(message);
        setProducts(getFallbackSubscriptionProducts());
      })
      .finally(() => setSubscriptionBusy(false));
  }, [isReady, locale]);

  React.useEffect(() => {
    if (products.length === 0) return;
    if (!selectedProductId) {
      setSelectedProductId(products[0].productId);
    }
  }, [products, selectedProductId]);

  React.useEffect(() => {
    const defaultName = session?.user.displayName ?? (session?.user.email?.includes("@") ? session.user.email.split("@")[0] : "Me");
    setProfileName(defaultName);

    AsyncStorage.getItem(PROFILE_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as ProfileDraft;
        if (saved.name?.trim()) {
          setProfileName(saved.name);
        }
        if (saved.imageUri) {
          setProfileImageUri(saved.imageUri);
        }
      })
      .catch(() => {
        // noop
      });
  }, [session?.user.displayName, session?.user.email]);

  const subscribe = React.useCallback(
    async (productId: string) => {
      setSubscriptionBusy(true);
      try {
        await requestSubscription(productId);
      } catch (error) {
        const message = error instanceof Error ? error.message : t("purchaseRequestFailed");
        Alert.alert(t("errorTitle"), message);
        setSubscriptionBusy(false);
      }
    },
    [],
  );

  const restorePurchase = React.useCallback(async () => {
    setSubscriptionBusy(true);
    try {
      const restored = await restoreSubscription();
      setPremium(restored);
      Alert.alert(t("restoreTitle"), restored ? t("restoreSuccess") : t("restoreNone"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("restoreFailed");
      Alert.alert(t("errorTitle"), message);
    } finally {
      setSubscriptionBusy(false);
    }
  }, [setPremium]);

  const handleSubscribe = React.useCallback(() => {
    if (!selectedProductId) {
      Alert.alert(t("errorTitle"), t("selectPlanFirst"));
      return;
    }
    subscribe(selectedProductId).catch((error) => {
      console.error("subscribe failed", error);
    });
  }, [selectedProductId, subscribe]);

  const run = React.useCallback(async (task: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    try {
      await task();
      if (successMessage) {
        Alert.alert(t("doneTitle"), successMessage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("taskFailed");
      Alert.alert(t("errorTitle"), message);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDeleteAccount = React.useCallback(() => {
    Alert.alert(
      t("authDeleteTitle"),
      t("authDeleteBody"),
      [
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
      ],
    );
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
      Alert.alert(t("errorTitle"), "사진 접근 권한이 필요해요.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaTypeOptions.Images],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0]?.uri;
      if (uri) {
        setProfileImageUri(uri);
      }
    }
  }, []);

  const saveProfile = React.useCallback(() => {
    const trimmed = profileName.trim();
    if (!trimmed) {
      Alert.alert(t("errorTitle"), "이름을 입력해 주세요.");
      return;
    }

    const draft: ProfileDraft = { name: trimmed, imageUri: profileImageUri };
    AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(draft))
      .then(() => {
        setProfileName(trimmed);
        setProfileEditOpen(false);
        Alert.alert(t("doneTitle"), "프로필이 저장됐어요.");
      })
      .catch(() => {
        Alert.alert(t("errorTitle"), "프로필 저장에 실패했어요.");
      });
  }, [profileImageUri, profileName]);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <NeumorphicCard style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{displayName}</Text>
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

        <Pressable style={styles.profileEditButton} onPress={() => setProfileEditOpen((prev) => !prev)}>
          <Text style={styles.profileEditText}>프로필 수정</Text>
        </Pressable>
      </NeumorphicCard>

      {profileEditOpen ? (
        <NeumorphicCard style={styles.card}>
          <Text style={styles.sectionTitle}>프로필 수정</Text>
          <View style={styles.profileEditAvatarWrap}>
            <Pressable style={styles.photoButton} onPress={() => {
              pickProfileImage().catch(() => {
                Alert.alert(t("errorTitle"), "사진 선택에 실패했어요.");
              });
            }}>
              <Text style={styles.photoButtonText}>프로필 사진 변경</Text>
            </Pressable>
            {profileImageUri ? (
              <Pressable style={styles.photoSecondaryButton} onPress={() => setProfileImageUri(null)}>
                <Text style={styles.photoSecondaryButtonText}>기본 이미지 사용</Text>
              </Pressable>
            ) : null}
          </View>
          <TextInput
            placeholder="이름"
            placeholderTextColor={COLORS.secondaryText}
            style={styles.input}
            value={profileName}
            onChangeText={setProfileName}
          />
          <TextInput
            secureTextEntry
            placeholder={t("authPasswordPlaceholder")}
            placeholderTextColor={COLORS.secondaryText}
            style={styles.input}
            value={nextPassword}
            onChangeText={setNextPassword}
          />
          <View style={styles.row}>
            <NeumorphicButton
              label={busy ? t("processing") : t("authPasswordUpdateButton")}
              style={styles.buttonFlex}
              onPress={handleChangePassword}
            />
            <NeumorphicButton
              label={busy ? t("processing") : "프로필 저장"}
              style={styles.buttonFlex}
              onPress={saveProfile}
            />
          </View>
          <View style={styles.row}>
            <NeumorphicButton
              label={busy ? t("processing") : t("authSignOut")}
              style={styles.buttonFlex}
              onPress={() =>
                run(async () => {
                  await signOut();
                }, t("authSignedOut"))
              }
            />
            <NeumorphicButton
              label={busy ? t("processing") : t("authDeleteAction")}
              style={styles.buttonFlex}
              onPress={handleDeleteAccount}
            />
          </View>
        </NeumorphicCard>
      ) : null}

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
                style={[styles.languageButton, isActive && styles.languageButtonActive]}
              >
                <Text style={[styles.languageText, isActive && styles.languageTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </NeumorphicCard>

      <View style={styles.tabRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("subscription")}
          style={[styles.tabButton, activeTab === "subscription" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabLabel, activeTab === "subscription" && styles.tabLabelActive]}>{t("tabSubscription")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("backup")}
          style={[styles.tabButton, activeTab === "backup" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabLabel, activeTab === "backup" && styles.tabLabelActive]}>{t("tabBackup")}</Text>
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
                style={[
                  styles.planItem,
                  selectedProductId === product.productId && styles.planItemSelected,
                ]}
              >
                <View style={styles.planIndicatorOuter}>
                  {selectedProductId === product.productId ? (
                    <View style={styles.planIndicatorInner} />
                  ) : null}
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
            <NeumorphicButton
              label={subscriptionBusy ? t("requestInProgress") : t("subscribeButton")}
              style={styles.buttonFlex}
              onPress={handleSubscribe}
            />
            <NeumorphicButton
              label={subscriptionBusy ? t("processing") : t("restoreSubscriptionButton")}
              style={styles.buttonFlex}
              onPress={() => {
                restorePurchase().catch((error) => {
                  console.error("restorePurchase failed", error);
                });
              }}
            />
          </View>
        </NeumorphicCard>
      ) : (
        <NeumorphicCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t("syncSectionTitle")}</Text>
          <Text style={styles.helperText}>{t("syncStatusLabel", { status: syncStatusText })}</Text>
          <Text style={styles.helperText}>{t("syncPendingLabel", { count: pendingSyncCount })}</Text>
          <Text style={styles.helperText}>{t("syncLastLabel", { value: lastSyncedLabel })}</Text>
          {syncError ? <Text style={styles.syncErrorText}>{syncError}</Text> : null}
          <NeumorphicButton
            label={busy || syncStatus === "syncing" ? t("processing") : t("syncNowButton")}
            onPress={() => run(syncNow, t("syncDone"))}
          />
        </NeumorphicCard>
      )}

    </ScrollView>
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
  profileName: { color: COLORS.primaryText, fontSize: 28, fontWeight: "800" },
  profileMeta: { color: COLORS.secondaryText, fontSize: 14 },
  profileInfoList: { gap: 10, marginBottom: 16 },
  profileInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileInfoText: { color: COLORS.primaryText, fontSize: 15 },
  profileEditButton: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  profileEditText: { color: COLORS.primaryText, fontWeight: "700", fontSize: 16 },
  card: { borderRadius: 22, padding: 16 },
  sectionTitle: { color: COLORS.textOnSurface, fontWeight: "800", marginBottom: 10, fontSize: 18 },
  profileEditAvatarWrap: { gap: 8, marginBottom: 10 },
  photoButton: {
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: COLORS.card,
  },
  photoButtonText: { color: COLORS.primaryText, fontWeight: "700" },
  photoSecondaryButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  photoSecondaryButtonText: { color: COLORS.secondaryText, fontWeight: "600" },
  tabRow: { flexDirection: "row", gap: 8 },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  tabButtonActive: { borderColor: COLORS.accentPeach, backgroundColor: "#F4E7D7" },
  tabLabel: { color: COLORS.secondaryText, fontWeight: "700" },
  tabLabelActive: { color: COLORS.primaryText },
  helperText: { color: COLORS.primaryText, marginBottom: 6, lineHeight: 20 },
  muted: { color: COLORS.secondaryText, marginBottom: 6 },
  languageRow: { flexDirection: "row", gap: 10 },
  languageButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.card,
    alignItems: "center",
  },
  languageButtonActive: { borderColor: COLORS.accentPeach, backgroundColor: "#F4E7D7" },
  languageText: { color: COLORS.secondaryText, fontWeight: "600" },
  languageTextActive: { color: COLORS.primaryText },
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
});
