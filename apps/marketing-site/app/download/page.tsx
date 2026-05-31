import {
  Download,
  Check,
} from "lucide-react";
import { HeroBackground } from "../_components/hero-background";
import { MacZenLogo } from "../_components/maczen-logo";
import { TrackedDownloadLink } from "../_components/tracked-download-link";

export default function DownloadPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-background py-24">
        <HeroBackground />
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex h-20 w-20 items-center justify-center">
              <MacZenLogo size="lg" className="h-20 w-20 rounded-2xl" />
            </div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl mb-6">
              <span className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                Download
              </span>{" "}
              MacZen
            </h1>
            <p className="text-xl text-muted-foreground mb-10">
              Start organizing your screenshots effortlessly. Free forever for
              up to 1,000 screenshots. Upgrade to Pro for AI-powered
              organization.
            </p>

            {/* Download Button */}
            <div className="flex flex-col items-center gap-6">
              <TrackedDownloadLink
                href="/downloads/MacZen.dmg"
                source="download_page"
                className="group inline-flex items-center justify-center gap-3 rounded-full border-t border-t-white/70 border-b border-b-black/10 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-10 py-5 text-lg font-semibold text-white shadow-2xl shadow-purple-500/25 transition-all hover:shadow-pink-500/30 hover:scale-[1.02]"
              >
                <Download className="h-6 w-6 transition-transform group-hover:translate-y-0.5" />
                Download for macOS
              </TrackedDownloadLink>
              <p className="text-sm text-muted-foreground">
                Version 1.0.0 • macOS 12.0 or later • Apple Silicon & Intel
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* System Requirements */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight mb-8 text-center">
              System Requirements
            </h2>
            <div className="glass-card rounded-2xl p-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    Minimum Requirements
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• macOS 12.0 (Monterey) or later</li>
                    <li>• 4GB RAM</li>
                    <li>• 200MB free disk space</li>
                    <li>• Internet connection for initial setup</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Check className="h-5 w-5 text-fuchsia-600" />
                    Recommended
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• macOS 14.0 (Sonoma) or later</li>
                    <li>• 8GB RAM or more</li>
                    <li>• 1GB free disk space</li>
                    <li>• Apple Silicon for best performance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Installation Steps */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight mb-12 text-center">
              How to Install
            </h2>
            <div className="space-y-8">
              {[
                {
                  step: "1",
                  title: "Download MacZen",
                  description:
                    "Click the download button above to get the latest version of MacZen for macOS.",
                },
                {
                  step: "2",
                  title: "Open the DMG file",
                  description:
                    "Once downloaded, open the MacZen.dmg file from your Downloads folder.",
                },
                {
                  step: "3",
                  title: "Drag to Applications",
                  description:
                    "Drag the MacZen icon to your Applications folder to install.",
                },
                {
                  step: "4",
                  title: "Launch & Enjoy",
                  description:
                    "Open MacZen from your Applications folder and grant necessary permissions when prompted.",
                },
              ].map((item, index) => (
                <div key={index} className="flex gap-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-xl font-bold text-white">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight mb-12 text-center">
              Download Questions
            </h2>
            <div className="space-y-4">
              {[
                {
                  question: "Is MacZen safe to download?",
                  answer:
                    "Yes! MacZen is notarized by Apple, ensuring it's free from malware and hasn't been tampered with. You can download it with confidence.",
                },
                {
                  question: "Do I need to create an account?",
                  answer:
                    "No account is needed to use the core features of MacZen. You can start organizing screenshots immediately after installation.",
                },
                {
                  question: "Will MacZen work on my Mac?",
                  answer:
                    "MacZen works on any Mac running macOS 12.0 (Monterey) or later, including both Apple Silicon and Intel processors.",
                },
                {
                  question: "How do I update MacZen?",
                  answer:
                    "MacZen automatically checks for updates and will notify you when a new version is available. Updates are installed with a single click.",
                },
                {
                  question: "Can I use MacZen on multiple Macs?",
                  answer:
                    "Yes! You can install MacZen on all your Macs. Your settings and organization can be synced with the Pro plan.",
                },
              ].map((faq, index) => (
                <div key={index} className="glass-card rounded-xl p-6">
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-muted-foreground text-sm">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold mb-6">
              Ready to transform your workflow?
            </h2>
            <p className="text-xl mb-8 text-white/90">
              Join thousands of Mac users who have already made the switch to
              MacZen.
            </p>
            <TrackedDownloadLink
              href="/downloads/MacZen.dmg"
              source="download_page"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-white px-10 py-5 text-lg font-semibold text-purple-700 shadow-lg transition-all hover:bg-white/90 hover:scale-[1.02]"
            >
              <Download className="h-6 w-6" />
              Download Now
            </TrackedDownloadLink>
            <p className="mt-6 text-sm text-white/70">
              Free forever • No credit card required • 30-day money-back
              guarantee
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
