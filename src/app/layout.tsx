import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /**
   * `metadataBase` is what turns every relative canonical and Open Graph URL
   * in the app into an absolute one. Without it Next warns and emits relative
   * URLs, which social cards and search engines both ignore.
   */
  metadataBase: new URL(siteOrigin()),
  title: {
    default: SITE_NAME,
    // Page titles read "Sign in — ATS Resume Builder" rather than repeating
    // the product name by hand on every page.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary", title: SITE_NAME, description: SITE_DESCRIPTION },
  /**
   * No `format-detection` for telephone numbers: iOS Safari otherwise turns
   * anything that looks like a phone number into a link, and a resume preview
   * is full of dates that qualify.
   */
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
