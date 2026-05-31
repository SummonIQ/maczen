import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_DESKTOP_APP_URL,
    "http://localhost:30051",
    "http://localhost:30232",
    "http://localhost:30141",
    "http://localhost:30143",
    "http://localhost:5173",
  ].filter((value): value is string => Boolean(value)),
);

export function applyCors(req: NextRequest, res: Response) {
  const origin = req.headers.get("origin");
  if (origin && DEFAULT_ALLOWED_ORIGINS.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  return res;
}

export function buildOptionsResponse(req: NextRequest) {
  return applyCors(req, new NextResponse(null, { status: 204 }));
}
