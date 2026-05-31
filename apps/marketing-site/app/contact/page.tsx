import Link from "next/link";
import { HeroBackground } from "../_components/hero-background";
import { ContactForm } from "./contact-form";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden py-24">
        <HeroBackground />
        <div className="container relative z-10 mx-auto px-4 pb-12 pt-24 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Contact <span className="text-fuchsia-600">MacZen</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Questions, feedback, or partnership ideas. Send us a note and
              we&apos;ll get back to you.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-5">
            <div className="md:col-span-3">
              <ContactForm />
            </div>
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Direct contact</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  You can also email us directly at{" "}
                  <a
                    className="text-fuchsia-600 hover:text-fuchsia-700"
                    href="mailto:maczen@summoniq.com"
                  >
                    maczen@summoniq.com
                  </a>
                  .
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  MacZen is built by SummonIQ, a software studio focused on
                  practical tools people rely on.
                </p>
                <Link
                  href="/company"
                  className="mt-4 inline-flex text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700"
                >
                  Learn about SummonIQ →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
