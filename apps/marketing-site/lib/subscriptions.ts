import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STRIPE_PLANS } from "@/lib/stripe";

export function mapStripeStatusToSubscriptionStatus(
  stripeStatus: string | null | undefined,
): SubscriptionStatus {
  switch (stripeStatus) {
  case "active":
    return "active";
  case "trialing":
    return "trialing";
  case "past_due":
    return "past_due";
  case "canceled":
    return "canceled";
  case "incomplete":
  case "incomplete_expired":
    return "incomplete";
  case "unpaid":
    return "unpaid";
  default:
    return "inactive";
  }
}

export function mapStripePriceIdToPlan(
  priceId: string | null | undefined,
): SubscriptionPlan {
  if (!priceId) return "free";
  if (priceId === STRIPE_PLANS.PRO_MONTHLY) return "pro_monthly";
  if (priceId === STRIPE_PLANS.PRO_YEARLY) return "pro_yearly";
  if (priceId === STRIPE_PLANS.LIFETIME) return "lifetime";
  return "free";
}

export async function upsertSubscriptionForUser(input: {
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeSessionId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
}) {
  const payload = {
    plan: input.plan,
    status: input.status,
    stripeCustomerId: input.stripeCustomerId || null,
    stripeSubscriptionId: input.stripeSubscriptionId || null,
    stripePriceId: input.stripePriceId || null,
    stripeSessionId: input.stripeSessionId || null,
    currentPeriodStart: input.currentPeriodStart || null,
    currentPeriodEnd: input.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    canceledAt: input.canceledAt || null,
  };

  const existing = await prisma.subscription.findFirst({
    where: { userId: input.userId },
    select: { id: true },
  });

  if (existing?.id) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.subscription.create({
    data: {
      userId: input.userId,
      ...payload,
    },
  });
}

