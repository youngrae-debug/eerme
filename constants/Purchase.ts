export const ProductIDs = {
  monthly: "eerme.premium.monthly",
  annual: "eerme.premium.yearly",
} as const;

export const SubscriptionProductIDs = [ProductIDs.monthly, ProductIDs.annual] as const;

export type SubscriptionProductId = (typeof SubscriptionProductIDs)[number];
