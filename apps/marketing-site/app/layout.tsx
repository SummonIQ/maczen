import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { Header } from "./_components/header";
import { Footer } from "./_components/footer";
import { AppAnalyticsProvider } from "./_components/providers/analytics-provider";
import "./globals.css";
import "./maczen.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const description =
  "MacZen uses AI to automatically categorize, search, and manage your screenshots. Never lose track of important captures again.";

export const metadata: Metadata = {
  metadataBase: new URL("https://maczen.app"),
  title: {
    default: "MacZen — AI-Powered Screenshot Management",
    template: "%s | MacZen",
  },
  description,
  keywords: [
    "screenshot manager",
    "AI screenshot",
    "screenshot organizer",
    "screen capture management",
    "image search",
    "screenshot search",
    "Mac screenshot tool",
    "screenshot categorization",
    "visual search",
    "productivity tool",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://maczen.app",
    siteName: "MacZen",
    title: "MacZen — AI-Powered Screenshot Management",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "MacZen — AI-Powered Screenshot Management",
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const META_PIXEL_BASE_CODE = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '2333631093846452');
fbq('track', 'PageView');`;

const META_PIXEL_ID = "2333631093846452";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: META_PIXEL_BASE_CODE,
          }}
        />
        {/* End Meta Pixel Code */}
      </head>
      <body
        className={`${inter.variable} maczen-app min-h-screen bg-white antialiased`}
      >
        <noscript>
          <img
            alt=""
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
        <AppAnalyticsProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          <Analytics />
        </AppAnalyticsProvider>
      </body>
    </html>
  );
}
