"use client";

/**
 * The experience band, read from storage and shared with the step components
 * (P35).
 *
 * ## `useSyncExternalStore`, not an effect
 *
 * The preference lives in `localStorage`, which is outside React. Reading it
 * in a `useEffect` and calling `setState` renders once with the wrong answer
 * and again with the right one — and because the answer decides the *step
 * order*, the visible symptom is a rail that rearranges itself under the
 * cursor of someone already reading it. `useSyncExternalStore` is the API
 * built for exactly this, and it also gives the correct server snapshot for
 * free.
 *
 * ## A context on top of it
 *
 * Each step could call the hook itself, and the value would be right. It is
 * a context anyway so there is one subscription rather than eight, and so a
 * step rendered outside the builder — a component test, a future preview —
 * gets `null` without needing `localStorage` to exist.
 */

import { createContext, use, useSyncExternalStore } from "react";
import {
  readExperienceLevel,
  serverExperienceLevel,
  subscribeToExperienceLevel,
  type ExperienceLevel,
} from "@/lib/resume/experience-level";

const ExperienceLevelContext = createContext<ExperienceLevel | null>(null);

export const ExperienceLevelProvider = ExperienceLevelContext.Provider;

/** The stored preference, kept in step with storage. */
export function useStoredExperienceLevel(): ExperienceLevel | null {
  return useSyncExternalStore(
    subscribeToExperienceLevel,
    readExperienceLevel,
    serverExperienceLevel,
  );
}

/** The band the surrounding builder is using. `null` outside one. */
export function useExperienceLevel(): ExperienceLevel | null {
  return use(ExperienceLevelContext);
}
