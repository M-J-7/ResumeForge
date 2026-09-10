/**
 * The dev-only `'unsafe-eval'` exception (§10.3).
 *
 * ## Why this needs its own test
 *
 * `e2e/builder.spec.ts` already asserts the served policy does **not** carry
 * `'unsafe-eval'`, and the e2e suite runs against `pnpm build && pnpm start`.
 * That is the guard that matters and it is genuinely load-bearing — but it
 * only ever sees the production branch, so it would stay green if the
 * exception were widened to every environment by deleting the condition.
 *
 * This runs in Node with `NODE_ENV` under the test's control, so it can see
 * both branches, and it is the only place that can assert the production
 * policy is unchanged *byte for byte* rather than merely lacking one token.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The CSP the config produces under a given `NODE_ENV`.
 *
 * Re-imported per call because `CONTENT_SECURITY_POLICY` is built once at
 * module scope, which is exactly the shape the config already had for
 * `googleSignInOrigins()`.
 */
async function policyUnder(nodeEnv: string): Promise<string> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  const config = (await import("../../next.config")).default;
  const routes = await config.headers!();
  const headers = routes[0]?.headers ?? [];
  return headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
}

/** The one directive at issue, isolated. */
function scriptSrc(policy: string): string {
  return (
    policy
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("script-src ")) ?? ""
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the Content Security Policy", () => {
  it("never allows string eval in production", async () => {
    // The whole point. React's development build wants `eval` for
    // source-mapped call stacks; the production build never does, and says so
    // in the message it prints when the policy blocks it.
    expect(scriptSrc(await policyUnder("production"))).not.toMatch(/(^|\s)'unsafe-eval'/);
  });

  it("allows it in development, so the dev overlay stops reporting a non-bug", async () => {
    expect(scriptSrc(await policyUnder("development"))).toMatch(/(^|\s)'unsafe-eval'/);
  });

  it("differs in exactly that one token and nothing else", async () => {
    // The claim the doc comment makes, asserted rather than asserted-by-
    // comment: a dev-only relaxation that quietly also dropped a directive
    // would still pass both tests above.
    const production = await policyUnder("production");
    const development = await policyUnder("development");
    expect(development.replace(" 'unsafe-eval'", "")).toBe(production);
  });

  it("keeps `wasm-unsafe-eval` in both, which is a different thing", async () => {
    // react-pdf lays text out with a WebAssembly build of Yoga. Losing this
    // takes the preview, the page-fit indicator, X-Ray and the PDF download
    // with it; a substring check would confuse the two directives.
    for (const env of ["production", "development"]) {
      expect(scriptSrc(await policyUnder(env)), env).toContain("'wasm-unsafe-eval'");
    }
  });
});
