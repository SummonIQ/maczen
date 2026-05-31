"use client";

import Link from "next/link";
import { Check, Download, ArrowRight, Copy, Key } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { getAnalytics } from "@summoniq/signalsplash-client-sdk";
import { HeroBackground } from "../_components/hero-background";
import { trackMetaEvent } from "@/lib/meta-pixel";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const trackedPurchaseSessionId = useRef<string | null>(null);
  const identifiedSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/license/session?session_id=${encodeURIComponent(sessionId)}`,
        );
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || "Failed to load license key");
        }
        const data = (await response.json()) as {
          sessionId: string;
          licenseKey: string;
          email?: string | null;
          plan?: string | null;
          stripeCustomerId?: string | null;
          amountTotal: number | null;
          currency: string | null;
        };

        if (!cancelled) {
          setLicenseKey(data.licenseKey);

          if (trackedPurchaseSessionId.current !== data.sessionId) {
            trackMetaEvent(
              "Purchase",
              {
                currency: (data.currency || "USD").toUpperCase(),
                value: data.amountTotal ?? undefined,
              },
              { eventID: data.sessionId },
            );
            trackedPurchaseSessionId.current = data.sessionId;
          }

          if (identifiedSessionId.current !== data.sessionId) {
            const userId = data.stripeCustomerId || data.email;
            if (userId) {
              getAnalytics()?.identify(userId, {
                email: data.email ?? undefined,
                plan: data.plan ?? undefined,
                stripeCustomerId: data.stripeCustomerId ?? undefined,
                stripeSessionId: data.sessionId,
              });
              identifiedSessionId.current = data.sessionId;
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load license");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const copyLicenseKey = () => {
    if (licenseKey) {
      navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <HeroBackground />
      <div className="relative z-10 flex items-center justify-center min-h-screen py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
              <Check className="h-10 w-10 text-white" />
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
              Thank you for your purchase!
            </h1>

            <p className="text-xl text-muted-foreground mb-10">
              Your MacZen Pro license is ready. Copy your license key below and
              enter it in the app to activate.
            </p>

            {loading && (
              <div className="mb-10 p-6 rounded-2xl border border-border bg-card">
                <p className="text-sm text-muted-foreground">
                  Loading your license key...
                </p>
              </div>
            )}

            {error && (
              <div className="mb-10 p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {licenseKey && !loading && (
              <div className="mb-10 p-6 rounded-2xl border-2 border-purple-500/30 bg-purple-500/5">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Key className="h-5 w-5 text-purple-500" />
                  <span className="text-sm font-medium text-purple-600">
                    Your License Key
                  </span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <code className="text-2xl font-mono font-bold tracking-wider text-foreground">
                    {licenseKey}
                  </code>
                  <button
                    onClick={copyLicenseKey}
                    className="p-2 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors"
                    title="Copy license key"
                  >
                    <Copy
                      className={`h-5 w-5 ${
                        copied ? "text-green-600" : "text-purple-600"
                      }`}
                    />
                  </button>
                </div>
                {copied && (
                  <p className="mt-2 text-sm text-green-600 font-medium">
                    Copied to clipboard!
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <a
                href="/downloads/MacZen.dmg"
                download
                className="group inline-flex items-center justify-center gap-2 rounded-full border-t border-t-white/70 border-b border-b-black/10 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
              >
                <Download className="h-5 w-5" />
                Download MacZen
              </a>
              <Link
                href="/"
                className="group inline-flex items-center justify-center gap-2 rounded-full border border-black/20 bg-white px-8 py-4 text-lg font-semibold transition-all hover:bg-gray-50"
              >
                Back to Home
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="mt-12 p-6 rounded-2xl border border-border bg-card">
              <h2 className="text-lg font-semibold mb-4">How to activate</h2>
              <ul className="text-left space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Download and install MacZen on your Mac</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Open Settings (gear icon in title bar)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Paste your license key and click Activate</span>
                </li>
              </ul>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              Save your license key somewhere safe. A copy has also been sent to
              your email.
              <br />
              Need help?{" "}
              <Link
                href="mailto:support@maczen.app"
                className="text-primary hover:underline"
              >
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
