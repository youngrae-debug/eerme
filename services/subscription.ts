import Constants from "expo-constants";
import { Platform } from "react-native";
import { ProductIDs, SubscriptionProductIDs } from "../constants/Purchase";
import { t } from "../utils/i18n";

type RevenueCatProduct = {
  identifier: string;
  title?: string;
  description?: string;
  priceString?: string;
};

type RevenueCatPackage = {
  identifier: string;
  product: RevenueCatProduct;
};

type RevenueCatCustomerInfo = {
  activeSubscriptions?: string[];
  entitlements?: {
    active?: Record<string, unknown>;
  };
};

type RevenueCatOfferings = {
  current?: {
    availablePackages?: RevenueCatPackage[];
  } | null;
};

type RevenueCatModule = {
  configure: (options: { apiKey: string }) => void;
  setLogLevel?: (logLevel: unknown) => void;
  LOG_LEVEL?: {
    DEBUG?: unknown;
  };
  getOfferings: () => Promise<RevenueCatOfferings>;
  purchasePackage: (pkg: RevenueCatPackage) => Promise<{ customerInfo?: RevenueCatCustomerInfo }>;
  restorePurchases: () => Promise<RevenueCatCustomerInfo>;
  addCustomerInfoUpdateListener?: (listener: (customerInfo: RevenueCatCustomerInfo) => void) => void;
  removeCustomerInfoUpdateListener?: (listener: (customerInfo: RevenueCatCustomerInfo) => void) => void;
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

type ExtraConfig = {
  revenueCat?: {
    apiKey?: string;
    iosApiKey?: string;
    androidApiKey?: string;
    entitlementId?: string;
  };
};

const DEFAULT_ENTITLEMENT_ID = "premium";

let configured = false;
let configuring: Promise<void> | null = null;
let lastPackages: RevenueCatPackage[] = [];

function getExtraConfig(): ExtraConfig {
  const expoExtra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  const legacyExtra = (Constants.manifest2?.extra ?? {}) as ExtraConfig;
  return expoExtra.revenueCat ? expoExtra : legacyExtra;
}

function getRevenueCatEntitlementId() {
  return getExtraConfig().revenueCat?.entitlementId ?? DEFAULT_ENTITLEMENT_ID;
}

function getRevenueCatApiKey() {
  const config = getExtraConfig().revenueCat;
  if (Platform.OS === "ios") return config?.iosApiKey ?? config?.apiKey ?? "";
  if (Platform.OS === "android") return config?.androidApiKey ?? config?.apiKey ?? "";
  return config?.apiKey ?? "";
}

function buildFallbackProducts(): Product[] {
  return [
    {
      productId: ProductIDs.monthly,
      title: t("subscriptionMonthlyTitle"),
      description: t("subscriptionMonthlyDescription"),
      price: t("subscriptionMonthlyPrice"),
    },
    {
      productId: ProductIDs.annual,
      title: t("subscriptionYearlyTitle"),
      description: t("subscriptionYearlyDescription"),
      price: t("subscriptionYearlyPrice"),
    },
  ];
}

function isRevenueCatModule(value: unknown): value is RevenueCatModule {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RevenueCatModule>;

  return (
    typeof candidate.configure === "function" &&
    typeof candidate.getOfferings === "function" &&
    typeof candidate.purchasePackage === "function" &&
    typeof candidate.restorePurchases === "function"
  );
}

function getRevenueCatModule(): RevenueCatModule | null {
  if (Platform.OS === "web") return null;
  if (Constants.executionEnvironment === "storeClient") return null;

  let moduleValue: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    moduleValue = require("react-native-purchases") as unknown;
  } catch {
    return null;
  }

  const asObject = moduleValue && typeof moduleValue === "object" ? (moduleValue as Record<string, unknown>) : null;
  const candidates = [moduleValue, asObject?.default].filter(isRevenueCatModule);
  return candidates[0] ?? null;
}

async function ensureConfigured(module: RevenueCatModule) {
  if (configured) return;
  if (configuring) {
    await configuring;
    return;
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    throw new Error(t("iapLoadFailed"));
  }

  configuring = Promise.resolve().then(() => {
    module.configure({ apiKey });
    configured = true;
  }).finally(() => {
    configuring = null;
  });

  await configuring;
}

function hasPremium(customerInfo?: RevenueCatCustomerInfo) {
  if (!customerInfo) return false;

  const entitlementId = getRevenueCatEntitlementId();
  const activeEntitlements = customerInfo.entitlements?.active ?? {};
  if (activeEntitlements[entitlementId]) {
    return true;
  }

  return (customerInfo.activeSubscriptions ?? []).length > 0;
}

export function getSubscriptionProductIds() {
  return [...SubscriptionProductIDs];
}

export function getFallbackSubscriptionProducts() {
  return buildFallbackProducts();
}

export async function loadSubscriptionProducts() {
  const rc = getRevenueCatModule();
  if (!rc) {
    return buildFallbackProducts();
  }

  try {
    await ensureConfigured(rc);

    const offerings = await rc.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    lastPackages = packages;

    if (packages.length === 0) {
      return buildFallbackProducts();
    }

    return packages.map((pkg) => ({
      productId: pkg.product.identifier,
      title: pkg.product.title,
      description: pkg.product.description,
      price: pkg.product.priceString,
    }));
  } catch {
    return buildFallbackProducts();
  }
}

function findPackageByProductId(productId: string): RevenueCatPackage | null {
  const byProduct = lastPackages.find((pkg) => pkg.product.identifier === productId);
  if (byProduct) return byProduct;

  const byPackageId = lastPackages.find((pkg) => pkg.identifier === productId);
  return byPackageId ?? null;
}

export async function restoreSubscription(): Promise<boolean> {
  const rc = getRevenueCatModule();
  if (!rc) {
    if (Constants.executionEnvironment === "storeClient") {
      throw new Error(t("iapExpoGoUnsupported"));
    }
    throw new Error(t("iapLoadFailed"));
  }

  await ensureConfigured(rc);
  const customerInfo = await rc.restorePurchases();
  return hasPremium(customerInfo);
}

export async function requestSubscription(productId: string) {
  const rc = getRevenueCatModule();
  if (!rc) {
    if (Constants.executionEnvironment === "storeClient") {
      throw new Error(t("iapExpoGoUnsupported"));
    }
    throw new Error(t("iapLoadFailed"));
  }

  await ensureConfigured(rc);

  if (lastPackages.length === 0) {
    const offerings = await rc.getOfferings();
    lastPackages = offerings.current?.availablePackages ?? [];
  }

  const targetPackage = findPackageByProductId(productId);
  if (!targetPackage) {
    throw new Error(t("subscriptionProductLoadFailed"));
  }

  await rc.purchasePackage(targetPackage);
}

export async function closeSubscriptionConnection() {
  return Promise.resolve();
}

export async function initializeSubscriptionSDK() {
  const rc = getRevenueCatModule();
  if (!rc) return;

  if (rc.setLogLevel && rc.LOG_LEVEL?.DEBUG !== undefined) {
    rc.setLogLevel(rc.LOG_LEVEL.DEBUG);
  }

  await ensureConfigured(rc);
}

export function attachPurchaseListener(onPurchased: (purchase: Purchase) => void) {
  const rc = getRevenueCatModule();
  if (!rc) {
    return { remove: () => undefined };
  }

  const listener = (customerInfo: RevenueCatCustomerInfo) => {
    if (!hasPremium(customerInfo)) return;
    const productId = customerInfo.activeSubscriptions?.[0] ?? getRevenueCatEntitlementId();
    onPurchased({ productId });
  };

  if (typeof rc.addCustomerInfoUpdateListener !== "function" || typeof rc.removeCustomerInfoUpdateListener !== "function") {
    return { remove: () => undefined };
  }

  rc.addCustomerInfoUpdateListener(listener);

  return {
    remove: () => {
      rc.removeCustomerInfoUpdateListener?.(listener);
    },
  };
}
