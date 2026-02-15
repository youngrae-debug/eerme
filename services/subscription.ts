import { NativeModules, Platform } from "react-native";

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

type UnknownModule = { default?: unknown; InAppPurchases?: unknown } & Record<string, unknown>;


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

const IOS_PRODUCT_IDS = ["eerme_premium_monthly"];
const ANDROID_PRODUCT_IDS = ["eerme_premium_monthly"];

function isNativeIapModule(value: unknown): value is InAppPurchasesModule {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<InAppPurchasesModule>;
  return (
    typeof candidate.connectAsync === "function" &&
    typeof candidate.disconnectAsync === "function" &&
    typeof candidate.getProductsAsync === "function" &&
    typeof candidate.getPurchaseHistoryAsync === "function" &&
    typeof candidate.purchaseItemAsync === "function" &&
    typeof candidate.finishTransactionAsync === "function" &&
    typeof candidate.setPurchaseListener === "function" &&
    !!candidate.IAPResponseCode &&
    typeof candidate.IAPResponseCode.OK === "number"
  );
}

function tryGetModule(): InAppPurchasesModule | null {
  if (Platform.OS === "web") {
    return null;
  }

  if (!(NativeModules as Record<string, unknown>)?.ExpoInAppPurchases) {
    return null;
  }

  let requiredModule: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    requiredModule = require("expo-in-app-purchases") as unknown;
  } catch {
    return null;
  }

  const rawModule: UnknownModule | null =
    requiredModule && typeof requiredModule === "object"
      ? (requiredModule as UnknownModule)
      : null;

  const resolved = [
    rawModule,
    rawModule?.default,
    rawModule?.InAppPurchases,
    rawModule?.default && typeof rawModule.default === "object"
      ? (rawModule.default as UnknownModule).InAppPurchases
      : undefined,
  ].find(isNativeIapModule);

  return resolved ?? null;
}

function getModule(): InAppPurchasesModule {
  const resolved = tryGetModule();
  if (!resolved) {
    throw new Error(
      "expo-in-app-purchases 네이티브 모듈을 찾지 못했습니다. Expo Go에서는 동작하지 않습니다. 커스텀 개발 빌드 또는 스토어 빌드에서 실행해 주세요.",
    );
  }

  return resolved;
}

export function getSubscriptionProductIds() {
  return Platform.OS === "ios" ? IOS_PRODUCT_IDS : ANDROID_PRODUCT_IDS;
}

export async function loadSubscriptionProducts() {
  const iap = tryGetModule();
  if (!iap) {
    return [] as Product[];
  }

  await iap.connectAsync();

  const response = await iap.getProductsAsync(getSubscriptionProductIds());
  if (response.responseCode !== iap.IAPResponseCode.OK) {
    throw new Error("구독 상품 정보를 불러오지 못했습니다.");
  }

  return response.results;
}

export async function restoreSubscription(): Promise<boolean> {
  const iap = getModule();
  await iap.connectAsync();

  const history = await iap.getPurchaseHistoryAsync();
  if (history.responseCode !== iap.IAPResponseCode.OK) {
    throw new Error("구매 내역 조회에 실패했습니다.");
  }

  return (history.results ?? []).some((item) => getSubscriptionProductIds().includes(item.productId));
}

export async function requestSubscription(productId: string) {
  const iap = getModule();
  await iap.connectAsync();
  await iap.purchaseItemAsync(productId);
}

export async function closeSubscriptionConnection() {
  const iap = tryGetModule();
  if (!iap) return;
  await iap.disconnectAsync();
}

export function attachPurchaseListener(onPurchased: (purchase: Purchase) => void) {
  const iap = tryGetModule();
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
