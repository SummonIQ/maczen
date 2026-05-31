"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Rocket,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import { useSession } from "@/lib/auth/client";
import type {
  RoadmapDefinition,
  RoadmapPhase,
  RoadmapStatus,
} from "@/lib/roadmap";

type RoadmapComment = {
  id: string;
  authorLabel: string;
  body: string;
  isAuthenticated: boolean;
  createdAt: string;
};

type RoadmapEntry = RoadmapDefinition & {
  score: number;
  votes: {
    total: number;
    authenticated: number;
    anonymous: number;
  };
  commentCount: number;
  comments: RoadmapComment[];
  viewerHasVoted: boolean;
};

type RoadmapPhaseBlock = {
  key: RoadmapPhase;
  label: string;
  eyebrow: string;
  items: RoadmapEntry[];
};

type RoadmapResponse = {
  viewer: {
    isAuthenticated: boolean;
    displayName: string | null;
    votedSlugs: string[];
  };
  phases: RoadmapPhaseBlock[];
};

const phaseAccent: Record<
  RoadmapPhase,
  {
    chip: string;
    panel: string;
  }
> = {
  now: {
    chip: "from-rose-500/20 via-orange-400/20 to-amber-300/20 text-rose-700",
    panel: "from-white to-orange-50/80",
  },
  next: {
    chip: "from-sky-500/20 via-cyan-400/20 to-emerald-300/20 text-sky-700",
    panel: "from-white to-cyan-50/80",
  },
  later: {
    chip: "from-violet-500/20 via-fuchsia-400/20 to-pink-300/20 text-violet-700",
    panel: "from-white to-fuchsia-50/80",
  },
};

const statusMeta: Record<
  RoadmapStatus,
  { label: string; icon: typeof Rocket; className: string }
> = {
  building: {
    label: "Building",
    icon: Rocket,
    className: "bg-emerald-50 text-emerald-700",
  },
  "up-next": {
    label: "Up next",
    icon: Clock3,
    className: "bg-amber-50 text-amber-700",
  },
  planned: {
    label: "Planned",
    icon: Sparkles,
    className: "bg-slate-100 text-slate-700",
  },
};

function prettyDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function RoadmapBoard({
  initialPhases,
}: {
  initialPhases: RoadmapPhaseBlock[];
}) {
  const { data: session } = useSession();
  const [phases, setPhases] = useState(initialPhases);
  const [viewer, setViewer] = useState<RoadmapResponse["viewer"]>({
    isAuthenticated: false,
    displayName: null,
    votedSlugs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingVoteSlug, setSubmittingVoteSlug] = useState<string | null>(null);
  const [submittingCommentSlug, setSubmittingCommentSlug] = useState<string | null>(null);
  const [commentBodies, setCommentBodies] = useState<Record<string, string>>({});
  const [commentNames, setCommentNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadRoadmap = async () => {
      try {
        const response = await fetch("/api/roadmap", { cache: "no-store" });
        const payload = (await response.json()) as RoadmapResponse | { error?: string };
        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Failed to load roadmap state.",
          );
        }
        if (cancelled) return;
        setPhases((payload as RoadmapResponse).phases);
        setViewer((payload as RoadmapResponse).viewer);
        setError(null);
      } catch (nextError) {
        if (cancelled) return;
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load roadmap state.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRoadmap();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const items = phases.flatMap((phase) => phase.items);
    return {
      items: items.length,
      votes: items.reduce((sum, item) => sum + item.votes.total, 0),
      comments: items.reduce((sum, item) => sum + item.commentCount, 0),
    };
  }, [phases]);

  const updateEntry = (slug: string, updater: (entry: RoadmapEntry) => RoadmapEntry) => {
    setPhases((current) =>
      current.map((phase) => ({
        ...phase,
        items: phase.items.map((entry) =>
          entry.slug === slug ? updater(entry) : entry,
        ),
      })),
    );
  };

  const submitVote = async (slug: string) => {
    setSubmittingVoteSlug(slug);
    try {
      const response = await fetch(`/api/roadmap/${slug}/vote`, {
        method: "POST",
      });
      const payload = (await response.json()) as
        | { item?: RoadmapEntry; error?: string }
        | undefined;
      if (!response.ok || !payload?.item) {
        throw new Error(payload?.error || "Failed to update vote.");
      }

      updateEntry(slug, () => payload.item as RoadmapEntry);
      setViewer((current) => {
        const voted = current.votedSlugs.includes(slug);
        return {
          ...current,
          isAuthenticated: Boolean(session?.user) || current.isAuthenticated,
          displayName:
            current.displayName ||
            (session?.user && "name" in session.user
              ? ((session.user as { name?: string | null }).name ?? null)
              : null),
          votedSlugs: voted
            ? current.votedSlugs.filter((value) => value !== slug)
            : [...current.votedSlugs, slug],
        };
      });
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to update vote.",
      );
    } finally {
      setSubmittingVoteSlug(null);
    }
  };

  const submitComment = async (slug: string) => {
    const body = (commentBodies[slug] ?? "").trim();
    const displayName = (commentNames[slug] ?? "").trim();
    if (!body) {
      setError("Comment cannot be empty.");
      return;
    }

    setSubmittingCommentSlug(slug);
    try {
      const response = await fetch(`/api/roadmap/${slug}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body,
          displayName,
        }),
      });
      const payload = (await response.json()) as
        | { item?: RoadmapEntry; error?: string }
        | undefined;
      if (!response.ok || !payload?.item) {
        throw new Error(payload?.error || "Failed to publish comment.");
      }

      updateEntry(slug, () => payload.item as RoadmapEntry);
      setCommentBodies((current) => ({ ...current, [slug]: "" }));
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to publish comment.",
      );
    } finally {
      setSubmittingCommentSlug(null);
    }
  };

  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Prioritized bets",
            value: totals.items,
          },
          {
            label: "Weighted votes",
            value: totals.votes,
          },
          {
            label: "Open comments",
            value: totals.comments,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_18px_60px_-34px_rgba(0,0,0,0.35)]"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/45">
              {stat.label}
            </div>
            <div className="mt-3 text-4xl font-semibold tracking-tight">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700 shadow-[0_18px_60px_-34px_rgba(0,0,0,0.18)]">
          {error}
        </div>
      ) : null}

      {phases.map((phase) => (
        <section key={phase.key} className="space-y-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/45">
                {phase.eyebrow}
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {phase.label}
              </h2>
            </div>
            <div
              className={`inline-flex w-fit items-center rounded-full bg-gradient-to-r px-4 py-2 text-sm font-medium ${phaseAccent[phase.key].chip}`}
            >
              {phase.items.length} items in this horizon
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {phase.items.map((item) => {
              const status = statusMeta[item.status];
              const StatusIcon = status.icon;
              const voted = viewer.votedSlugs.includes(item.slug) || item.viewerHasVoted;

              return (
                <article
                  key={item.slug}
                  className={`rounded-[30px] border border-black/10 bg-gradient-to-br ${phaseAccent[phase.key].panel} p-6 shadow-[0_22px_70px_-36px_rgba(0,0,0,0.34)]`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${status.className}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                        <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-foreground/55">
                          Score {item.score}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-semibold tracking-tight">
                          {item.title}
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-foreground/78 sm:text-base">
                          {item.summary}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void submitVote(item.slug)}
                      disabled={submittingVoteSlug === item.slug}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        voted
                          ? "border-fuchsia-300 bg-fuchsia-600 text-white"
                          : "border-black/10 bg-white/80 text-foreground hover:border-fuchsia-300 hover:text-fuchsia-700"
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      {submittingVoteSlug === item.slug ? "Saving..." : voted ? "Voted" : "Vote up"}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                    <div className="rounded-[24px] border border-black/8 bg-white/70 p-5">
                      <div className="text-sm font-semibold text-foreground">
                        Why this matters
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {item.detail}
                      </p>
                      <div className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-4 text-sm leading-6 text-foreground/75">
                        <span className="font-semibold text-foreground">Value:</span>{" "}
                        {item.value}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-black/8 bg-white/70 p-5">
                      <div className="text-sm font-semibold text-foreground">
                        Signals
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-4 py-3">
                          <span>Total weighted votes</span>
                          <span className="font-semibold text-foreground">
                            {item.votes.total}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-4 py-3">
                          <span>Logged-in vote weight</span>
                          <span className="font-semibold text-foreground">
                            {item.votes.authenticated}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-4 py-3">
                          <span>Anonymous vote weight</span>
                          <span className="font-semibold text-foreground">
                            {item.votes.anonymous}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-4 py-3">
                          <span>Comments</span>
                          <span className="font-semibold text-foreground">
                            {item.commentCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-black/8 bg-white/75 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-fuchsia-600" />
                      What we expect to ship
                    </div>
                    <div className="mt-4 grid gap-3">
                      {item.bullets.map((bullet) => (
                        <div
                          key={bullet}
                          className="rounded-2xl bg-black/[0.03] px-4 py-3 text-sm leading-6 text-foreground/80"
                        >
                          {bullet}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-black/8 bg-white/80 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MessageSquare className="h-4 w-4 text-fuchsia-600" />
                      Community feedback
                    </div>
                    <div className="mt-4 space-y-3">
                      {item.comments.length === 0 ? (
                        <div className="rounded-2xl bg-black/[0.03] px-4 py-4 text-sm text-muted-foreground">
                          No comments yet. Add one and shape the order.
                        </div>
                      ) : (
                        item.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="rounded-2xl border border-black/8 bg-black/[0.03] px-4 py-4"
                          >
                            <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-foreground/45">
                              <div className="flex items-center gap-2">
                                <span>{comment.authorLabel}</span>
                                {comment.isAuthenticated ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold tracking-[0.18em] text-emerald-700">
                                    Member
                                  </span>
                                ) : null}
                              </div>
                              <span>{prettyDate(comment.createdAt)}</span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-foreground/82">
                              {comment.body}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-black/10 bg-white/70 p-4">
                      {!viewer.isAuthenticated ? (
                        <input
                          value={commentNames[item.slug] ?? ""}
                          onChange={(event) =>
                            setCommentNames((current) => ({
                              ...current,
                              [item.slug]: event.target.value,
                            }))
                          }
                          placeholder="Name (optional)"
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-fuchsia-300"
                        />
                      ) : null}
                      <textarea
                        value={commentBodies[item.slug] ?? ""}
                        onChange={(event) =>
                          setCommentBodies((current) => ({
                            ...current,
                            [item.slug]: event.target.value,
                          }))
                        }
                        placeholder="What would make this item valuable enough for you to care?"
                        rows={4}
                        className="w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-fuchsia-300"
                      />
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <button
                          type="button"
                          onClick={() => void submitComment(item.slug)}
                          disabled={submittingCommentSlug === item.slug}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 md:ml-auto"
                        >
                          {submittingCommentSlug === item.slug ? "Posting..." : "Post comment"}
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {loading ? (
        <div className="rounded-[28px] border border-black/10 bg-white/80 px-6 py-5 text-sm text-muted-foreground">
          Refreshing roadmap signals...
        </div>
      ) : null}
    </div>
  );
}
