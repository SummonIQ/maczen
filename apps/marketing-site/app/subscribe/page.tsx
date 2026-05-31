"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import { getAnalytics } from "@summoniq/signalsplash-client-sdk";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Loader2, Shield, Sparkles, Zap } from "lucide-react";
import { HeroBackground } from "../_components/hero-background";
import { trackMetaEvent } from "@/lib/meta-pixel";

type CheckoutPlan = "PRO_MONTHLY" | "PRO_YEARLY";

const PLAN_VALUES: Record<CheckoutPlan, number> = {
  PRO_MONTHLY: 9,
  PRO_YEARLY: 79,
};

function getCookie(name: string) {
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
}

function getMetaBrowserIds() {
  const fbp = getCookie("_fbp");
  const existingFbc = getCookie("_fbc");
  const url = new URL(window.location.href);
  const fbclid = url.searchParams.get("fbclid");
  const fbc =
    existingFbc || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : "");

  return {
    fbp,
    fbc,
    eventSourceUrl: window.location.href,
  };
}

const PLAN_OPTIONS: Array<{
  id: CheckoutPlan;
  name: string;
  tagline: string;
  price: string;
  detail: string;
  featured?: boolean;
}> = [
  {
    id: "PRO_YEARLY",
    name: "Annual",
    tagline: "Best value",
    price: "$79",
    detail: "$6.58/mo • Save $29/year",
    featured: true,
  },
  {
    id: "PRO_MONTHLY",
    name: "Monthly",
    tagline: "Flexible plan",
    price: "$9",
    detail: "Cancel anytime",
  },
];

function SubscribePageContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan>("PRO_YEARLY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const initialPlan = searchParams.get("plan");
    if (initialPlan === "PRO_MONTHLY" || initialPlan === "PRO_YEARLY") {
      setSelectedPlan(initialPlan);
    }
  }, [searchParams]);

  useEffect(() => {
    trackMetaEvent("ViewContent", {
      content_name: "MacZen Pro Plan",
      content_category: "subscription",
      content_ids: [selectedPlan],
      content_type: "product",
      currency: "USD",
      value: PLAN_VALUES[selectedPlan],
    });
    getAnalytics()?.track("pricing_page_viewed", { plan: selectedPlan });
  }, [selectedPlan]);

  const handleCheckout = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");
    track("Checkout started", { plan: selectedPlan });
    getAnalytics()?.track("checkout_started", { plan: selectedPlan, value: PLAN_VALUES[selectedPlan] });
    trackMetaEvent("InitiateCheckout", {
      content_name: "MacZen Pro Plan",
      content_category: "subscription",
      content_ids: [selectedPlan],
      content_type: "product",
      currency: "USD",
      value: PLAN_VALUES[selectedPlan],
      num_items: 1,
    });

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          planType: selectedPlan,
          ...getMetaBrowserIds(),
        }),
      });

      const data = await response.json();

      if (data.url) {
        getAnalytics()?.track("checkout_redirected", { plan: selectedPlan });
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to create checkout session");
        getAnalytics()?.track("checkout_error", { plan: selectedPlan, error: data.error });
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden bg-background py-24 min-h-screen flex items-center justify-center">
        <HeroBackground />
        <div className="relative z-10 w-full max-w-md p-4">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 mb-4 shadow-lg shadow-fuchsia-500/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Choose your Pro plan</h1>
            <p className="text-muted-foreground text-sm">
              Unlock all features and supercharge your workflow
            </p>
          </div>

          {/* Pro Features */}
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-fuchsia-500/5 to-purple-500/5 border border-fuchsia-500/10">
            <h3 className="text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400 mb-3 uppercase tracking-wide">Everything in Pro</h3>
            <ul className="space-y-2">
              {[
                "AI-powered auto-organization",
                "OCR text search in screenshots",
                "Cloud backup & sync",
                "Advanced analytics",
                "Priority support",
                "Unlimited screenshots",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-foreground/80">
                  <Check className="h-4 w-4 text-fuchsia-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative bg-white dark:bg-card rounded-2xl p-5 shadow-xl shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-radial from-fuchsia-200/50 to-transparent dark:from-fuchsia-500/15 pointer-events-none blur-xl" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-gradient-radial from-purple-200/50 to-transparent dark:from-purple-500/15 pointer-events-none blur-xl" />

            <div className="space-y-3 mb-6">
              {PLAN_OPTIONS.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative w-full p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? "border-fuchsia-500 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5"
                        : "border-border/50 hover:border-fuchsia-500/50 hover:bg-muted/30"
                    }`}
                  >
                    {isSelected && plan.featured && (
                      <div className="absolute -top-2.5 left-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white px-2 py-0.5 rounded-full">
                          <Zap className="h-2.5 w-2.5" />
                          BEST VALUE
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div
                        className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full border-2 transition-all ${
                          isSelected
                            ? "border-fuchsia-500 bg-fuchsia-500"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>

                      <div className="flex-1">
                        <div className="font-medium text-sm">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">{plan.tagline}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-bold">{plan.price}</div>
                        <div className="text-xs text-muted-foreground">{plan.detail}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-border/50 bg-background/50 text-sm focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/20 outline-none transition-all"
              />
            </div>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-sm font-semibold hover:from-fuchsia-600 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-fuchsia-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  Continue to Payment
                  <span className="opacity-80">
                    • {selectedPlan === "PRO_YEARLY" ? "$79/year" : "$9/mo"}
                  </span>
                </>
              )}
            </button>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Secure checkout powered by Stripe</span>
            </div>
          </div>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SubscribePageContent />
    </Suspense>
  );
}
