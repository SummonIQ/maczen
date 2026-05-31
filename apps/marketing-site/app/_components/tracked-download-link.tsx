"use client";

import { track } from "@vercel/analytics";
import { getAnalytics } from "@summoniq/signalsplash-client-sdk";
import { trackMetaCustomEvent } from "@/lib/meta-pixel";

export type DownloadButtonSource =
  | "hero"
  | "cta_bottom"
  | "header"
  | "changelog"
  | "roadmap"
  | "download_page"
  | "pricing_free"
  | "footer";

interface TrackedDownloadLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  source: DownloadButtonSource;
  children: React.ReactNode;
}

export function TrackedDownloadLink({
  href,
  source,
  children,
  onClick,
  ...props
}: TrackedDownloadLinkProps) {
  return (
    <a
      href={href}
      download
      onClick={(e) => {
        getAnalytics()?.track("download_button_clicked", { source });
        track("Download", { source });
        trackMetaCustomEvent("DownloadApp", {
          content_name: "MacZen Download",
          content_category: "app_download",
          content_type: "product",
          source,
        });
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
