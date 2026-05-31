import Link from "next/link";
import {
  Sparkles,
  Search,
  FolderTree,
  Brain,
  Check,
  ArrowRight,
  Star,
  ChevronDown,
} from "lucide-react";
import { HeroBackground } from "./_components/hero-background";
import { PricingSection } from "./_components/pricing-section";
import { TrackedDownloadLink } from "./_components/tracked-download-link";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background py-24">
        <HeroBackground />
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-40">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-7 inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/60 pl-1.5 pr-3 py-1 text-xs shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 shadow-[0_2px_4px_-1px_rgba(147,51,234,0.4)]">
                <Sparkles className="h-3 w-3 text-white" />
              </span>
              <span className="font-medium text-foreground/80">
                Screenshot Organization for Mac
              </span>
            </div>

            <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Transform Screenshot{" "}
              <span className="inline-flex" aria-label="Chaos">
                <span className="inline-block -rotate-6 -translate-y-0.5 bg-gradient-to-br from-rose-500 via-orange-400 to-lime-500 bg-clip-text text-transparent">C</span>
                <span className="inline-block rotate-3 translate-y-1 bg-gradient-to-tl from-cyan-400 via-fuchsia-500 to-yellow-300 bg-clip-text text-transparent">h</span>
                <span className="inline-block -rotate-2 -translate-y-1 bg-gradient-to-r from-violet-600 via-emerald-400 to-red-500 bg-clip-text text-transparent">a</span>
                <span className="inline-block rotate-4 translate-y-0.5 bg-gradient-to-bl from-pink-500 via-sky-400 to-amber-500 bg-clip-text text-transparent">o</span>
                <span className="inline-block -rotate-5 translate-y-1 bg-gradient-to-tr from-green-500 via-purple-500 to-orange-400 bg-clip-text text-transparent">s</span>
              </span>{" "}
              into Organized{" "}
              <span className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 bg-clip-text text-transparent">
                Bliss
              </span>
            </h1>

            <p className="mb-10 text-xl text-muted-foreground sm:text-2xl">
              MacZen helps you capture, organize, search, and browse screenshots
              and recordings in one clean desktop workflow.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <TrackedDownloadLink
                href="/downloads/MacZen.dmg"
                source="hero"
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border-t border-t-white/70 border-b border-b-black/10 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_12px_28px_-16px_rgba(0,0,0,0.55),0_22px_74px_-34px_rgba(124,58,237,0.65)] transition-all duration-300 hover:-translate-y-[1px] hover:scale-[1.02] hover:shadow-[0_22px_52px_-22px_rgba(0,0,0,0.60),0_34px_110px_-48px_rgba(236,72,153,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 before:pointer-events-none before:absolute before:inset-0 before:content-[''] before:bg-[linear-gradient(135deg,rgba(255,255,255,0.28),rgba(255,255,255,0)_55%)] before:opacity-30 before:transition-opacity before:duration-300 hover:before:opacity-55 after:pointer-events-none after:absolute after:inset-0 after:content-[''] after:bg-[linear-gradient(225deg,rgba(0,0,0,0.18),rgba(0,0,0,0)_60%)] after:opacity-15 after:transition-opacity after:duration-300"
              >
                <span className="relative z-10">Download for Mac</span>
                <ArrowRight className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </TrackedDownloadLink>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              Free forever • No credit card required • macOS 12.0 or later
            </p>
          </div>

          {/* Hero Image/Demo */}
          <div className="mt-20 relative">
            <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl">
              <img
                src="/screenshot.png"
                alt="MacZen app screenshot"
                className="block h-auto w-full"
                loading="lazy"
              />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-bounce pb-8">
          <ChevronDown className="h-8 w-8 text-muted-foreground" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Everything you need to stay organized
            </h2>
            <p className="text-lg text-muted-foreground">
              Powerful features designed to make screenshot management
              effortless
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Indexed Search + OCR",
                description:
                  "Search desktop captures and Apple Photos media by filename, album, source, media type, and extracted text from indexed image assets.",
              },
              {
                icon: Brain,
                title: "Guided Organization",
                description:
                  "Use organize workflows to sort screenshots and recordings into albums with less manual work.",
              },
              {
                icon: FolderTree,
                title: "Smart Organization",
                description:
                  "Automatic folder creation and management keeps everything perfectly organized.",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="group relative rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              How MacZen Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Three simple steps to organized screenshot bliss
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-3 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Take Screenshots",
                description:
                  "Continue taking screenshots as you normally would. MacZen monitors your screenshot folder automatically.",
              },
              {
                step: "02",
                title: "Organize in Seconds",
                description:
                  "Review recent media, create albums, and move items where they belong in a few clicks.",
              },
              {
                step: "03",
                title: "Browse Instantly",
                description:
                  "Use grid, list, and gallery views to quickly revisit your organized captures.",
              },
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="relative z-10 mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-2xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {index < 2 && (
                  <div className="pointer-events-none hidden md:block absolute top-8 left-1/2 -translate-y-1/2 h-px w-[calc(100%+3rem)] bg-gradient-to-r from-purple-500/35 via-fuchsia-500/25 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Loved by professionals worldwide
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            {[
              {
                name: "Sarah Chen",
                role: "Product Designer",
                content:
                  "MacZen has completely transformed how I organize design inspiration. I can find any screenshot in seconds!",
                avatar: "SC",
              },
              {
                name: "Alex Rivera",
                role: "Software Engineer",
                content:
                  "The organization workflow is smooth and fast. I can keep thousands of captures tidy without friction.",
                avatar: "AR",
              },
              {
                name: "Jamie Lee",
                role: "Content Creator",
                content:
                  "I take hundreds of screenshots daily. MacZen saves me hours every week. Absolutely essential tool!",
                avatar: "JL",
              },
            ].map((testimonial, index) => (
              <div key={index} className="glass-card rounded-2xl p-6">
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="mb-6 text-foreground">{testimonial.content}</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-sm font-semibold text-white">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        className="relative overflow-hidden py-24 bg-background"
        id="pricing"
      >
        <HeroBackground />
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Choose the plan that&apos;s right for you
            </p>
          </div>

          <PricingSection />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Frequently asked questions
            </h2>
          </div>

          <div className="mx-auto max-w-3xl space-y-4">
            {[
              {
                question: "Is my data private and secure?",
                answer:
                  "Yes. MacZen runs locally on your Mac and works directly with your files and Photos integration.",
              },
              {
                question: "What macOS versions are supported?",
                answer: "MacZen supports macOS 12.0 (Monterey) and later.",
              },
              {
                question: "Can I try MacZen before purchasing?",
                answer:
                  "Yes. You can use the app for free, then upgrade to Pro when you need advanced organization features.",
              },
              {
                question: "How does organization work?",
                answer:
                  "MacZen gives you fast organization controls across desktop and Apple Photos sources so you can sort media into albums quickly.",
              },
              {
                question: "What can I search today?",
                answer:
                  "Today you can search indexed desktop and Apple Photos media by filename, album, source, media type, and extracted text from indexed screenshots and image assets. Deeper semantic search is still planned next.",
              },
              {
                question: "Can I export my screenshots?",
                answer:
                  "Yes! You can export screenshots individually or in bulk, with all metadata and organization preserved.",
              },
            ].map((faq, index) => (
              <details key={index} className="group glass-card rounded-xl p-6">
                <summary className="flex cursor-pointer items-center justify-between font-semibold">
                  {faq.question}
                  <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-4 text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold mb-6">
              Ready to organize your screenshots?
            </h2>
            <p className="text-xl mb-10 text-white/90">
              Join thousands of Mac users who have transformed their screenshot
              workflow with MacZen.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <TrackedDownloadLink
                href="/downloads/MacZen.dmg"
                source="cta_bottom"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-purple-700 shadow-lg transition-all hover:bg-white/90"
              >
                Download Now - It&apos;s Free
                <ArrowRight className="h-5 w-5" />
              </TrackedDownloadLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
