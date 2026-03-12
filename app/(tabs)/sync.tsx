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
const PROFILE_STORAGE_KEY_PREFIX = "@eerme/my-profile";

type ProfileDraft = {
  name: string;
  imageUri: string | null;
};

const getProfileStorageKey = (userIdOrEmail?: string | null) => {
  const safeId = (userIdOrEmail ?? "guest").replace(/[^a-zA-Z0-9_.@-]/g, "_");
  return `${PROFILE_STORAGE_KEY_PREFIX}:${safeId}`;
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

  const [activeTab, setActiveTab] = React.useState<MyPageTab>("backup");
  const [busy, setBusy] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [subscriptionBusy, setSubscriptionBusy] = React.useState(false);
  const [subscriptionError, setSubscriptionError] = React.useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [agreedTerms, setAgreedTerms] = React.useState({ service: false, privacy: false, billing: false });
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
        console.warn("Failed to load subscription products", error);
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
    setProfileImageUri(null);

    const storageKey = getProfileStorageKey(session?.user.id ?? session?.user.email ?? null);
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as ProfileDraft;
        if (saved.name?.trim()) setProfileName(saved.name);
        if (saved.imageUri) setProfileImageUri(saved.imageUri);
      })
      .catch(() => {
        // noop
      });
  }, [session?.user.displayName, session?.user.email, session?.user.id]);

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
    AsyncStorage.setItem(getProfileStorageKey(session?.user.id ?? session?.user.email ?? null), JSON.stringify(draft))
      .then(() => {
        setProfileName(trimmed);
        Alert.alert(t("doneTitle"), t("profileSaveSuccess"));
      })
      .catch(() => {
        Alert.alert(t("errorTitle"), t("profileSaveFailed"));
      });
  }, [profileImageUri, profileName, session?.user.email, session?.user.id]);

  const allTermsChecked = agreedTerms.service && agreedTerms.privacy && agreedTerms.billing;

  const toggleAgreement = React.useCallback((key: "service" | "privacy" | "billing") => {
    setAgreedTerms((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleAgreementAll = React.useCallback(() => {
    setAgreedTerms((prev) => {
      const nextValue = !(prev.service && prev.privacy && prev.billing);
      return { service: nextValue, privacy: nextValue, billing: nextValue };
    });
  }, []);

  const openTermsModal = React.useCallback((type: "service" | "privacy" | "billing") => {
    const titleKey = type === "service" ? "subscriptionTermsServiceTitle" : type === "privacy" ? "subscriptionTermsPrivacyTitle" : "subscriptionTermsBillingTitle";
    const bodyKey = type === "service" ? "subscriptionTermsServiceBody" : type === "privacy" ? "subscriptionTermsPrivacyBody" : "subscriptionTermsBillingBody";
    Alert.alert(t(titleKey), t(bodyKey));
  }, []);

  const handleSubscribe = React.useCallback(() => {
    if (!selectedProductId) {
      Alert.alert(t("errorTitle"), t("selectPlanFirst"));
      return;
    }
    if (!allTermsChecked) {
      Alert.alert(t("errorTitle"), t("subscriptionAgreementRequiredError"));
      return;
    }
    setSubscriptionBusy(true);
    requestSubscription(selectedProductId)
      .catch((error) => {
        const message = error instanceof Error ? error.message : t("purchaseRequestFailed");
        Alert.alert(t("errorTitle"), message);
      })
      .finally(() => setSubscriptionBusy(false));
  }, [allTermsChecked, selectedProductId]);



  const handleRestore = React.useCallback(() => {
    setSubscriptionBusy(true);
    restoreSubscription()
      .then((restored) => {
        if (restored) {
          setPremium(true);
          Alert.alert(t("restoreTitle"), t("restoreSuccess"));
          return;
        }

        Alert.alert(t("restoreTitle"), t("restoreNone"));
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : t("restoreFailed");
        Alert.alert(t("restoreTitle"), message);
      })
      .finally(() => setSubscriptionBusy(false));
  }, [setPremium]);

  const syncStatusText =
    syncStatus === "syncing" ? t("syncStatusSyncing") : syncStatus === "error" ? t("syncStatusError") : t("syncStatusIdle");
  const lastSyncedLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : t("syncNever");

  const showFirebaseRulesHelp = React.useCallback(() => {
    Alert.alert(
      "Firebase Database 규칙 설정",
      "401 오류는 대부분 Firebase Realtime Database 규칙 문제입니다.\n\n" +
      "해결 방법:\n" +
      "1. Firebase 콘솔 접속\n" +
      "2. Realtime Database → 규칙 탭\n" +
      "3. 다음과 같이 설정:\n\n" +
      '{\n  "rules": {\n    "entries": {\n      "$uid": {\n        ".read": "$uid === auth.uid",\n        ".write": "$uid === auth.uid"\n      }\n    }\n  }\n}\n\n' +
      "4. '게시' 버튼 클릭",
      [{ text: "확인" }]
    );
  }, []);

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
  const subscriptionHeadline = isPremium ? t("subscriptionHeadlinePremium") : t("subscriptionHeadlineFree");
  const renewalDateLabel = t("subscriptionNextBillingUnknown");

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
          <Text style={styles.sectionTitle}>{t("authAccountSectionTitle")}</Text>
          <Text style={styles.helperText}>{t("authDeleteHint")}</Text>
          <Pressable style={styles.dangerButton} onPress={handleDeleteAccount}>
            <Text style={styles.dangerButtonLabel}>{t("authDeleteAction")}</Text>
          </Pressable>
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
          {/* 앱 심사 대응을 위해 구독 탭 노출 임시 비활성화
          <Pressable accessibilityRole="tab" onPress={() => setActiveTab("subscription")} style={styles.tabItem}>
            <Text style={[styles.tabText, activeTab === "subscription" && styles.tabTextActive]}>{t("tabSubscription")}</Text>
            <View style={[styles.tabIndicator, activeTab === "subscription" && styles.tabIndicatorActive]} />
          </Pressable>
          */}
          <Pressable accessibilityRole="tab" onPress={() => setActiveTab("backup")} style={styles.tabItem}>
            <Text style={[styles.tabText, activeTab === "backup" && styles.tabTextActive]}>{t("tabBackup")}</Text>
            <View style={[styles.tabIndicator, activeTab === "backup" && styles.tabIndicatorActive]} />
          </Pressable>
        </View>

        {/* 앱 심사 대응을 위해 구독 콘텐츠 임시 비활성화 */}
        {false ? (
          <>
            <NeumorphicCard style={[styles.card, styles.subscriptionHeroCard]}>
              <Text style={styles.subscriptionHeroTitle}>{subscriptionHeadline}</Text>
              <Text style={styles.subscriptionHeroSubtitle}>{t("subscriptionHeroSubtitle")}</Text>
              <View style={styles.benefitRow}>
                <View style={styles.benefitChip}>
                  <Ionicons name="images-outline" size={14} color={COLORS.primaryText} />
                  <Text style={styles.benefitChipText}>{t("subscriptionBenefitPhotos")}</Text>
                </View>
                <View style={styles.benefitChip}>
                  <Ionicons name="cloud-upload-outline" size={14} color={COLORS.primaryText} />
                  <Text style={styles.benefitChipText}>{t("subscriptionBenefitBackup")}</Text>
                </View>
              </View>
            </NeumorphicCard>

            <NeumorphicCard style={styles.card}>
              <Text style={styles.sectionTitle}>{t("subscriptionStatusLabel")}</Text>
              <View style={styles.subscriptionStatusRow}>
                <Text style={styles.subscriptionStatusValue}>{isPremium ? t("subscriptionStatusPremium") : t("subscriptionStatusFree")}</Text>
                <View style={[styles.stateBadge, isPremium ? styles.stateBadgePremium : styles.stateBadgeFree]}>
                  <Text style={styles.stateBadgeText}>{isPremium ? "ON" : "FREE"}</Text>
                </View>
              </View>
              <Text style={styles.helperText}>{t("subscriptionNextBillingLabel", { date: renewalDateLabel })}</Text>
            </NeumorphicCard>

            <NeumorphicCard style={styles.card}>
              <Text style={styles.sectionTitle}>{t("subscriptionProductsLabel")}</Text>
              <Text style={styles.helperText}>{t("subscriptionHelper")}</Text>
              <Text style={styles.helperText}>{t("subscriptionRenewalNote")}</Text>
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
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planTitle}>{product.title ?? product.productId}</Text>
                      {(product.productId.includes("year") || product.productId.includes("annual")) ? (
                        <View style={styles.planBadge}>
                          <Text style={styles.planBadgeText}>{t("subscriptionPlanBadgeBest")}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.planPrice}>{product.price ?? t("priceUnavailable")}</Text>
                    <Text style={styles.planDescription}>{product.description ?? t("premiumAllFeatures")}</Text>
                  </View>
                </Pressable>
              ))
            )}

            <View style={styles.agreementWrap}>
              <Text style={styles.agreementTitle}>{t("subscriptionAgreementTitle")}</Text>
              <Pressable style={styles.agreementAllRow} onPress={toggleAgreementAll}>
                <Ionicons name={(allTermsChecked ? "checkmark-circle" : "ellipse-outline")} size={20} color={COLORS.primaryText} />
                <Text style={styles.agreementAllText}>{t("subscriptionAgreementAll")}</Text>
              </Pressable>

              {([
                { key: "service", label: t("subscriptionAgreementService") },
                { key: "privacy", label: t("subscriptionAgreementPrivacy") },
                { key: "billing", label: t("subscriptionAgreementBilling") },
              ] as const).map((item) => (
                <View key={item.key} style={styles.agreementRow}>
                  <Pressable style={styles.agreementCheckArea} onPress={() => toggleAgreement(item.key)}>
                    <Ionicons
                      name={(agreedTerms[item.key] ? "checkmark-circle" : "ellipse-outline")}
                      size={18}
                      color={COLORS.primaryText}
                    />
                    <Text style={styles.agreementText}>[{t("subscriptionAgreementRequired")}] {item.label}</Text>
                  </Pressable>
                  <Pressable onPress={() => openTermsModal(item.key)}>
                    <Text style={styles.agreementLink}>{t("subscriptionAgreementView")}</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={styles.row}>
              <Pressable style={[styles.accentButton, styles.buttonFlex]} onPress={handleSubscribe}>
                <Text style={styles.accentButtonLabel}>{subscriptionBusy ? t("requestInProgress") : t("subscribeButton")}</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, styles.buttonFlex]} onPress={handleRestore}>
                <Text style={styles.secondaryButtonLabel}>{t("restoreTitle")}</Text>
              </Pressable>
            </View>
            </NeumorphicCard>
          </>
        ) : (
          <NeumorphicCard style={styles.card}>
            <Text style={styles.sectionTitle}>{t("syncSectionTitle")}</Text>
            <Text style={styles.helperText}>{t("syncStatusLabel", { status: syncStatusText })}</Text>
            <Text style={styles.helperText}>{t("syncPendingLabel", { count: pendingSyncCount })}</Text>
            <Text style={styles.helperText}>{t("syncLastLabel", { value: lastSyncedLabel })}</Text>
            {syncError ? (
              <>
                <Text style={styles.syncErrorText}>{syncError}</Text>
                {syncError.includes("401") || syncError.includes("권한") ? (
                  <Pressable onPress={showFirebaseRulesHelp} style={{ marginTop: 8 }}>
                    <Text style={[styles.syncErrorText, { textDecorationLine: "underline" }]}>
                      → Firebase 규칙 설정 도움말 보기
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
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
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 14 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: COLORS.secondaryText, fontSize: 15 },
  profileCard: { borderRadius: 6, padding: 16 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.softBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: COLORS.primaryText, fontWeight: "600", fontSize: 26 },
  avatarImage: { width: "100%", height: "100%", borderRadius: 36 },
  nameRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  smallTextButton: { paddingBottom: 3 },
  smallTextButtonLabel: { color: COLORS.danger, fontSize: 12, fontWeight: "500" },
  profileName: { color: COLORS.primaryText, fontSize: 28, fontWeight: "500" },
  profileMeta: { color: COLORS.secondaryText, fontSize: 14 },
  profileInfoList: { gap: 10, marginBottom: 12 },
  profileInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileInfoText: { color: COLORS.primaryText, fontSize: 15 },
  card: { borderRadius: 6, padding: 16 },
  sectionTitle: { color: COLORS.primaryText, fontWeight: "500", marginBottom: 10, fontSize: 18 },
  subscriptionHeroCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subscriptionHeroTitle: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 6,
  },
  subscriptionHeroSubtitle: {
    color: COLORS.textOnSurface,
    fontSize: 14,
    marginBottom: 10,
  },
  benefitRow: { flexDirection: "row", gap: 8 },
  benefitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  benefitChipText: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  subscriptionStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  subscriptionStatusValue: {
    color: COLORS.primaryText,
    fontWeight: "600",
    fontSize: 18,
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stateBadgePremium: { backgroundColor: COLORS.primaryText },
  stateBadgeFree: { backgroundColor: COLORS.borderMuted },
  stateBadgeText: {
    color: COLORS.surface,
    fontWeight: "600",
    fontSize: 11,
  },
  softButton: {
    backgroundColor: COLORS.primaryText,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  softButtonLabel: { color: COLORS.surface, fontWeight: "600", fontSize: 15 },
  accentButton: {
    backgroundColor: COLORS.primaryText,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  accentButtonLabel: { color: COLORS.surface, fontWeight: "700", fontSize: 15 },
  helperText: { color: COLORS.primaryText, marginBottom: 6, lineHeight: 20 },
  dangerButton: {
    marginTop: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerButtonLabel: {
    color: COLORS.danger,
    fontWeight: "700",
    fontSize: 14,
  },
  languageRow: { flexDirection: "row", gap: 10 },
  languageItem: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  languageItemActive: { backgroundColor: COLORS.primaryText, borderColor: COLORS.primaryText },
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
    fontWeight: "500",
    fontSize: 14,
    marginBottom: 8,
  },
  tabTextActive: { color: COLORS.primaryText },
  tabIndicator: { width: "100%", height: 2, backgroundColor: "transparent" },
  tabIndicatorActive: { backgroundColor: COLORS.primaryText },
  input: {
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 6,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planIndicatorOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.accentPeach,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  planIndicatorInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accentPeach,
  },
  planItemSelected: {
    borderColor: COLORS.accentPeach,
    backgroundColor: COLORS.borderMuted,
  },
  planTitle: { color: COLORS.primaryText, fontWeight: "700", marginBottom: 2 },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  planBadge: {
    borderRadius: 10,
    backgroundColor: COLORS.borderMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  planBadgeText: {
    color: COLORS.primaryText,
    fontSize: 10,
    fontWeight: "600",
  },
  planPrice: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 2 },
  planDescription: { color: COLORS.secondaryText, fontSize: 12 },
  agreementWrap: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    padding: 12,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  agreementTitle: { color: COLORS.primaryText, fontSize: 14, fontWeight: "800" },
  agreementAllRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  agreementAllText: { color: COLORS.primaryText, fontWeight: "700", fontSize: 14 },
  agreementRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  agreementCheckArea: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingVertical: 2 },
  agreementText: { color: COLORS.textOnSurface, fontSize: 13, flexShrink: 1 },
  agreementLink: { color: COLORS.primaryText, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  buttonFlex: { flex: 1 },
  emptyText: { color: COLORS.textOnSurface, marginTop: 6 },
  secondaryButton: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.surface,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonLabel: {
    color: COLORS.primaryText,
    fontWeight: "700",
    fontSize: 14,
  },
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
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
    paddingBottom: 24,
    maxHeight: "80%",
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  menuWrap: { position: "relative" },
  dropdownItem: {
    position: "absolute",
    right: 0,
    top: 40,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
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
  modalAvatarFallbackText: { color: COLORS.primaryText, fontWeight: "600", fontSize: 32 },
  modalAvatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: COLORS.primaryText,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modalAvatarEditText: { color: COLORS.surface, fontSize: 11, fontWeight: "600" },
});
