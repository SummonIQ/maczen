import { NextRequest, NextResponse } from "next/server";

type RateLimitConfig = {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

// In-memory store for rate limiting
// In production, consider using Redis or similar for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't block process exit
  cleanupInterval.unref();
}

startCleanup();

/**
 * Get a unique identifier for rate limiting from a request.
 * Uses IP address, falling back to a hash of headers for edge cases.
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  // Fallback: use a combination of headers as identifier
  const userAgent = req.headers.get("user-agent") || "";
  const acceptLang = req.headers.get("accept-language") || "";
  return `fallback:${userAgent.slice(0, 50)}:${acceptLang.slice(0, 20)}`;
}

/**
 * Check if the request should be rate limited.
 * Returns null if the request is allowed, or a Response if it should be blocked.
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  keyPrefix: string = "",
): NextResponse | null {
  const clientId = getClientIdentifier(req);
  const key = `${keyPrefix}:${clientId}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    // Create new entry
    entry = {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    };
    rateLimitStore.set(key, entry);
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    const response = NextResponse.json(
      {
        error: "Too many requests",
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(retryAfter));
    response.headers.set("X-RateLimit-Limit", String(config.limit));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
    return response;
  }

  return null;
}

/**
 * Add rate limit headers to a response (for successful requests).
 */
export function addRateLimitHeaders(
  res: NextResponse,
  req: NextRequest,
  config: RateLimitConfig,
  keyPrefix: string = "",
): NextResponse {
  const clientId = getClientIdentifier(req);
  const key = `${keyPrefix}:${clientId}`;
  const entry = rateLimitStore.get(key);

  if (entry) {
    const remaining = Math.max(0, config.limit - entry.count);
    res.headers.set("X-RateLimit-Limit", String(config.limit));
    res.headers.set("X-RateLimit-Remaining", String(remaining));
    res.headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
  }

  return res;
}

// Common rate limit configurations
export const RATE_LIMITS = {
  /** Checkout: 10 requests per minute */
  checkout: { limit: 10, windowSeconds: 60 },
  /** License validation: 30 requests per minute */
  licenseValidation: { limit: 30, windowSeconds: 60 },
  /** License resend: 5 requests per minute */
  licenseResend: { limit: 5, windowSeconds: 60 },
  /** Billing portal: 10 requests per minute */
  billingPortal: { limit: 10, windowSeconds: 60 },
  /** General API: 60 requests per minute */
  general: { limit: 60, windowSeconds: 60 },
} as const;
