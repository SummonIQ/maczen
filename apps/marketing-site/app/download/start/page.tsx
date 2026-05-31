"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Download, Loader2 } from "lucide-react";
import { HeroBackground } from "../../_components/hero-background";

const DOWNLOAD_ENDPOINT = "/downloads/MacZen.dmg";

export default function DownloadStartPage() {
  useEffect(() => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = DOWNLOAD_ENDPOINT;
    document.body.appendChild(iframe);

    return () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <HeroBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-2xl border border-black/10 bg-white/95 p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-white">
            <Download className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Starting Download</h1>
          <p className="mt-3 text-muted-foreground">
            Your MacZen installer should begin downloading automatically.
          </p>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing installer...
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={DOWNLOAD_ENDPOINT}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-6 py-3 font-semibold text-white hover:opacity-95 transition-opacity"
            >
              Download Manually
            </a>
            <Link
              href="/download"
              className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-6 py-3 font-semibold hover:bg-gray-50 transition-colors"
            >
              Back to Download Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
