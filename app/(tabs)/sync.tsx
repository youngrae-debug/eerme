import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NeumorphicButton, NeumorphicCard } from "../../components/neumorphic";
import {
  attachPurchaseListener,
  closeSubscriptionConnection,
  loadSubscriptionProducts,
  requestSubscription,
  restoreSubscription,
  type Product,
} from "../../services/subscription";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { setLocale, t, useLocale } from "../../utils/i18n";

type MyPageTab = "subscription" | "backup";

export default function SyncScreen() {
  const {
    isReady,
    isPremium,
    setPremium,
    syncStatus,
    syncError,
    lastSyncedAt,
    pendingSyncCount,
    syncNow,
  } = useJournalStore();
  const locale = useLocale();

  const [activeTab, setActiveTab] = React.useState<MyPageTab>("subscription");
  const [busy, setBusy] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [subscriptionBusy, setSubscriptionBusy] = React.useState(false);
  const [subscriptionError, setSubscriptionError] = React.useState<string | null>(null);

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

  const tabItems = React.useMemo(
    () => [
      { key: "subscription" as const, label: t("tabSubscription"), hint: t("tabSubscriptionHint"), icon: "✦" },
      { key: "backup" as const, label: t("tabBackup"), hint: t("tabBackupHint"), icon: "⤴" },
    ],
    [t],
  );

  React.useEffect(() => {
    if (!tabItems.some((item) => item.key === activeTab)) {
      setActiveTab("subscription");
    }
  }, [activeTab, tabItems]);

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
      })
      .finally(() => setSubscriptionBusy(false));
  }, [isReady]);

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

  const run = async (task: () => Promise<void>, successMessage?: string) => {
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
  };

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <NeumorphicCard style={styles.card}>
        <Text style={styles.label}>{t("languageSectionTitle")}</Text>
        <Text style={styles.helperText}>{t("languageSectionHelper")}</Text>
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
        {tabItems.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
          >
            <View style={styles.tabHeadRow}>
              <Text style={[styles.tabIcon, activeTab === tab.key && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            </View>
            <Text style={[styles.tabHint, activeTab === tab.key && styles.tabHintActive]}>{tab.hint}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "subscription" ? (
        <>
          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>{t("subscriptionStatusLabel")}</Text>
            <Text style={styles.value}>
              {isPremium ? t("subscriptionStatusPremium") : t("subscriptionStatusFree")}
            </Text>
            <Text style={styles.helperText}>{t("subscriptionHelper")}</Text>
          </NeumorphicCard>

          <NeumorphicCard style={styles.card}>
            <Text style={styles.label}>{t("subscriptionProductsLabel")}</Text>
            {subscriptionError ? (
              <Text style={styles.emptyText}>{subscriptionError}</Text>
            ) : products.length === 0 ? (
              <Text style={styles.emptyText}>{t("subscriptionProductsEmpty")}</Text>
            ) : (
              products.map((product) => (
                <View key={product.productId} style={styles.planItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>{product.title ?? product.productId}</Text>
                    <Text style={styles.planPrice}>{product.price ?? t("priceUnavailable")}</Text>
                    <Text style={styles.planDescription}>{product.description ?? t("premiumAllFeatures")}</Text>
                  </View>
                  <NeumorphicButton
                    label={subscriptionBusy ? t("requestInProgress") : t("subscribeButton")}
                    style={styles.planButton}
                    onPress={() => subscribe(product.productId)}
                  />
                </View>
              ))
            )}
            <View style={styles.row}>
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
        </>
      ) : null}

      {activeTab === "backup" ? (
        <NeumorphicCard style={styles.card}>
          <Text style={styles.label}>{t("syncSectionTitle")}</Text>
          <Text style={styles.value}>{t("syncStatusLabel", { status: syncStatusText })}</Text>
          <Text style={styles.helperText}>{t("syncPendingLabel", { count: pendingSyncCount })}</Text>
          <Text style={styles.helperText}>{t("syncLastLabel", { value: lastSyncedLabel })}</Text>
          <Text style={styles.helperText}>{t("syncAutoHint")}</Text>
          {syncError ? <Text style={styles.syncErrorText}>{syncError}</Text> : null}
          <View style={styles.row}>
            <NeumorphicButton
              label={busy || syncStatus === "syncing" ? t("processing") : t("syncNowButton")}
              style={styles.buttonFlex}
              onPress={() => run(syncNow, t("syncDone"))}
            />
          </View>
        </NeumorphicCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 36, gap: 14 },
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: COLORS.textOnDark },
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
  languageButtonActive: {
    borderColor: COLORS.accentPeach,
    backgroundColor: "#F4E7D7",
  },
  languageText: { color: COLORS.secondaryText, fontWeight: "600" },
  languageTextActive: { color: COLORS.primaryText },
  tabRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 6 },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.card,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabButtonActive: {
    borderColor: COLORS.accentPeach,
    backgroundColor: "#F4E7D7",
  },
  tabHeadRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  tabIcon: { color: COLORS.secondaryText, fontSize: 14, fontWeight: "700" },
  tabIconActive: { color: COLORS.primaryText },
  tabLabel: { color: COLORS.secondaryText, fontWeight: "700", fontSize: 14 },
  tabLabelActive: { color: COLORS.primaryText },
  tabHint: { color: COLORS.secondaryText, marginTop: 3, fontSize: 12 },
  tabHintActive: { color: COLORS.primaryText },
  card: { borderRadius: 20 },
  label: { color: COLORS.textOnSurface, fontWeight: "700", marginBottom: 6, fontSize: 16 },
  helperText: { color: COLORS.secondaryText, marginBottom: 10, lineHeight: 20 },
  value: { color: COLORS.textOnSurface, marginBottom: 2 },
  planItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#d8dee9",
  },
  planTitle: { color: COLORS.primaryText, fontWeight: "700", marginBottom: 2 },
  planPrice: { color: COLORS.textOnSurface, fontWeight: "600", marginBottom: 2 },
  planDescription: { color: COLORS.secondaryText, fontSize: 12 },
  planButton: { minWidth: 92 },
  row: { flexDirection: "row", gap: 12, marginBottom: 8 },
  buttonFlex: { flex: 1 },
  emptyText: { color: COLORS.textOnSurface, marginTop: 6 },
  syncErrorText: { color: COLORS.danger, marginBottom: 10 },
});
