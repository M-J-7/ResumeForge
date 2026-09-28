import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
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
 * The display face.
 *
 * Fraunces was here: a three-axis variable serif dialled soft and wonky. It
 * was a good choice for a page whose job was to read warm, and the redesign
 * changed that job. On a near-black stage the display type is the loudest
 * thing on the screen after the paper, and warmth is not what a 84px headline
 * over a machine readout should be doing — contrast is.
 *
 * Instrument Serif is high-contrast, tight, and nearly absent from this
 * category, which is a row of geometric sans and violet gradients. It ships a
 * single 400 and an italic, which is a real constraint and the reason
 * `globals.css` restricts it to Display 1 and 2 and sets
 * `font-synthesis-weight: none` — one weight cannot be asked to hold a 24px
 * section head, and a browser asked anyway will smear it.
 *
 * The payload goes **down**: one static face replaces three variable axes.
 *
 * Loaded here because the CSP is `font-src 'self' data:`: `next/font`
 * self-hosts at build time, where a `<link>` to Google's CDN would be blocked
 * in production and work perfectly in development.
 */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
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
  /**
   * `summary_large_image`, because there is a large image to show.
   *
   * `src/app/opengraph-image.tsx` draws a 1200x630 card and file-based
   * metadata outranks anything this object says, so the image was already on
   * every route — and `card: "summary"` was asking every scraper that honours
   * it to crop the card down to a small square thumbnail beside the text. The
   * asset was being drawn and then thrown away.
   */
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
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
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
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
         * No header here, and that is what makes the content pages static.
         *
         * This used to render `AppHeader`, which reads the session — and a
         * session read in the root layout makes every route in the app
         * per-request, the landing page included. The header now comes from
         * one layer down: `(site)/layout.tsx` for the prerendered content
         * pages (`SiteHeader`, which asks from the browser), and a
         * `layout.tsx` in each application route (`AppHeader`, which reads it
         * on the server). `not-found.tsx` and `error.tsx` render above both
         * and mount `SiteHeader` themselves.
         *
         * The footer is per page for a different reason: `/builder` is a
         * full-height application view whose preview pane fills whatever is
         * left below the bar, and a footer would take height from it.
         */}
        {children}
      </body>
    </html>
  );
}
