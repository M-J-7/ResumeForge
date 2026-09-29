/**
 * `cn` knows the project's own type scale.
 *
 * `tailwind-merge` classifies `text-*` by looking the suffix up in Tailwind's
 * default scale: `text-sm` is a size, anything it does not recognise is a
 * colour. A project that adds a font size called `title` breaks that guess —
 * `text-title` is filed as a colour, so it no longer conflicts with
 * `text-small`, both survive, and which one wins is decided by the order
 * Tailwind happened to emit them in.
 *
 * The symptom is a component prop that silently does nothing, which is exactly
 * what happened to the landing page's refusals before this test existed.
 */

import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("lets a caller's size beat a component's own", () => {
    expect(cn("text-small", "text-title")).toBe("text-title");
    expect(cn("text-body", "text-display-1")).toBe("text-display-1");
    expect(cn("text-micro", "text-body-l")).toBe("text-body-l");
  });

  it("still treats the scale and the palette as different things", () => {
    // A size and a colour are not in conflict and both have to survive. This
    // is the half the default configuration already got right, and the half a
    // careless `classGroups` override would break.
    expect(cn("text-muted", "text-body")).toBe("text-muted text-body");
    expect(cn("text-body", "text-accent")).toBe("text-body text-accent");
  });

  it("still resolves Tailwind's own sizes", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    // And across the two scales, which is what a half-migrated file looks like.
    expect(cn("text-sm", "text-body")).toBe("text-body");
  });
});
