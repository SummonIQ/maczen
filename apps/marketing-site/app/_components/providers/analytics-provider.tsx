"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  AnalyticsProvider,
  WebVitals,
  useAnalytics,
} from "@summoniq/signalsplash-client-sdk/react";
import type { AnalyticsConfig } from "@summoniq/signalsplash-client-sdk";
import { useSession } from "@/lib/auth/client";

const envEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim();
const defaultEndpoint =
  process.env.NODE_ENV === "production"
    ? "https://api.signalsplash.com/api/events"
    : "";
const resolvedEndpoint = envEndpoint || defaultEndpoint;
const isEnabled =
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "false" &&
  Boolean(resolvedEndpoint);

const config: AnalyticsConfig = {
  appId: "maczen",
  endpoint: resolvedEndpoint || undefined,
  enabled: isEnabled,
  debug: process.env.NODE_ENV === "development",
  trackPageViews: true,
  trackWebVitals: true,
  sessionTimeout: 30,
  respectDoNotTrack: true,
};

// Cast to any to avoid React 19 vs SDK types mismatch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SDKProvider = AnalyticsProvider as any;

function AnalyticsIdentify() {
  const { data: session } = useSession();
  const { identify, reset } = useAnalytics();
  const lastIdentifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    const user = session?.user as
      | {
          id: string;
          email?: string | null;
          name?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          createdAt?: string | Date | null;
        }
      | undefined;

    if (user) {
      const createdAt =
        user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : (user.createdAt ?? undefined);
      identify(user.id, {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        createdAt: createdAt ?? undefined,
      });
      lastIdentifiedUserId.current = user.id;
      return;
    }

    if (lastIdentifiedUserId.current) {
      reset();
      lastIdentifiedUserId.current = null;
    }
  }, [
    session?.user?.id,
    session?.user?.email,
    session?.user?.name,
    identify,
    reset,
  ]);

  return null;
}

export function AppAnalyticsProvider({ children }: { children: ReactNode }) {
  return (
    <SDKProvider config={config}>
      <WebVitals />
      <AnalyticsIdentify />
      {children}
    </SDKProvider>
  );
}
