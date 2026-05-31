import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const STRIPE_PLANS = {
  PRO_MONTHLY: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
  PRO_YEARLY: process.env.STRIPE_PRICE_ID_PRO_YEARLY,
  LIFETIME: process.env.STRIPE_PRICE_ID_LIFETIME,
} as const;

export type StripePlanType = keyof typeof STRIPE_PLANS;

export const isValidStripePlanType = (value: unknown): value is StripePlanType =>
  value === "PRO_MONTHLY" || value === "PRO_YEARLY" || value === "LIFETIME";
