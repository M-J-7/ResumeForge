/**
 * Zod without its `eval` probe, in the browser.
 *
 * Zod 4 compiles fast parsers with `new Function` when it can, and finds out
 * whether it can by trying once. Our CSP has no `'unsafe-eval'`, so in a
 * browser the answer is always no — and the attempt itself is reported as a
 * `securitypolicyviolation`, which the live `/templates` page logged on every
 * visit and Lighthouse's best-practices audit counted against it
 * (2026-09-30). `jitless` skips the probe; Zod's own comment beside it names
 * this exact case.
 *
 * The server has no CSP and keeps the compiled parsers. Imported for its
 * effect by `resume/schema.ts`, which the cover-letter schema imports in
 * turn — so it is set before any schema in the app is first parsed.
 */

import { z } from "zod";

if (typeof window !== "undefined") z.config({ jitless: true });
