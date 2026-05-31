"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { usePathname } from "next/navigation";
import {
  getAnalytics,
  initAnalytics,
  type AnalyticsConfig,
} from "@/lib/analytics/client";

interface AnalyticsContextValue {
  track: (name: string, properties?: Record<string, unknown>) => void;
  pageView: (properties?: Record<string, unknown>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

function PageTracker({ clientRef }: { clientRef: React.RefObject<ReturnType<typeof getAnalytics> | null> }) {
  const pathname = usePathname();
  const lastPathRef = useRef("");

  useEffect(() => {
    const currentPath = pathname ?? "";
    if (currentPath !== lastPathRef.current) {
      lastPathRef.current = currentPath;
      setTimeout(() => {
        clientRef.current?.pageView();
      }, 0);
    }
  }, [pathname, clientRef]);

  return null;
}

export function AnalyticsProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config: AnalyticsConfig;
}) {
  const clientRef = useRef<ReturnType<typeof getAnalytics>>(null);

  useEffect(() => {
    clientRef.current = initAnalytics(config);
    return () => {
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, [config]);

  const track = useCallback((name: string, properties?: Record<string, unknown>) => {
    clientRef.current?.track(name, properties);
  }, []);

  const pageView = useCallback((properties?: Record<string, unknown>) => {
    clientRef.current?.pageView(properties);
  }, []);

  const value: AnalyticsContextValue = { track, pageView };

  return (
    <AnalyticsContext.Provider value={value}>
      <PageTracker clientRef={clientRef} />
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsContextValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    return {
      track: () => {},
      pageView: () => {},
    };
  }
  return ctx;
}
