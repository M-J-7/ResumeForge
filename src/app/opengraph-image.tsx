/**
 * The social card (§10.4b).
 *
 * `src/app/` held a `favicon.ico` and nothing else, so every share of every
 * URL — in Slack, on LinkedIn, in a message to a friend who is job hunting —
 * rendered as a bare blue link. For a product whose whole distribution is
 * word of mouth between people applying for jobs, that is the cheapest fix on
 * the list.
 *
 * ## Drawn here rather than shipped as a file
 *
 * `next/og` renders this to a PNG at request time and caches it. A static
 * 1200×630 asset would need re-exporting whenever the product name or the
 * palette changes, which is the kind of chore that silently does not happen —
 * and the name is still open (§12 Q2), read from `lib/product.ts` so that
 * choosing one stays a one-line change.
 *
 * ## Why the colours are literals
 *
 * `next/og` uses Satori, which resolves a small subset of CSS and knows
 * nothing about custom properties or Tailwind. The values below are the
 * palette's own `--accent`, `--on-accent` and the dark surface from
 * `globals.css`; a test pins them so a palette change cannot leave the card
 * quietly off-brand.
 *
 * No custom font is loaded. Fetching one at render time is a network
 * dependency on the path that produces a picture, and the system stack Satori
 * falls back to renders this weight cleanly.
 */

import { ImageResponse } from "next/og";
import { PRODUCT_NAME } from "@/lib/product";

export const alt = "Build an ATS-safe resume in your browser. Free, forever.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The dark surface and the accent, from `globals.css`. Asserted in the test. */
export const OG_BACKGROUND = "#0e1311";
export const OG_ACCENT = "#6fcfa8";
export const OG_TEXT = "#ecefec";
export const OG_MUTED = "#a3afa8";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: OG_BACKGROUND,
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            background: OG_ACCENT,
            display: "flex",
          }}
        />
        <div style={{ color: OG_MUTED, fontSize: 28, letterSpacing: 1 }}>{PRODUCT_NAME}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ color: OG_TEXT, fontSize: 68, lineHeight: 1.1, letterSpacing: -1.5 }}>
          Build a resume that parses cleanly.
        </div>
        {/*
            Three claims, each of which survives being checked — the same rule
            the trust-signals band follows. No number of users, no percentage
            more interviews (D14).
          */}
        <div style={{ color: OG_ACCENT, fontSize: 32 }}>
          Free forever · No account needed · Nothing uploaded unless you ask
        </div>
      </div>
    </div>,
    size,
  );
}
