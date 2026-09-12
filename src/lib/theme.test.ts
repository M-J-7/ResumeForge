/**
 * The theme preference.
 *
 * The tests that matter here are about one invariant: `data-theme` on `<html>`
 * is always a *resolved* `light` or `dark`, never the literal `system`.
 * `globals.css` repoints Tailwind's `dark:` variant at `[data-theme="dark"]`,
 * so a `system` value would match neither that branch nor the media-query
 * fallback — and roughly 250 `dark:` classes across the app would stop
 * applying while still compiling and still passing lint. There is no error to
 * observe; the app just quietly loses dark mode.
 */

import { describe, expect, it } from "vitest";
import {
  DARK_QUERY,
  THEME_PREFERENCES,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
  isThemePreference,
  readServerThemePreference,
  resolveTheme,
} from "./theme";

describe("resolveTheme", () => {
  it("honours an explicit choice regardless of the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system only for the system preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("never returns anything but light or dark", () => {
    for (const preference of THEME_PREFERENCES) {
      for (const systemPrefersDark of [true, false]) {
        expect(["light", "dark"]).toContain(resolveTheme(preference, systemPrefersDark));
      }
    }
  });
});

describe("isThemePreference", () => {
  it("accepts the three real values", () => {
    for (const preference of THEME_PREFERENCES) expect(isThemePreference(preference)).toBe(true);
  });

  it("rejects anything else, including a null from empty storage", () => {
    for (const value of [null, undefined, "", "System", "auto", 1, {}]) {
      expect(isThemePreference(value)).toBe(false);
    }
  });
});

describe("readServerThemePreference", () => {
  it("answers system, which is the only thing the server can know", () => {
    // Guessing light here would flash on every dark-mode user's first paint;
    // guessing dark would do the same to everyone else. `useSyncExternalStore`
    // takes this as the server snapshot precisely so it can be corrected on
    // the client without a hydration mismatch.
    expect(readServerThemePreference()).toBe("system");
  });
});

describe("THEME_SCRIPT", () => {
  /**
   * Runs the real script string against a fake document and localStorage.
   * `new Function` rather than `eval` so it cannot see this scope, which is
   * also how the browser will run it.
   */
  function run(stored: string | null, systemPrefersDark: boolean): string | null {
    let attribute: string | null = null;
    const documentStub = {
      documentElement: {
        setAttribute(name: string, value: string) {
          if (name === "data-theme") attribute = value;
        },
      },
    };
    const windowStub = { matchMedia: () => ({ matches: systemPrefersDark }) };
    const localStorageStub = { getItem: () => stored };

    new Function("document", "window", "localStorage", THEME_SCRIPT)(
      documentStub,
      windowStub,
      localStorageStub,
    );

    return attribute;
  }

  it("resolves each stored preference to a concrete theme", () => {
    expect(run("dark", false)).toBe("dark");
    expect(run("light", true)).toBe("light");
    expect(run("system", true)).toBe("dark");
    expect(run("system", false)).toBe("light");
  });

  it("treats absent or corrupt storage as system", () => {
    expect(run(null, true)).toBe("dark");
    expect(run("chartreuse", true)).toBe("dark");
    expect(run(null, false)).toBe("light");
  });

  it("never writes the literal 'system' onto the element", () => {
    // The invariant this whole module exists to hold. See the header.
    for (const stored of [null, "system", "light", "dark", "nonsense"]) {
      for (const systemPrefersDark of [true, false]) {
        expect(["light", "dark"]).toContain(run(stored, systemPrefersDark));
      }
    }
  });

  it("still sets a theme when localStorage throws", () => {
    // Safari in private mode throws on access rather than returning null. An
    // unhandled throw here would leave the page with no data-theme at all.
    let attribute: string | null = null;
    const documentStub = {
      documentElement: {
        setAttribute(name: string, value: string) {
          if (name === "data-theme") attribute = value;
        },
      },
    };
    const throwingStorage = {
      getItem() {
        throw new Error("SecurityError");
      },
    };

    new Function("document", "window", "localStorage", THEME_SCRIPT)(
      documentStub,
      { matchMedia: () => ({ matches: true }) },
      throwingStorage,
    );

    expect(attribute).toBe("light");
  });

  it("embeds the same key and query the module uses", () => {
    // The script is a string, so a rename elsewhere cannot break it at
    // compile time. This is the check that would have caught it.
    expect(THEME_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_SCRIPT).toContain(JSON.stringify(DARK_QUERY));
  });
});
