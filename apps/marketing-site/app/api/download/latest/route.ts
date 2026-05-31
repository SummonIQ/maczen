import { NextResponse } from "next/server";

export const runtime = "edge";

// Redirect to the static DMG file in public/downloads
// or an external URL if configured
export async function GET(request: Request) {
  const externalDownloadUrl =
    process.env.MACZEN_DOWNLOAD_URL ||
    process.env.NEXT_PUBLIC_MACZEN_DOWNLOAD_URL;

  if (externalDownloadUrl) {
    return NextResponse.redirect(externalDownloadUrl);
  }

  // Redirect to the static file served from public/downloads
  const url = new URL(request.url);
  const downloadUrl = `${url.origin}/downloads/MacZen.dmg`;

  return NextResponse.redirect(downloadUrl);
}
