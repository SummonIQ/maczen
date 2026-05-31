import Link from "next/link";
import { HeroBackground } from "../_components/hero-background";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden py-24">
        <HeroBackground />
        <div className="container relative z-10 mx-auto max-w-4xl px-4 pb-12 pt-24 sm:px-6 lg:px-8">
          <article className="rounded-3xl border border-black/10 bg-white/95 p-7 shadow-lg sm:p-10">
            <h1 className="mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mb-8 text-sm text-muted-foreground">
              Last updated: March 3, 2026
            </p>

            <div className="space-y-6 text-sm leading-7 text-muted-foreground sm:text-base">
              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  1. What we collect
                </h2>
                <p>
                  We collect the minimum data needed to run MacZen services:
                  account information, billing metadata from Stripe, and support
                  messages you send us.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  2. What stays on your Mac
                </h2>
                <p>
                  Your screenshots, recordings, and local media libraries remain
                  on your device unless you explicitly move or sync them using
                  services you control.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  3. How we use your information
                </h2>
                <p>
                  We use your information to deliver the app, process payments,
                  provide support, and improve product reliability. We do not
                  sell your personal data.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  4. Third-party services
                </h2>
                <p>
                  We use trusted providers including Stripe for payments and
                  Resend for transactional/support email delivery. These
                  providers process data according to their own terms and
                  security controls.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  5. Data retention
                </h2>
                <p>
                  We retain account and billing records as needed for operations
                  and legal obligations, and we remove data when it is no longer
                  required.
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  6. Contact and requests
                </h2>
                <p>
                  You can request account/privacy assistance by emailing{" "}
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
                href="/terms"
                className="text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700"
              >
                View Terms of Service →
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
