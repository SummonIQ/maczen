import Link from "next/link";
import { HeroBackground } from "../_components/hero-background";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden py-24">
        <HeroBackground />
        <div className="container relative z-10 mx-auto max-w-4xl px-4 pb-12 pt-24 sm:px-6 lg:px-8">
          <article className="rounded-3xl border border-black/10 bg-white/95 p-7 shadow-lg sm:p-10">
            <h1 className="mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mb-8 text-sm text-muted-foreground">
              Last updated: March 3, 2026
            </p>

            <div className="space-y-6 text-sm leading-7 text-muted-foreground sm:text-base">
              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  1. Using MacZen
                </h2>
                <p>
                  By using MacZen, you agree to use it lawfully and
                  responsibly. You are responsible for the content you capture,
                  store, and organize with the app.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  2. Accounts, Billing, and Plans
                </h2>
                <p>
                  Paid plans are billed through Stripe. Prices and plan details
                  are shown on the pricing page at purchase time. You can manage
                  or cancel recurring subscriptions through your billing portal
                  or by contacting us.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  3. Acceptable Use
                </h2>
                <p>
                  You may not use MacZen to violate privacy rights, intellectual
                  property rights, or applicable law. We may suspend access for
                  abusive, fraudulent, or illegal usage.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  4. Software Availability
                </h2>
                <p>
                  We work to keep MacZen reliable, but we do not guarantee
                  uninterrupted availability. Features may change as we improve
                  the product.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  5. Warranty and Liability
                </h2>
                <p>
                  MacZen is provided on an &quot;as is&quot; basis. To the extent
                  allowed by law, SummonIQ is not liable for indirect or
                  consequential damages resulting from use of the software.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  6. Contact
                </h2>
                <p>
                  Questions about these terms can be sent to{" "}
                  <a
                    href="mailto:maczen@summoniq.com"
                    className="text-fuchsia-600 hover:text-fuchsia-700"
                  >
                    maczen@summoniq.com
                  </a>
                  .
                </p>
              </section>
            </div>

            <div className="mt-10">
              <Link
                href="/privacy"
                className="text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700"
              >
                View Privacy Policy →
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
