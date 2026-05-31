"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import { getAnalytics } from "@summoniq/signalsplash-client-sdk";
import { useState } from "react";
import { Check } from "lucide-react";
import { TrackedDownloadLink } from "./tracked-download-link";

const FREE_PLAN = {
  name: "Free",
  price: "$0",
  period: null as string | null,
  description: "Perfect for getting started",
  features: [
    "Screenshot + recording capture",
    "Desktop + Apple Photos sources",
    "Drag-and-drop album workflow",
    "Indexed + OCR text search",
    "Grid/list/gallery with fast previews",
  ],
  cta: "Get Started",
  href: "/download",
};

const PRO_MONTHLY = {
  name: "Pro",
  price: "$9",
  period: "/month",
  description: "Flexible month-to-month",
  features: [
    "Everything in Free",
    "AI-powered organization",
    "Smarter album suggestions",
    "Priority product updates",
    "Cancel anytime",
  ],
  cta: "Choose Monthly",
  href: "/pricing?plan=PRO_MONTHLY",
};

const PRO_YEARLY = {
  name: "Pro",
  price: "$79",
  period: "/year",
  description: "Best value for daily workflows",
  features: [
    "Everything in Pro Monthly",
    "AI-powered organization",
    "Smarter album suggestions",
    "Priority product updates",
    "Save $29 vs monthly",
  ],
  cta: "Choose Yearly",
  href: "/pricing?plan=PRO_YEARLY",
  popular: true,
};

export function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const proPlan = billing === "yearly" ? PRO_YEARLY : PRO_MONTHLY;

  return (
    <div className="flex flex-wrap justify-center gap-8 max-w-5xl mx-auto">
      {/* Free plan card */}
      <div className="relative rounded-2xl p-8 w-full sm:w-[380px] bg-white dark:bg-card shadow-xl shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-radial from-fuchsia-200/50 to-transparent dark:from-fuchsia-500/15 pointer-events-none blur-2xl" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-gradient-radial from-purple-200/50 to-transparent dark:from-purple-500/15 pointer-events-none blur-2xl" />
        <div className="relative mb-8">
          <h3 className="text-2xl font-bold mb-2">{FREE_PLAN.name}</h3>
          <div className="mb-4">
            <span className="text-4xl font-bold">{FREE_PLAN.price}</span>
          </div>
          <p className="text-muted-foreground">{FREE_PLAN.description}</p>
        </div>
        <ul className="relative mb-8 space-y-3">
          {FREE_PLAN.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-fuchsia-500 shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <TrackedDownloadLink
          href={FREE_PLAN.href}
          source="pricing_free"
          className="relative block w-full rounded-full py-3 text-center font-medium transition-all bg-gradient-to-br from-gray-800 to-gray-950 dark:from-gray-200 dark:to-gray-100 text-white dark:text-gray-900 hover:from-gray-700 hover:to-gray-900 dark:hover:from-gray-300 dark:hover:to-gray-200"
        >
          {FREE_PLAN.cta}
        </TrackedDownloadLink>
      </div>

      {/* Pro plan card with tabs */}
      <div className="relative rounded-2xl p-8 w-full sm:w-[380px] bg-white dark:bg-card shadow-xl shadow-black/5 ring-2 ring-fuchsia-500">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-radial from-fuchsia-200/50 to-transparent dark:from-fuchsia-500/15 pointer-events-none blur-2xl" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-gradient-radial from-purple-200/50 to-transparent dark:from-purple-500/15 pointer-events-none blur-2xl" />

        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <span className="rounded-full border-t border-t-white/70 border-b border-b-black/10 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-4 py-1 text-sm font-semibold text-white shadow-sm shadow-fuchsia-500/20">
            Most Popular
          </span>
        </div>

        {/* Billing toggle - styled like hero pill */}
        <div className="relative mb-6 mt-2">
          <div
            role="tablist"
            className="inline-flex rounded-full border border-black/[0.08] dark:border-white/10 bg-black/[0.04] dark:bg-white/5 p-1 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={billing === "monthly"}
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billing === "yearly"}
              onClick={() => setBilling("yearly")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                billing === "yearly"
                  ? "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="relative mb-8">
          <h3 className="text-2xl font-bold mb-2">{proPlan.name}</h3>
          <div className="mb-4">
            <span className="text-4xl font-bold">{proPlan.price}</span>
            {proPlan.period && (
              <span className="text-muted-foreground">{proPlan.period}</span>
            )}
          </div>
          <p className="text-muted-foreground">{proPlan.description}</p>
        </div>
        <ul className="relative mb-8 space-y-3">
          {proPlan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-fuchsia-500 shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link
          href={proPlan.href}
          onClick={() => {
            track("Pro plan CTA", { plan: proPlan.cta });
            getAnalytics()?.track("pricing_cta_clicked", { plan: billing, cta: proPlan.cta });
          }}
          className="relative block w-full rounded-full py-3 text-center font-medium transition-all bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white hover:from-fuchsia-600 hover:to-purple-700 shadow-md shadow-fuchsia-500/20"
        >
          {proPlan.cta}
        </Link>
      </div>
    </div>
  );
}
