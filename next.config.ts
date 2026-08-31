import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * Every directive here is shaped by something this app actually does, and
 * getting one wrong breaks the product's core rather than degrading it:
 *
 * - `worker-src 'self' blob:` — the PDF is generated in a Web Worker and
 *   pdfjs paints it from another. Both are same-origin, but bundlers hand a
 *   worker a `blob:` URL often enough that omitting it is a coin flip.
 * - `img-src ... blob: data:` — preview pages are canvases rasterised to
 *   blobs, and the export links hand over object URLs.
 * - `connect-src 'self'` — no telemetry endpoint exists, and this is what
 *   makes that structural rather than a promise. Adding an analytics script
 *   later would have to change this line, which is the point (§9).
 * - `frame-ancestors 'none'` — nobody frames a resume builder except to
 *   clickjack the download or the delete-account button.
 * - `object-src 'none'` — no plugins, ever. A PDF must be downloaded, not
 *   embedded through a plugin surface.
 *
 * `'unsafe-inline'` on scripts is a real weakening, and it is here because
 * Next inlines its bootstrap and hydration payload; removing it needs a
 * per-request nonce, which needs `proxy.ts`, which this project deliberately
 * keeps out of the request path (see `src/server/auth/session.ts`). The
 * exposure is small — React escapes everything rendered, no user HTML is
 * ever injected into a page, and there are no third-party scripts at all —
 * but it is the one directive worth revisiting first.
 *
 * `'unsafe-eval'` is deliberately **absent**. `'wasm-unsafe-eval'` is present
 * and is not the same thing: react-pdf lays text out with a WebAssembly build
 * of Yoga, and a CSP without it blocks `WebAssembly.instantiate` — which
 * takes the preview, the page-fit indicator, X-Ray, and the PDF download with
 * it. This exact failure was caught by the Playwright suite rather than by
 * reasoning, which is the argument for having it.
 *
 * `'wasm-unsafe-eval'` permits compiling WebAssembly and nothing else; string
 * `eval` of JavaScript stays blocked. It needs Chrome 97+, Firefox 102+, or
 * Safari 16.4+. On anything older the builder still works and the preview
 * does not — recorded in `docs/QA.md` rather than solved by widening the
 * policy to `'unsafe-eval'`, which would give up the protection entirely.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /**
   * Nothing here needs a camera, a microphone, a location, or a payment
   * handler. Denying them outright means a future dependency cannot quietly
   * start asking.
   */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
  },
  /**
   * Two years, subdomains included. Only meaningful over HTTPS; browsers
   * ignore it on plain HTTP, so it is safe to send in development too.
   */
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
] as const;

const nextConfig: NextConfig = {
  /**
   * Emits a self-contained server bundle so the Docker runtime stage needs
   * neither node_modules nor the source tree. Required by the Dockerfile
   * (M0-T13).
   */
  output: "standalone",

  /**
   * `better-sqlite3` is a native addon. Bundling it rewrites the `require`
   * that locates its `.node` binary, and the failure surfaces at runtime as
   * a missing-module error inside the package rather than as anything
   * pointing at the bundler. Leaving it external is the supported fix.
   */
  serverExternalPackages: ["better-sqlite3"],

  /**
   * `sharp` arrives transitively and nothing here uses it — `pnpm-workspace.yaml`
   * already refuses to build it. Without this it is still *traced* into the
   * standalone output, carrying a platform-specific native binary into the
   * image for a feature that does not exist.
   */
  outputFileTracingExcludes: {
    "**/*": ["node_modules/**/@img/**", "node_modules/**/sharp/**"],
  },

  /** Nothing about this app should be advertising which framework serves it. */
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
      {
        // An account's data export is personal data. It must not sit in a
        // shared cache, and it must not be reachable by a cross-site request.
        source: "/api/account/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
