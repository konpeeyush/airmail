import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";

import { Toaster } from "@/components/ui/toast";
import { APP_NAME, DESCRIPTION, SITE_URL } from "@/lib/brand";

import "./globals.css";

const inter = Inter({
  variable: "--font-primary",
  subsets: ["latin"],
  // variable font: the 460 / 560 weights the design depends on need the full range
  weight: "variable",
  display: "swap",
});

/**
 * Cooper* by Owen Earl / indestructible type* (SIL OFL 1.1, see
 * fonts/cooper/OFL.md). Display face for the page title only.
 */
const cooper = localFont({
  variable: "--font-secondary",
  display: "swap",
  src: [
    { path: "../fonts/cooper/Cooper-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/cooper/Cooper-Medium.woff2", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: DESCRIPTION,
  applicationName: APP_NAME,
  // The OG/Twitter images come from app/opengraph-image.tsx and app/twitter-image.tsx.
  openGraph: { title: APP_NAME, description: DESCRIPTION, siteName: APP_NAME, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", title: APP_NAME, description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${cooper.variable}`}>
      <body>
        <Toaster>
          <main className="mx-auto max-w-column px-4 pt-8 pb-10 max-md:px-6">{children}</main>
        </Toaster>
      </body>
    </html>
  );
}
