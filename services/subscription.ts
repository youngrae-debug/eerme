import { Platform } from "react-native";
import * as ExpoInAppPurchases from "expo-in-app-purchases";
import { t } from "../utils/i18n";

type InAppPurchasesModule = {
  IAPResponseCode: {
    OK: number;
  };
  connectAsync: () => Promise<void>;
  disconnectAsync: () => Promise<void>;
  getProductsAsync: (productIds: string[]) => Promise<{ responseCode: number; results: Product[] }>;
  getPurchaseHistoryAsync: () => Promise<{ responseCode: number; results?: Purchase[] }>;
  purchaseItemAsync: (productId: string) => Promise<void>;
  finishTransactionAsync: (purchase: Purchase, consumeItem?: boolean) => Promise<void>;
  setPurchaseListener: (listener: (response: PurchaseResponse) => void) => { remove: () => void };
};

type PurchaseResponse = {
  responseCode: number;
  results?: Purchase[];
};

export type Product = {
  productId: string;
  title?: string;
  description?: string;
  price?: string;
};

export type Purchase = {
  productId: string;
  acknowledged?: boolean;
  transactionReceipt?: string;
};

const IOS_PRODUCT_IDS = ["eerme_premium_monthly", "eerme_premium_yearly"];
const ANDROID_PRODUCT_IDS = ["eerme_premium_monthly", "eerme_premium_yearly"];

function buildFallbackProducts(): Product[] {
  return [
    {
      productId: "eerme_premium_monthly",
      title: t("subscriptionMonthlyTitle"),
      description: t("subscriptionMonthlyDescription"),
      price: t("subscriptionMonthlyPrice"),
    },
    {
      productId: "eerme_premium_yearly",
      title: t("subscriptionYearlyTitle"),
      description: t("subscriptionYearlyDescription"),
      price: t("subscriptionYearlyPrice"),
    },
  ];
}

function getModule(): InAppPurchasesModule | null {
  if (Platform.OS === "web") {
    return null;
  }

  const candidate = ExpoInAppPurchases as unknown as Partial<InAppPurchasesModule>;
  const isValid =
    typeof candidate.connectAsync === "function" &&
    typeof candidate.disconnectAsync === "function" &&
    typeof candidate.getProductsAsync === "function" &&
    typeof candidate.getPurchaseHistoryAsync === "function" &&
    typeof candidate.purchaseItemAsync === "function" &&
    typeof candidate.finishTransactionAsync === "function" &&
    typeof candidate.setPurchaseListener === "function" &&
    !!candidate.IAPResponseCode &&
    typeof candidate.IAPResponseCode.OK === "number";

  return isValid ? (candidate as InAppPurchasesModule) : null;
}

export function getSubscriptionProductIds() {
  return Platform.OS === "ios" ? IOS_PRODUCT_IDS : ANDROID_PRODUCT_IDS;
}

export function getFallbackSubscriptionProducts() {
  return buildFallbackProducts();
}

export async function loadSubscriptionProducts() {
  const iap = getModule();
  if (!iap) {
    if (Platform.OS === "web") {
      return buildFallbackProducts();
    }

    throw new Error(t("iapLoadFailed"));
  }

  await iap.connectAsync();

  const response = await iap.getProductsAsync(getSubscriptionProductIds());
  if (response.responseCode !== iap.IAPResponseCode.OK) {
    throw new Error(t("subscriptionProductLoadFailed"));
  }

  return response.results;
}

export async function restoreSubscription(): Promise<boolean> {
  const iap = getModule();
  if (!iap) {
    throw new Error(t("iapLoadFailed"));
  }

  await iap.connectAsync();

  const history = await iap.getPurchaseHistoryAsync();
  if (history.responseCode !== iap.IAPResponseCode.OK) {
    throw new Error(t("purchaseHistoryFailed"));
  }

  return (history.results ?? []).some((item) => getSubscriptionProductIds().includes(item.productId));
}

export async function requestSubscription(productId: string) {
  const iap = getModule();
  if (!iap) {
    throw new Error(t("iapLoadFailed"));
  }

  await iap.connectAsync();
  await iap.purchaseItemAsync(productId);
}

export async function closeSubscriptionConnection() {
  const iap = getModule();
  if (!iap) return;
  await iap.disconnectAsync();
}

export function attachPurchaseListener(onPurchased: (purchase: Purchase) => void) {
  const iap = getModule();
  if (!iap) {
    return { remove: () => undefined };
  }

  return iap.setPurchaseListener(async ({ responseCode, results }) => {
    if (responseCode !== iap.IAPResponseCode.OK || !results?.length) return;

    const purchase = results.find((item) => getSubscriptionProductIds().includes(item.productId));
    if (!purchase) return;

    await iap.finishTransactionAsync(purchase, false);
    onPurchased(purchase);
  });
}
