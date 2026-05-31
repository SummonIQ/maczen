"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { MacZenLogo } from "./maczen-logo";
import { TrackedDownloadLink } from "./tracked-download-link";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-20 after:h-px after:bg-gradient-to-r after:from-pink-400/25 after:via-fuchsia-400/25 after:to-cyan-400/25">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            height: "200%",
            background:
              "linear-gradient(to bottom, rgb(255 255 255 / 0.5) 0%, rgb(255 255 255 / 0) 50%)",
            backdropFilter: "blur(22px) saturate(160%) brightness(1.05)",
            WebkitBackdropFilter: "blur(22px) saturate(160%) brightness(1.05)",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 50%, transparent 50%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 50%, transparent 50%, transparent 100%)",
          }}
        />

        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              type="button"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            <Link href="/" className="flex items-center space-x-2">
              <MacZenLogo />
              <span className="text-xl font-bold">MacZen</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center space-x-2">
            <Link
              href="/#features"
              className={`text-sm font-medium transition-colors hover:text-primary px-3 py-1.5 rounded-md ${
                pathname === "/"
                  ? "text-foreground bg-gradient-to-br from-fuchsia-500/15 to-purple-500/15"
                  : ""
              }`}
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className={`text-sm font-medium transition-colors hover:text-primary px-3 py-1.5 rounded-md ${
                pathname === "/pricing" || pathname === "/subscribe"
                  ? "text-foreground bg-gradient-to-br from-fuchsia-500/15 to-purple-500/15"
                  : ""
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/changelog"
              className={`text-sm font-medium transition-colors hover:text-primary px-3 py-1.5 rounded-md ${
                pathname === "/changelog"
                  ? "text-foreground bg-gradient-to-br from-fuchsia-500/15 to-purple-500/15"
                  : ""
              }`}
            >
              Changelog
            </Link>
            <Link
              href="/roadmap"
              className={`text-sm font-medium transition-colors hover:text-primary px-3 py-1.5 rounded-md ${
                pathname === "/roadmap"
                  ? "text-foreground bg-gradient-to-br from-fuchsia-500/15 to-purple-500/15"
                  : ""
              }`}
            >
              Roadmap
            </Link>
            <TrackedDownloadLink
              href="/download"
              source="header"
              className={`text-sm font-medium transition-colors hover:text-primary px-3 py-1.5 rounded-md ${
                pathname === "/download"
                  ? "text-foreground bg-gradient-to-br from-fuchsia-500/15 to-purple-500/15"
                  : ""
              }`}
            >
              Download
            </TrackedDownloadLink>
          </div>

          <div className="hidden md:flex items-center">
            <TrackedDownloadLink
              href="/download"
              source="header"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full border-2 border-transparent px-3.5 py-1.5 text-sm font-semibold backdrop-blur-lg shadow-sm transition-all duration-300 hover:shadow-lg before:pointer-events-none before:absolute before:inset-0 before:content-[''] before:bg-white/10 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.995), rgba(255,255,255,0.96)) padding-box, linear-gradient(to right, rgba(147,51,234,0.8), rgba(217,70,239,0.8), rgba(236,72,153,0.8)) border-box",
              }}
            >
              <span className="relative z-10 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                Get Started
              </span>
            </TrackedDownloadLink>
          </div>
        </nav>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden relative z-10 mx-auto max-w-6xl px-4 pb-3">
            <div className="space-y-1 rounded-2xl border border-black/10 bg-white/95 p-2 shadow-sm">
              <Link
                href="/#features"
                className={`block px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground rounded-md ${
                  pathname === "/" ? "text-primary bg-accent/50" : ""
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="/pricing"
                className={`block px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground rounded-md ${
                  pathname === "/pricing" || pathname === "/subscribe"
                    ? "text-primary bg-accent/50"
                    : ""
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/changelog"
                className={`block px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground rounded-md ${
                  pathname === "/changelog" ? "text-primary bg-accent/50" : ""
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Changelog
              </Link>
              <Link
                href="/roadmap"
                className={`block px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground rounded-md ${
                  pathname === "/roadmap" ? "text-primary bg-accent/50" : ""
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Roadmap
              </Link>
              <TrackedDownloadLink
                href="/download"
                source="header"
                className={`block px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground rounded-md ${
                  pathname === "/download" ? "text-primary bg-accent/50" : ""
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Download
              </TrackedDownloadLink>
              <TrackedDownloadLink
                href="/download"
                source="header"
                className="group relative mt-2 inline-flex w-full items-center justify-center overflow-hidden rounded-full border-2 border-transparent px-3.5 py-1.5 text-sm font-semibold backdrop-blur-lg shadow-sm transition-all duration-300 hover:shadow-lg before:pointer-events-none before:absolute before:inset-0 before:content-[''] before:bg-white/10 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.995), rgba(255,255,255,0.96)) padding-box, linear-gradient(to right, rgba(147,51,234,0.8), rgba(217,70,239,0.8), rgba(236,72,153,0.8)) border-box",
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="relative z-10 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                  Get Started
                </span>
              </TrackedDownloadLink>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
