import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, LaptopMinimal } from "lucide-react";
import { HeroBackground } from "../_components/hero-background";
import { TrackedDownloadLink } from "../_components/tracked-download-link";

export const metadata: Metadata = {
  title: "MacZen Changelog",
  description:
    "Desktop app release notes and launch updates for MacZen on macOS.",
};

const releases = [
  {
    date: "March 4, 2026",
    version: "Version 1.0.0",
    title: "Launch polish for the desktop release",
    summary:
      "The launch build focused on the last mile: cleaner menu bar behavior, more reliable packaging, and a sharper first-run desktop experience.",
    items: [
      "Refined the macOS menu bar icon handling so the tray icon loads more reliably during local development and packaged builds.",
      "Refreshed the installer pipeline and desktop download packaging so the public DMG reflects the current MacZen build.",
      "Shipped additional desktop UI and API cleanup ahead of launch to keep the release path stable.",
    ],
  },
  {
    date: "March 3, 2026",
    version: "Release candidate",
    title: "Performance and organization improvements",
    summary:
      "This release candidate tightened the desktop workflow for day-to-day use before the public launch.",
    items: [
      "Improved desktop rendering performance to keep browsing large screenshot libraries feeling faster and more responsive.",
      "Refined organize flow updates so album moves and review steps feel more predictable during cleanup sessions.",
      "Improved Apple Photos tagging behavior to make imported desktop captures easier to keep aligned with their album structure.",
    ],
  },
  {
    date: "March 3, 2026",
    version: "Pre-launch build",
    title: "Desktop installer and download rollout",
    summary:
      "The pre-launch push established the initial public desktop delivery path.",
    items: [
      "Published the MacZen desktop build for macOS with a downloadable installer flow.",
      "Connected the release artifact to the marketing-site download experience so visitors can grab the latest desktop build directly.",
      "Polished supporting desktop UI details to make the launch build feel more cohesive out of the box.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden py-24">
        <HeroBackground />
        <div className="relative z-10 container mx-auto px-4 pt-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-2 text-sm shadow-[0_8px_30px_-18px_rgba(0,0,0,0.28)] backdrop-blur-md">
              <LaptopMinimal className="h-4 w-4 text-fuchsia-600" />
              <span className="font-medium text-foreground/80">
                Desktop app release notes
              </span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              MacZen{" "}
              <span className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                Changelog
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              A public record of desktop-only launch updates through the March 4,
              2026 release.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <TrackedDownloadLink
                href="/downloads/MacZen.dmg"
                source="changelog"
                className="group inline-flex items-center justify-center gap-2 rounded-full border-t border-t-white/70 border-b border-b-black/10 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_12px_28px_-16px_rgba(0,0,0,0.55),0_22px_74px_-34px_rgba(124,58,237,0.65)] transition-all duration-300 hover:-translate-y-[1px] hover:scale-[1.02]"
              >
                Download MacZen
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </TrackedDownloadLink>
              <Link
                href="/download"
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/85 px-7 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-white"
              >
                Installation Guide
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-8">
            {releases.map((release) => (
              <article
                key={`${release.date}-${release.title}`}
                className="rounded-[28px] border border-black/10 bg-white/90 p-8 shadow-[0_20px_70px_-40px_rgba(0,0,0,0.35)] backdrop-blur-sm"
              >
                <div className="flex flex-col gap-4 border-b border-black/8 pb-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-700">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {release.version}
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                      {release.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-base text-muted-foreground">
                      {release.summary}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {release.date}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {release.items.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl bg-gradient-to-r from-black/[0.025] to-transparent px-4 py-4"
                    >
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-fuchsia-600" />
                      <p className="text-sm leading-6 text-foreground/85 sm:text-base">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
