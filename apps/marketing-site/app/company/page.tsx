import { Building2, ExternalLink, Sparkles } from "lucide-react";
import { HeroBackground } from "../_components/hero-background";

export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden py-24">
        <HeroBackground />
        <div className="container relative z-10 mx-auto px-4 pb-12 pt-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-white/95 p-8 shadow-xl sm:p-10">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-white">
              <Building2 className="h-6 w-6" />
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
              About <span className="text-fuchsia-600">SummonIQ</span>
            </h1>

            <p className="mb-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              MacZen is built by SummonIQ. We build high-quality software that
              solves real workflow gaps we experience ourselves. We focus on
              practical tools that feel polished, stay fast, and keep earning
              their place in your daily setup.
            </p>
            <p className="mb-8 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Our approach is straightforward: identify repetitive pain points,
              design for clarity, and ship products that reduce friction from
              day one.
            </p>

            <a
              href="https://summoniq.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-black/5"
            >
              Visit SummonIQ
              <ExternalLink className="h-4 w-4" />
            </a>

            <div className="mt-8 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-fuchsia-500" />
                <p className="text-sm text-muted-foreground">
                  We ship software we personally depend on. If a feature does
                  not improve the product in real usage, we do not keep it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
