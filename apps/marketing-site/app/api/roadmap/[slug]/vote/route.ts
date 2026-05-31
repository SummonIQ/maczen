import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROADMAP_BY_SLUG } from "@/lib/roadmap";
import {
  getRoadmapActor,
  getRoadmapAnonCookieName,
  listRoadmapState,
} from "@/lib/roadmap-feedback";
import { addRateLimitHeaders, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

type Params = Promise<{ slug: string }>;

export async function POST(req: NextRequest, context: { params: Params }) {
  const rateLimited = checkRateLimit(req, RATE_LIMITS.general, "roadmap:vote");
  if (rateLimited) return rateLimited;

  const { slug } = await context.params;
  if (!ROADMAP_BY_SLUG.has(slug)) {
    return NextResponse.json({ error: "Unknown roadmap item." }, { status: 404 });
  }

  try {
    const actor = await getRoadmapActor(req);
    const existing = await prisma.roadmapVote.findUnique({
      where: {
        itemSlug_actorKey: {
          itemSlug: slug,
          actorKey: actor.actorKey,
        },
      },
    });

    let viewerHasVoted = false;
    if (existing) {
      await prisma.roadmapVote.delete({
        where: { id: existing.id },
      });
    } else {
      await prisma.roadmapVote.create({
        data: {
          itemSlug: slug,
          actorKey: actor.actorKey,
          userId: actor.userId,
          isAuthenticated: actor.isAuthenticated,
          weight: actor.weight,
        },
      });
      viewerHasVoted = true;
    }

    const state = await listRoadmapState(actor.actorKey);
    const item = state.phases
      .flatMap((phase) => phase.items)
      .find((entry) => entry.slug === slug);

    const response = NextResponse.json({
      viewerHasVoted,
      item,
    });
    response.cookies.set(getRoadmapAnonCookieName(), actor.anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return addRateLimitHeaders(response, req, RATE_LIMITS.general, "roadmap:vote");
  } catch (error) {
    console.error("Roadmap vote failed:", error);
    return NextResponse.json(
      { error: "Failed to update roadmap vote." },
      { status: 500 },
    );
  }
}
