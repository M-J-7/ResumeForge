"use client";

/**
 * System / Light / Dark, as a three-option radio group.
 *
 * A radio group rather than the more common two-state switch, because the
 * three states are not orderable: "system" is not between light and dark, and
 * a switch that cycles through it gives no way to see which one is active.
 * `role="radiogroup"` also earns arrow-key navigation, which §9's keyboard
 * requirement would otherwise have to be hand-built.
 *
 * ## Why the DOM attribute is not React state
 *
 * `data-theme` is already on `<html>` before React hydrates — `THEME_SCRIPT`
 * put it there in `<head>` to avoid a flash. Making React the owner of it
 * would mean either a hydration mismatch on every load or re-rendering the
 * whole tree to change one attribute on one element. The preference is read
 * with `useSyncExternalStore` (see `src/lib/theme.ts`); the attribute is
 * written directly.
 */

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  DARK_QUERY,
  applyTheme,
  readServerThemePreference,
  readThemePreference,
  subscribeThemePreference,
  writeThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: "system", label: "System", Icon: MonitorIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    readThemePreference,
    readServerThemePreference,
  );

  /**
   * Follow the OS while — and only while — the preference is "system".
   *
   * Without this, choosing "system" and then switching the OS to dark leaves
   * the page in whatever it resolved to at load. The listener is torn down
   * when the preference is anything else, so an explicit choice is never
   * overridden by the system changing underneath it.
   */
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const move = (event: React.KeyboardEvent, delta: number) => {
    event.preventDefault();
    const index = OPTIONS.findIndex((option) => option.value === preference);
    const next = OPTIONS[(index + delta + OPTIONS.length) % OPTIONS.length];
    if (next) writeThemePreference(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "border-line bg-surface-2 inline-flex items-center gap-0.5 rounded-md border p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Roving tabindex: a three-button control costs one tab stop, not
            // three, and arrow keys move between the options.
            tabIndex={selected ? 0 : -1}
            onClick={() => writeThemePreference(value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") move(event, 1);
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") move(event, -1);
            }}
            className={cn(
              "focus-visible:ring-accent rounded-[6px] p-1.5 transition focus-visible:ring-2 focus-visible:outline-none",
              selected ? "bg-surface-0 text-text shadow-sm" : "text-muted hover:text-text",
            )}
          >
            <Icon className="h-4 w-4" />
            {/* The icon is decorative; this is the accessible name. */}
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
