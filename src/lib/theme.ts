/**
 * Theme preference, and the script that applies it before first paint.
 *
 * Three states the user can choose from, but only two the document ever
 * carries. `data-theme` on `<html>` is always a *resolved* `light` or `dark`;
 * "system" is a preference, not an attribute value.
 *
 * That distinction is the whole design. `globals.css` repoints Tailwind's
 * `dark:` variant at `[data-theme="dark"]`, so a `data-theme="system"` on the
 * element would match neither the attribute branch nor the media-query branch,
 * and every `dark:` class in the app would silently stop applying — while
 * still compiling and still passing lint. Resolving here keeps that
 * impossible.
 */

export const THEME_STORAGE_KEY = "theme-preference";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** The media query both the script and the toggle resolve "system" against. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Runs synchronously in `<head>`, before the browser paints anything.
 *
 * A theme applied from a `useEffect` arrives one frame after the first paint,
 * which is the white flash every dark-mode implementation is judged by. This
 * has to be inline and blocking, and it is small enough to be both.
 *
 * CSP-safe: `next.config.ts` allows `script-src 'self' 'unsafe-inline'`, so no
 * header changes and no nonce plumbing. The `try/catch` is not defensive
 * habit — `localStorage` genuinely throws in some privacy modes, and an
 * exception here would abort before the attribute was set and leave the page
 * unthemed.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p!=="light"&&p!=="dark"&&p!=="system")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

/* -------------------------------------------------------------------------- */
/* The preference, as an external store                                        */
/* -------------------------------------------------------------------------- */

/**
 * `localStorage` is external state, so the component reads it with
 * `useSyncExternalStore` rather than copying it into React state from an
 * effect. Three things fall out of that, and the third is why it is worth the
 * extra twenty lines:
 *
 *   - No hydration mismatch: `getServerSnapshot` answers "system", which is
 *     what the server can actually know.
 *   - No cascading render on mount, which is what React's own lint rule
 *     objects to about the effect-and-setState shape.
 *   - Two tabs stay in step, because the `storage` event is part of the
 *     subscription. Changing the theme in one tab used to leave the other
 *     showing a stale selection.
 */
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeThemePreference(listener: () => void): () => void {
  listeners.add(listener);
  // `storage` fires in *other* tabs, never the one that wrote. `emit` covers
  // this tab; this covers the rest.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    // Private-browsing modes throw on access rather than returning null.
    return "system";
  }
}

/** What the server renders. It cannot know the answer, and must not guess. */
export function readServerThemePreference(): ThemePreference {
  return "system";
}

/** Persists the choice and applies it to the document in one step. */
export function writeThemePreference(next: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // The theme still applies for this session; it just will not persist.
  }
  applyTheme(next);
  emit();
}

/** Stamps the resolved theme onto `<html>`, the same way `THEME_SCRIPT` does. */
export function applyTheme(preference: ThemePreference): void {
  const systemPrefersDark = window.matchMedia(DARK_QUERY).matches;
  document.documentElement.setAttribute("data-theme", resolveTheme(preference, systemPrefersDark));
}
