import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import { AppHeader } from "@/components/shell/AppHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The display face, and the only new family the redesign adds.
 *
 * `axes` is what makes it worth choosing at all. By default `next/font` ships
 * the weight axis alone to keep the file small; `SOFT` and `WONK` are what
 * separate Fraunces from the high-contrast display serif on every other
 * landing page this year, and `globals.css` dials them in `.font-display`.
 * Without them this is an expensive way to get a generic serif.
 *
 * `opsz` lets one file serve 68px and 32px without the large sizes looking
 * loose — `font-optical-sizing: auto` does the rest.
 *
 * Loaded here because the CSP is `font-src 'self' data:`: `next/font`
 * self-hosts at build time, where a `<link>` to Google's CDN would be blocked
 * in production and work perfectly in development.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
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

/** See the `<noscript>` block below. Kept out of the JSX so it stays one line. */
const NO_SCRIPT_REVEAL =
  "[data-build]{opacity:1!important;transform:none!important;clip-path:none!important;filter:none!important}";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/*
         * Resolves the stored theme onto <html> before the browser paints.
         * Doing this in an effect would apply it one frame late, which is the
         * white flash every dark-mode implementation is judged by.
         *
         * `suppressHydrationWarning` on <html> because this script mutates
         * the element React is about to hydrate. The attribute it sets is
         * deliberately not React-owned — see src/lib/theme.ts.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/*
         * The reveal, undone for anyone without JavaScript.
         *
         * Marketing surfaces build themselves: every element that arrives
         * starts clipped, and the clip is an inline style Motion writes
         * during *server* rendering. Nothing would ever remove it with
         * scripting off, so the page would arrive complete in the HTML and
         * invisible on the screen — the worst of both, since the text is
         * right there for a crawler that does not run scripts and gone for
         * the person reading it.
         *
         * One rule, in `<head>` rather than per page, because `/examples`
         * and `/guides` are indexed and `e2e/content.spec.ts` asserts they
         * render with `javaScriptEnabled: false`.
         */}
        <noscript>
          <style>{NO_SCRIPT_REVEAL}</style>
        </noscript>
      </head>
      <body className="flex min-h-full flex-col">
        {/*
         * The header is global; the footer is not. `/builder` is a
         * full-height application view whose preview pane fills whatever is
         * left below this bar, and a footer here would take height from it on
         * every page. Content pages mount `AppFooter` themselves.
         */}
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
