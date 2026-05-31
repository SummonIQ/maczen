import { NextRequest, NextResponse } from "next/server";

/**
 * AppLab-style analytics ingestion.
 * Accepts POST { appId, events } and forwards to ANALYTICS_ENDPOINT when set.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, events } = body as { appId?: string; events?: unknown[] };

    if (!appId || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing appId or events" },
        { status: 400 }
      );
    }

    const endpoint = process.env.ANALYTICS_ENDPOINT?.trim();
    if (endpoint) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, events }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[analytics] Forward error:", res.status, text);
        return NextResponse.json(
          { success: false, error: "Analytics forward failed" },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ success: true, count: events.length });
  } catch (e) {
    console.error("[analytics] Error:", e);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
