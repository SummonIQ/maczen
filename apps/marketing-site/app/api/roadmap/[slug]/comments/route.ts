import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROADMAP_BY_SLUG } from "@/lib/roadmap";
import {
  buildRoadmapCommentPayload,
  getRoadmapActor,
  getRoadmapAnonCookieName,
  getRoadmapCommentBody,
  listRoadmapState,
} from "@/lib/roadmap-feedback";
import { addRateLimitHeaders, checkRateLimit } from "@/lib/rate-limit";

type Params = Promise<{ slug: string }>;

const ROADMAP_COMMENT_RATE_LIMIT = { limit: 8, windowSeconds: 600 };

export async function POST(req: NextRequest, context: { params: Params }) {
  const rateLimited = checkRateLimit(
    req,
    ROADMAP_COMMENT_RATE_LIMIT,
    "roadmap:comment",
  );
  if (rateLimited) return rateLimited;

  const { slug } = await context.params;
  if (!ROADMAP_BY_SLUG.has(slug)) {
    return NextResponse.json({ error: "Unknown roadmap item." }, { status: 404 });
  }

  try {
    const actor = await getRoadmapActor(req);
    const body = (await req.json()) as {
      body?: string;
      displayName?: string;
    };
    const sanitizedBody = getRoadmapCommentBody(body.body);

    if (!sanitizedBody) {
      return NextResponse.json(
        { error: "Comment cannot be empty." },
        { status: 400 },
      );
    }

    const comment = buildRoadmapCommentPayload({
      body: sanitizedBody,
      displayName: body.displayName,
      actor,
    });

    await prisma.roadmapComment.create({
      data: {
        itemSlug: slug,
        actorKey: comment.actorKey,
        userId: comment.userId,
        authorLabel: comment.authorLabel,
        body: comment.body,
        isAuthenticated: comment.isAuthenticated,
        weight: comment.weight,
      },
    });

    const state = await listRoadmapState(actor.actorKey);
    const item = state.phases
      .flatMap((phase) => phase.items)
      .find((entry) => entry.slug === slug);

    const response = NextResponse.json({ item });
    response.cookies.set(getRoadmapAnonCookieName(), actor.anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return addRateLimitHeaders(
      response,
      req,
      ROADMAP_COMMENT_RATE_LIMIT,
      "roadmap:comment",
    );
  } catch (error) {
    console.error("Roadmap comment failed:", error);
    return NextResponse.json(
      { error: "Failed to publish roadmap comment." },
      { status: 500 },
    );
  }
}
