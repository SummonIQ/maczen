import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

export type FeatureEntitlements = {
  aiOrganization: boolean;
  ocrTextSearch: boolean;
  cloudBackup: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  unlimitedScreenshots: boolean;
};

export const DEFAULT_ENTITLEMENTS: FeatureEntitlements = {
  aiOrganization: false,
  ocrTextSearch: false,
  cloudBackup: false,
  prioritySupport: false,
  advancedAnalytics: false,
  unlimitedScreenshots: true,
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "trialing",
]);

export function getEntitlementsFromSubscription(input: {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
} | null): FeatureEntitlements {
  if (!input) {
    return DEFAULT_ENTITLEMENTS;
  }

  const isPaidPlan =
    input.plan === "pro_monthly" ||
    input.plan === "pro_yearly" ||
    input.plan === "lifetime";
  const isActive =
    input.plan === "lifetime" || ACTIVE_SUBSCRIPTION_STATUSES.has(input.status);

  if (!isPaidPlan || !isActive) {
    return DEFAULT_ENTITLEMENTS;
  }

  return {
    aiOrganization: true,
    ocrTextSearch: true,
    cloudBackup: true,
    prioritySupport: true,
    advancedAnalytics: true,
    unlimitedScreenshots: true,
  };
}

