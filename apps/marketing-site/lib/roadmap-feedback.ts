import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { ROADMAP_BY_SLUG, ROADMAP_ITEMS, ROADMAP_PHASES } from "@/lib/roadmap";

const ROADMAP_ANON_COOKIE = "maczen-roadmap-anon";
const LOGGED_IN_VOTE_WEIGHT = 3;
const LOGGED_IN_COMMENT_WEIGHT = 2;
const ANON_WEIGHT = 1;

export type RoadmapViewer = {
  isAuthenticated: boolean;
  displayName: string | null;
  votedSlugs: string[];
};

type RoadmapActor = {
  actorKey: string;
  userId: string | null;
  isAuthenticated: boolean;
  weight: number;
  displayName: string | null;
  anonId: string;
};

const sanitizeDisplayName = (value: string | null | undefined) => {
  const trimmed = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return trimmed || "Guest";
};

const sanitizeCommentBody = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 1000);

export const getRoadmapCommentBody = (value: string | null | undefined) =>
  sanitizeCommentBody(value);

export const getRoadmapAnonCookieName = () => ROADMAP_ANON_COOKIE;

export async function getRoadmapActor(req: NextRequest): Promise<RoadmapActor> {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  const cookieStore = await cookies();
  const existingAnonId = cookieStore.get(ROADMAP_ANON_COOKIE)?.value?.trim();
  const anonId = existingAnonId || crypto.randomUUID();

  if (session?.user) {
    const sessionUser = session.user as {
      id: string;
      name?: string | null;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    };
    const displayName = sanitizeDisplayName(
      sessionUser.firstName ||
        sessionUser.name ||
        sessionUser.email?.split("@")[0] ||
        "MacZen member",
    );
    return {
      actorKey: `user:${sessionUser.id}`,
      userId: sessionUser.id,
      isAuthenticated: true,
      weight: LOGGED_IN_VOTE_WEIGHT,
      displayName,
      anonId,
    };
  }

  return {
    actorKey: `anon:${anonId}`,
    userId: null,
    isAuthenticated: false,
    weight: ANON_WEIGHT,
    displayName: null,
    anonId,
  };
}

export async function listRoadmapState(viewerActorKey?: string | null) {
  const [votes, comments] = await Promise.all([
    prisma.roadmapVote.findMany({
      select: {
        itemSlug: true,
        actorKey: true,
        weight: true,
        isAuthenticated: true,
      },
    }),
    prisma.roadmapComment.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        itemSlug: true,
        authorLabel: true,
        body: true,
        isAuthenticated: true,
        weight: true,
        createdAt: true,
      },
    }),
  ]);

  const votesBySlug = new Map<
    string,
    { total: number; authenticated: number; anonymous: number }
  >();
  const commentsBySlug = new Map<
    string,
    Array<{
      id: string;
      authorLabel: string;
      body: string;
      isAuthenticated: boolean;
      createdAt: string;
    }>
  >();

  for (const vote of votes) {
    if (!ROADMAP_BY_SLUG.has(vote.itemSlug)) continue;
    const existing = votesBySlug.get(vote.itemSlug) ?? {
      total: 0,
      authenticated: 0,
      anonymous: 0,
    };
    existing.total += vote.weight;
    if (vote.isAuthenticated) {
      existing.authenticated += vote.weight;
    } else {
      existing.anonymous += vote.weight;
    }
    votesBySlug.set(vote.itemSlug, existing);
  }

  for (const comment of comments) {
    if (!ROADMAP_BY_SLUG.has(comment.itemSlug)) continue;
    const existing = commentsBySlug.get(comment.itemSlug) ?? [];
    if (existing.length < 12) {
      existing.push({
        id: comment.id,
        authorLabel: comment.authorLabel,
        body: comment.body,
        isAuthenticated: comment.isAuthenticated,
        createdAt: comment.createdAt.toISOString(),
      });
      commentsBySlug.set(comment.itemSlug, existing);
    }
  }

  const viewerVotes = viewerActorKey
    ? votes
        .filter((vote) => vote.actorKey === viewerActorKey)
        .map((vote) => vote.itemSlug)
    : [];

  const entries = ROADMAP_PHASES.map((phase) => {
    const items = ROADMAP_ITEMS.filter((item) => item.phase === phase.key)
      .map((item) => {
        const voteStats = votesBySlug.get(item.slug) ?? {
          total: 0,
          authenticated: 0,
          anonymous: 0,
        };
        const commentList = commentsBySlug.get(item.slug) ?? [];
        const authenticatedCommentCount = commentList.filter(
          (comment) => comment.isAuthenticated,
        ).length;
        const anonymousCommentCount = commentList.length - authenticatedCommentCount;

        return {
          ...item,
          score:
            voteStats.total +
            authenticatedCommentCount * LOGGED_IN_COMMENT_WEIGHT +
            anonymousCommentCount * ANON_WEIGHT,
          votes: voteStats,
          commentCount: commentList.length,
          comments: commentList,
          viewerHasVoted: viewerVotes.includes(item.slug),
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.order - b.order;
      });

    return {
      ...phase,
      items,
    };
  });

  return {
    viewer: {
      votedSlugs: viewerVotes,
    },
    phases: entries,
  };
}

export function buildRoadmapCommentPayload({
  body,
  displayName,
  actor,
}: {
  body: string;
  displayName: string | null | undefined;
  actor: RoadmapActor;
}) {
  return {
    authorLabel: actor.isAuthenticated
      ? sanitizeDisplayName(actor.displayName)
      : sanitizeDisplayName(displayName),
    body: sanitizeCommentBody(body),
    isAuthenticated: actor.isAuthenticated,
    weight: actor.isAuthenticated ? LOGGED_IN_COMMENT_WEIGHT : ANON_WEIGHT,
    actorKey: actor.actorKey,
    userId: actor.userId,
  };
}
