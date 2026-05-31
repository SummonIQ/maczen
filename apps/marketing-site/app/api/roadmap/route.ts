import { NextRequest, NextResponse } from "next/server";
import { addRateLimitHeaders, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  getRoadmapActor,
  getRoadmapAnonCookieName,
  listRoadmapState,
} from "@/lib/roadmap-feedback";

export async function GET(req: NextRequest) {
  const rateLimited = checkRateLimit(req, RATE_LIMITS.general, "roadmap:get");
  if (rateLimited) return rateLimited;

  try {
    const actor = await getRoadmapActor(req);
    const data = await listRoadmapState(actor.actorKey);
    const response = NextResponse.json({
      viewer: {
        isAuthenticated: actor.isAuthenticated,
        displayName: actor.displayName,
        votedSlugs: data.viewer.votedSlugs,
      },
      phases: data.phases,
    });

    response.cookies.set(getRoadmapAnonCookieName(), actor.anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return addRateLimitHeaders(response, req, RATE_LIMITS.general, "roadmap:get");
  } catch (error) {
    console.error("Roadmap GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load roadmap feedback." },
      { status: 500 },
    );
  }
}
