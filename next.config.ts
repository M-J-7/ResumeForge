import type { NextConfig } from "next";

/**
 * The only cross-origin form target this app has: Google's consent screen.
 *
 * "Continue with Google" is a form that posts to a Server Action, and the
 * action answers with a redirect to the authorization endpoint. With
 * JavaScript the router turns that into a script navigation, which
 * `form-action` does not govern — but without it the browser follows the
 * redirect as part of the submission, and Chrome checks the whole redirect
 * chain against this directive. `form-action 'self'` alone therefore breaks
 * Google sign-in for anyone whose JavaScript has not loaded, while leaving
 * every automated check green.
 *
 * Naming one origin is a much smaller allowance than it looks: it permits
 * form submissions *to* Google's sign-in host and nothing else.
 *
 * `AUTH_GOOGLE_ISSUER` is read at build time, which is fine only because
 * this is the one place it cannot be read later — `headers()` is evaluated
 * once — and because the default covers every real deployment. The override
 * exists for the end-to-end suite's local issuer (see
 * `src/server/auth/config.ts`), which builds with it set.
 */
function googleSignInOrigins(): string[] {
  const origins = ["https://accounts.google.com"];
  const configured = process.env.AUTH_GOOGLE_ISSUER?.trim();
  if (!configured) return origins;
  try {
    const { origin } = new URL(configured);
    return origins.includes(origin) ? origins : [...origins, origin];
  } catch {
    return origins;
  }
}

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
 *
 * ## The one exception, and why it is not a weakening (§10.3)
 *
 * In **development only**, `'unsafe-eval'` is added. React's development
 * build uses string `eval` to attach source-mapped call stacks to component
 * errors; the production build never does, and says so itself in the message
 * it prints when the policy blocks it. Without this every page in `next dev`
 * carries a red error badge for a problem that does not exist in the shipped
 * app — which trains whoever is working on it to ignore the badge, and that
 * is the actual cost.
 *
 * The production policy is unchanged byte for byte, and that is asserted
 * rather than asserted-by-comment: `e2e/builder.spec.ts` checks the served
 * CSP does not match `/(^|\s)'unsafe-eval'/`, and the e2e suite runs against
 * `pnpm build && pnpm start`. If this ever leaked into a production build the
 * suite would fail on it by name.
 */
const DEVELOPMENT_ONLY_SCRIPT_SOURCES =
  process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"];

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  ["script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'", ...DEVELOPMENT_ONLY_SCRIPT_SOURCES].join(
    " ",
  ),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${googleSignInOrigins().join(" ")}`,
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
