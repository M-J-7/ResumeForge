/**
 * The letter editor's setup column, as data (§10.2, Tier 2.4).
 *
 * ## The bug this splits apart
 *
 * `LetterEditor` used to snapshot the whole `ComposeInput` when you pressed
 * Compose, and per-paragraph Recompose reused that snapshot. Half of that is
 * right and half of it is wrong, and they had been fused into one value:
 *
 *   - **Right.** `resume` and `match` must be frozen. They are the expensive
 *     asynchronous half — a server round trip for the resume, a parse and a
 *     score for the posting — and rebuilding them on a per-paragraph
 *     Recompose would make one button silently do a network request. Worse,
 *     they are what makes Recompose *the same paragraph*: rebuilding the
 *     match against a posting edited in the meantime would quietly change
 *     which bullets the letter quotes.
 *   - **Wrong.** Tone, angle, availability, company, role title and the
 *     recipient are live UI state. Changing Tone to Formal and then pressing
 *     one paragraph's Recompose reproduced the *old* tone, with no indication
 *     that the control had been ignored. That is the defect.
 *
 * So the snapshot keeps the sources and the setup is read fresh, and
 * `toComposeInput` is where the two are put back together.
 *
 * ## Why it lives in `lib/` rather than in the component
 *
 * It is a pure function of two plain objects, so the regression test for it
 * is a node test rather than a jsdom one — no React, no render, no user
 * event. The test that would otherwise pin this behaviour would have had to
 * mount the whole editor, stub the resume loader and the skill index, and
 * then assert on a textarea's value.
 */

import type { MatchResult } from "@/lib/match/score";
import type { ResumeDocument } from "@/lib/resume/schema";
import type { ComposeInput } from "./compose";
import { fill, SALUTATION_WITH_NAME, type Angle, type Tone } from "./phrasing";
import { DEFAULT_SALUTATION, DEFAULT_SIGN_OFF } from "./schema";

/**
 * The expensive half, frozen at the moment Compose was pressed.
 *
 * Both are asynchronous to obtain and both decide *which of the user's own
 * sentences* the letter quotes, which is why they are pinned rather than
 * re-read: a Recompose that changed the evidence would not be a recompose.
 */
export interface ComposeSources {
  resume: ResumeDocument;
  match: MatchResult;
}

/** The cheap half: everything the setup column holds, read live. */
export interface ComposeSetup {
  company: string;
  roleTitle: string;
  tone: Tone;
  angle: Angle;
  availability: string;
  recipientName: string;
  recipientTitle: string;
  recipientAddress: string;
  salutation: string;
  signOff: string;
}

/**
 * The greeting to compose with (§10.2, 2.3).
 *
 * A typed recipient name upgrades the greeting from "Dear Hiring Manager,"
 * to "Dear <name>," — but **only** while the greeting is still the default.
 * A user who has written their own is never overruled by filling in a field
 * further up the column.
 *
 * The name goes in verbatim. No honorific is derived from it; see
 * `SALUTATION_WITH_NAME`.
 */
export function salutationFor(setup: ComposeSetup): string {
  const name = setup.recipientName.trim();
  const current = setup.salutation.trim();
  if (!name) return current || DEFAULT_SALUTATION;
  if (current && current !== DEFAULT_SALUTATION) return current;
  return fill(SALUTATION_WITH_NAME, { name });
}

/**
 * Puts the frozen sources back together with the live setup.
 *
 * `recipient.company` is filled from the Company field rather than kept
 * separately: there is one company in play, and two inputs for it would
 * eventually disagree on the same page.
 */
export function toComposeInput(sources: ComposeSources, setup: ComposeSetup): ComposeInput {
  return {
    resume: sources.resume,
    match: sources.match,
    company: setup.company,
    roleTitle: setup.roleTitle,
    tone: setup.tone,
    angle: setup.angle,
    availability: setup.availability,
    recipient: {
      name: setup.recipientName,
      title: setup.recipientTitle,
      company: setup.company,
      address: setup.recipientAddress,
    },
    salutation: salutationFor(setup),
    signOff: setup.signOff || DEFAULT_SIGN_OFF,
  };
}
