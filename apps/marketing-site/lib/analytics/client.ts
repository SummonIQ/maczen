/**
 * AppLab-style analytics client.
 * POSTs events to /api/analytics (or custom endpoint); payload shape matches gimme-job @summoniq/signalsplash-client-sdk.
 */

const SESSION_STORAGE_KEY = "applab_analytics_session";
const ANONYMOUS_ID_KEY = "applab_analytics_anonymous_id";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 3) | 8;
    return v.toString(16);
  });
}

function getAnonymousId(): string {
  if (typeof window === "undefined") return generateId();
  const stored = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (stored) return stored;
  const id = generateId();
  localStorage.setItem(ANONYMOUS_ID_KEY, id);
  return id;
}

function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua))
    return "mobile";
  if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) return "tablet";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

function getPageContext() {
  if (typeof window === "undefined") {
    return {
      url: "",
      path: "",
      title: "",
      referrer: "",
      search: "",
      hash: "",
      host: "",
    };
  }
  return {
    url: window.location.href,
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer,
    search: window.location.search,
    hash: window.location.hash,
    host: window.location.host,
  };
}

function getDeviceContext() {
  if (typeof window === "undefined") {
    return {
      screenWidth: 0,
      screenHeight: 0,
      viewportWidth: 0,
      viewportHeight: 0,
      devicePixelRatio: 1,
      deviceType: "desktop" as const,
      language: "en",
      timezone: "UTC",
      touchEnabled: false,
    };
  }
  return {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    deviceType: getDeviceType(),
    language: navigator.language || "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    touchEnabled: "ontouchstart" in window || navigator.maxTouchPoints > 0,
  };
}

function getEventContext() {
  return {
    page: getPageContext(),
    device: getDeviceContext(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    sdkVersion: "1.0.0",
  };
}

export interface AnalyticsConfig {
  appId: string;
  endpoint?: string;
  enabled?: boolean;
  debug?: boolean;
  respectDoNotTrack?: boolean;
  trackPageViews?: boolean;
  sessionTimeout?: number;
}

interface Session {
  id: string;
  startedAt: number;
  lastActivityAt: number;
  pageViews: number;
  isNew: boolean;
  entryPage: string;
  entryReferrer: string;
}

interface QueuedEvent {
  id: string;
  appId: string;
  sessionId: string;
  anonymousId: string;
  userId?: string;
  name: string;
  type: string;
  properties?: Record<string, unknown>;
  timestamp: number;
  context: ReturnType<typeof getEventContext>;
}

export class AnalyticsClient {
  private config: Required<
    Pick<
      AnalyticsConfig,
      | "appId"
      | "enabled"
      | "debug"
      | "respectDoNotTrack"
      | "trackPageViews"
      | "sessionTimeout"
    >
  > & { endpoint: string };
  private queue: QueuedEvent[] = [];
  private isProcessing = false;
  private session: Session | null = null;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private lastPagePath: string | null = null;
  private lastPageTime: number | null = null;

  constructor(config: AnalyticsConfig) {
    this.config = {
      appId: config.appId,
      endpoint: config.endpoint ?? "/api/analytics",
      enabled: config.enabled ?? true,
      debug: config.debug ?? false,
      respectDoNotTrack: config.respectDoNotTrack ?? true,
      trackPageViews: config.trackPageViews ?? true,
      sessionTimeout: config.sessionTimeout ?? 30,
    };
    if (typeof window !== "undefined") {
      this.initialize();
    }
  }

  private log(message: string, ...args: unknown[]) {
    if (this.config.debug) {
      console.log(`[AppLab Analytics] ${message}`, ...args);
    }
  }

  private initialize() {
    if (
      this.config.respectDoNotTrack &&
      typeof navigator !== "undefined" &&
      navigator.doNotTrack === "1"
    ) {
      this.config.enabled = false;
      this.log("Analytics disabled due to Do Not Track");
      return;
    }
    this.initializeSession();
    this.flushInterval = setInterval(() => this.flush(), 5000);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flush();
      });
      window.addEventListener("beforeunload", () => this.flush());
    }
    this.log("Analytics initialized");
  }

  private initializeSession() {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const now = Date.now();
    const timeout = this.config.sessionTimeout * 60 * 1000;

    if (stored) {
      try {
        const session = JSON.parse(stored) as Session;
        if (now - session.lastActivityAt < timeout) {
          this.session = { ...session, lastActivityAt: now, isNew: false };
          this.saveSession();
          this.log("Session restored", this.session.id);
          return;
        }
      } catch {
        // invalid session
      }
    }

    this.session = {
      id: generateId(),
      startedAt: now,
      lastActivityAt: now,
      pageViews: 0,
      isNew: true,
      entryPage: window.location.pathname,
      entryReferrer: document.referrer,
    };
    this.saveSession();
    this.trackEvent("session_start", "session_start", {
      entryPage: this.session.entryPage,
      entryReferrer: this.session.entryReferrer,
    });
    this.log("New session started", this.session.id);
  }

  private saveSession() {
    if (this.session && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.session));
    }
  }

  private updateSession() {
    if (this.session) {
      this.session.lastActivityAt = Date.now();
      this.saveSession();
    }
  }

  private trackEvent(
    name: string,
    type: string,
    properties?: Record<string, unknown>
  ) {
    if (!this.config.enabled) return;
    this.updateSession();
    const event: QueuedEvent = {
      id: generateId(),
      appId: this.config.appId,
      sessionId: this.session?.id ?? generateId(),
      anonymousId: getAnonymousId(),
      name,
      type,
      properties,
      timestamp: Date.now(),
      context: getEventContext(),
    };
    this.queue.push(event);
    this.log("Event tracked", name, properties);
    if (this.queue.length >= 10) this.flush();
  }

  pageView(properties?: Record<string, unknown>) {
    if (!this.config.enabled) return;
    const now = Date.now();
    const pageContext = getPageContext();
    let previousPageDuration: number | undefined;
    if (this.lastPagePath && this.lastPageTime) {
      previousPageDuration = now - this.lastPageTime;
    }
    if (this.session) {
      this.session.pageViews += 1;
      this.saveSession();
    }
    this.trackEvent("pageview", "pageview", {
      ...properties,
      previousPageDuration,
      path: pageContext.path,
      title: pageContext.title,
      referrer: pageContext.referrer,
    });
    this.lastPagePath = pageContext.path;
    this.lastPageTime = now;
  }

  track(name: string, properties?: Record<string, unknown>) {
    this.trackEvent(name, "track", properties);
  }

  async flush() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const events = [...this.queue];
    this.queue = [];
    try {
      const res = await fetch(this.config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: this.config.appId, events }),
        keepalive: true,
      });
      if (!res.ok) throw new Error(`Analytics ${res.status}`);
      this.log(`Flushed ${events.length} events`);
    } catch (err) {
      this.log("Failed to send events:", err);
      this.queue.unshift(...events);
    } finally {
      this.isProcessing = false;
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
    this.log("Analytics destroyed");
  }
}

let instance: AnalyticsClient | null = null;

export function initAnalytics(config: AnalyticsConfig): AnalyticsClient {
  if (instance) {
    instance.destroy();
  }
  instance = new AnalyticsClient(config);
  return instance;
}

export function getAnalytics(): AnalyticsClient | null {
  return instance;
}

export function pageView(properties?: Record<string, unknown>) {
  instance?.pageView(properties);
}

export function track(name: string, properties?: Record<string, unknown>) {
  instance?.track(name, properties);
}
