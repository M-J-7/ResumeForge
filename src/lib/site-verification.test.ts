/**
 * The search-engine ownership tags print only what the owner pasted.
 *
 * An empty code must print nothing — a `google-site-verification` tag with
 * no content is noise in every page's head — and a pasted code must reach
 * the metadata in the shape Next turns into the right `<meta>` element.
 */

import { describe, expect, it } from "vitest";
import { SEARCH_VERIFICATION, searchVerification } from "./site";

describe("searchVerification", () => {
  it("is absent until a code has been pasted, and well-formed after", () => {
    const result = searchVerification();
    const google = SEARCH_VERIFICATION.google.trim();
    const bing = SEARCH_VERIFICATION.bing.trim();
    if (!google && !bing) {
      expect(result).toBeUndefined();
      return;
    }
    if (google) expect(result?.google).toBe(google);
    if (bing) expect(result?.other?.["msvalidate.01"]).toBe(bing);
  });

  it("holds codes, not whole tags", () => {
    // The console shows a full <meta> element; only its content belongs here.
    for (const code of Object.values(SEARCH_VERIFICATION)) {
      expect(code).not.toMatch(/[<>"=]/);
    }
  });
});
