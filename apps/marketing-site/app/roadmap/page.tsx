import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, MessageCircleMore, Vote } from "lucide-react";
import { HeroBackground } from "../_components/hero-background";
import { TrackedDownloadLink } from "../_components/tracked-download-link";
import { RoadmapBoard } from "./roadmap-board";
import { ROADMAP_ITEMS, ROADMAP_PHASES } from "@/lib/roadmap";

export const metadata: Metadata = {
  title: "MacZen Roadmap",
  description:
    "Public product roadmap for the MacZen desktop app, including live votes and comments from the community.",
};

const initialPhases = ROADMAP_PHASES.map((phase) => ({
  ...phase,
  items: ROADMAP_ITEMS.filter((item) => item.phase === phase.key).map((item) => ({
    ...item,
    score: 0,
    votes: { total: 0, authenticated: 0, anonymous: 0 },
    commentCount: 0,
    comments: [],
    viewerHasVoted: false,
  })),
}));

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden py-24">
        <HeroBackground />
        <div className="relative z-10 container mx-auto px-4 pt-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-2 text-sm shadow-[0_8px_30px_-18px_rgba(0,0,0,0.28)] backdrop-blur-md">
              <Compass className="h-4 w-4 text-fuchsia-600" />
              <span className="font-medium text-foreground/80">
                Public desktop roadmap
              </span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              MacZen{" "}
              <span className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                Roadmap
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground sm:text-xl">
              The desktop-app roadmap, ordered around the highest-leverage work.
              Vote, comment, and help shape what gets built next.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Vote,
                  title: "Anyone can vote",
                  copy:
                    "Anonymous visitors can vote and comment immediately with no login wall.",
                },
                {
                  icon: MessageCircleMore,
                  title: "Logged-in users count more",
                  copy:
                    "Signed-in feedback carries more weight in the prioritization score than anonymous feedback.",
                },
                {
                  icon: ArrowRight,
                  title: "Desktop-app only",
                  copy:
                    "This page tracks the MacZen desktop product direction, not the marketing site or backend work.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-[28px] border border-black/10 bg-white/85 p-6 text-left shadow-[0_20px_70px_-40px_rgba(0,0,0,0.32)]"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-white">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight">
                    {card.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {card.copy}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <TrackedDownloadLink
                href="/downloads/MacZen.dmg"
                source="roadmap"
                className="group inline-flex items-center justify-center gap-2 rounded-full border-t border-t-white/70 border-b border-b-black/10 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_12px_28px_-16px_rgba(0,0,0,0.55),0_22px_74px_-34px_rgba(124,58,237,0.65)] transition-all duration-300 hover:-translate-y-[1px] hover:scale-[1.02]"
              >
                Download MacZen
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </TrackedDownloadLink>
              <Link
                href="/changelog"
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/85 px-7 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-white"
              >
                View changelog
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <RoadmapBoard initialPhases={initialPhases} />
          </div>
        </div>
      </section>
    </div>
  );
}
