"use client";

/**
 * The cover letter editor (P29-J2).
 *
 * Three columns at `xl`, matching the builder's grammar so nothing feels
 * bolted on:
 *
 *   - **Left — Setup.** Which resume, which posting, who it is addressed to,
 *     tone, angle, availability. One *Compose draft* button; nothing composes
 *     while you type, for the same reason nothing scores while you type (D12).
 *   - **Middle — Paragraphs.** Editable blocks with a Sources chip each, and
 *     per-paragraph Recompose and Reset.
 *   - **Right — Preview.** The live PDF on the same paper canvas as the
 *     builder, with the same download row. All three formats, never
 *     paywalled (D13).
 *
 * ## The line above the first paragraph
 *
 * *"This is a draft. Every sentence came from your resume — edit it in your
 * own voice."* Both halves are literally true (see `lib/cover-letter/`), and
 * saying so is the product position: this tool does not write for you, and a
 * user who believes it does will send something they cannot defend.
 *
 * ## One editor, two storage backends
 *
 * Signed in, everything goes to the account. Signed out, the resume comes
 * from the local draft and the letter goes to IndexedDB — nothing hits the
 * server, which is P29's acceptance criterion for guests and is decided once,
 * here, by which stores get constructed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/control";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { PdfCanvas } from "@/components/preview/PdfCanvas";
import { AlertTriangleIcon, RedoIcon } from "@/components/ui/icons";
import { useCoverLetterPreview } from "./useCoverLetterPreview";
import { createLocalCoverLetterStore, type CoverLetterStore } from "@/store/cover-letters";
import { createLocalJobTargetStore } from "@/store/job-targets";
import { withLocalLoad, type RemoteJobTargetStore } from "@/components/match/jobTargetStore";
import { UnmatchedPostingNotice } from "@/components/match/UnmatchedPostingNotice";
import { createDraftStore, idbBackend } from "@/store/persistence";
import { safeMigrate } from "@/lib/resume/migrate";
import { safeMigrateCoverLetter } from "@/lib/cover-letter/migrate";
import {
  composeCoverLetter,
  composeDiagnostics,
  composeParagraph,
  selectAlignmentSkills,
  selectListedSkills,
} from "@/lib/cover-letter/compose";
import { describeSources, findEntry } from "@/lib/cover-letter/provenance";
import { diffWords, summarizeDiff } from "@/lib/cover-letter/word-diff";
import { toComposeInput, type ComposeSetup, type ComposeSources } from "@/lib/cover-letter/setup";
import { createEnhancementRequest } from "@/lib/cover-letter/enhance";
import {
  ANGLE_DESCRIPTIONS,
  ANGLE_LABELS,
  ANGLES,
  TONE_DESCRIPTIONS,
  TONE_LABELS,
  TONES,
  type Angle,
  type Tone,
} from "@/lib/cover-letter/phrasing";
import { suggestCoverLetterTitle } from "@/lib/cover-letter/record";
import {
  DEFAULT_SALUTATION,
  DEFAULT_SIGN_OFF,
  MAX_COVER_LETTER_PARAGRAPHS,
  type CoverLetterDocument,
  type CoverLetterEnhancement,
  type CoverLetterParagraph,
} from "@/lib/cover-letter/schema";
import { parseJobDescription } from "@/lib/jd/parse";
import { scoreResume, type MatchResult } from "@/lib/match/score";
import { loadSkillIndex } from "@/lib/skills";
import type { ResumeDocument } from "@/lib/resume/schema";
import { renderCoverLetterDocx, renderCoverLetterText } from "@/lib/emit/cover-letter";
import { coverLetterFileName, type ExportFormat } from "@/lib/emit/filename";
import { cn } from "@/lib/utils";

export interface ResumeOption {
  id: string;
  title: string;
}

export interface JobTargetOption {
  id: string;
  title: string;
  company: string | null;
  roleTitle: string | null;
}

export interface InitialLetter {
  id: string;
  title: string;
  /** Serialized `CoverLetterDocument`. */
  content: string;
  resumeId: string | null;
  jobTargetId: string | null;
  /**
   * Carried since §10.2. The row has always held these, and the editor was
   * only reading them on the *guest* load path — so a signed-in user
   * reopening a letter got an empty Company and Role title, and the next
   * Recompose wrote a letter that named neither.
   */
  company: string | null;
  roleTitle: string | null;
}

interface EnhancementProposal {
  paragraphId: string;
  originalText: string;
  text: string;
  modelId: string;
  modelRevision: string;
}

const ENHANCEMENT_NOTICE_KEY = "cover-letter-enhancement-notice-v1";

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LetterEditor({
  signedIn,
  letterId = null,
  initial = null,
  resumes = [],
  jobTargets: serverJobTargets = [],
  preselectedJobTargetId = null,
  preselectedResumeId = null,
}: {
  signedIn: boolean;
  /**
   * The id in the URL, or null on `/letters/new`.
   *
   * Needed separately from `initial` because of the guests. A guest's saved
   * letters are in IndexedDB, which the server cannot read, so `/letters/<id>`
   * renders with `initial` null and the letter has to be fetched here by id.
   * Without this the "Open" link on a guest's own card led to an empty
   * editor — the letter was safely stored and simply never loaded.
   */
  letterId?: string | null;
  initial?: InitialLetter | null;
  resumes?: ResumeOption[];
  jobTargets?: JobTargetOption[];
  preselectedJobTargetId?: string | null;
  preselectedResumeId?: string | null;
}) {
  const router = useRouter();

  /* ---- Stores, chosen once ---------------------------------------------- */

  const [letterStore, setLetterStore] = useState<CoverLetterStore | null>(null);
  const [jobStore, setJobStore] = useState<RemoteJobTargetStore | null>(null);
  const [jobTargets, setJobTargets] = useState<JobTargetOption[]>(serverJobTargets);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!signedIn) {
        if (cancelled) return;
        setLetterStore(createLocalCoverLetterStore());
        setJobStore(withLocalLoad(createLocalJobTargetStore()));
        return;
      }
      const [{ createServerCoverLetterStore }, { createServerJobTargetStore }] = await Promise.all([
        import("./serverCoverLetters"),
        import("@/components/match/serverJobTargets"),
      ]);
      if (cancelled) return;
      setLetterStore(createServerCoverLetterStore());
      setJobStore(createServerJobTargetStore());
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // A guest's saved postings are only knowable in the browser.
  useEffect(() => {
    if (!jobStore || signedIn) return;
    let cancelled = false;
    void jobStore
      .list()
      .then((records) => {
        if (cancelled) return;
        setJobTargets(
          records.map((record) => ({
            id: record.id,
            title: record.title,
            company: record.company,
            roleTitle: record.roleTitle,
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [jobStore, signedIn]);

  /* ---- Loading a guest's saved letter ----------------------------------- */

  /**
   * Only ever runs when the server had nothing to hand over — which is every
   * guest, and a signed-in user who followed a stale link. `loaded` gates it
   * so an id that resolves to nothing is asked for once rather than on every
   * render that changes the store's identity.
   */
  const [localLoadDone, setLocalLoadDone] = useState(Boolean(initial) || !letterId);

  /* ---- Setup state ------------------------------------------------------ */

  const [resumeId, setResumeId] = useState<string>(
    initial?.resumeId ?? preselectedResumeId ?? resumes[0]?.id ?? "",
  );
  const [jobTargetId, setJobTargetId] = useState<string>(
    initial?.jobTargetId ?? preselectedJobTargetId ?? "",
  );
  const [pastedJd, setPastedJd] = useState("");
  /**
   * Company and Role title, as *overrides* rather than as values (§10.2).
   *
   * `null` means "the user has not touched this", which is what lets the
   * selected posting fill it in; `""` means they cleared it deliberately and
   * is left alone. Two different states that a plain `""` cannot tell apart.
   *
   * This replaces the reported defect directly. The prefill used to happen
   * inside the `<Select>`'s `onChange`, so it only fired when somebody
   * *picked* a posting by hand — arriving from the Match tab at
   * `/letters/new?job=<id>` with one already selected left both fields blank,
   * the opening degraded to "I am writing about the open role.", and the only
   * way out was to select "— none selected —" and back again, because
   * re-picking the same option does not re-fire `onChange`.
   *
   * The plan for this fix proposed an effect keyed on `[jobTargets,
   * jobTargetId]` with a ref recording which id had been prefilled. Deriving
   * it during render is the same behaviour with none of the machinery: no
   * second render, no ref to keep in step, nothing to run at the wrong
   * moment, and it copes with a guest's postings arriving asynchronously from
   * IndexedDB *after* mount simply by being recomputed when they do.
   */
  const [companyOverride, setCompanyOverride] = useState<string | null>(initial?.company ?? null);
  const [roleTitleOverride, setRoleTitleOverride] = useState<string | null>(
    initial?.roleTitle ?? null,
  );
  const [tone, setTone] = useState<Tone>("direct");
  const [angle, setAngle] = useState<Angle>("impact");
  const [availability, setAvailability] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [salutation, setSalutation] = useState(DEFAULT_SALUTATION);
  const [signOff, setSignOff] = useState(DEFAULT_SIGN_OFF);

  /** Which posting the composed draft was actually built from, named after the fact. */
  const [composedFrom, setComposedFrom] = useState<string | null>(null);
  /** Set when a reopened letter could not restore everything it was written with. */
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  /* ---- Letter state ----------------------------------------------------- */

  const [letter, setLetter] = useState<CoverLetterDocument | null>(() => {
    if (!initial) return null;
    const migrated = safeMigrateCoverLetter(JSON.parse(initial.content) as unknown);
    return migrated.ok ? migrated.document : null;
  });
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"composing" | "saving" | null>(null);
  const [enhancingParagraphId, setEnhancingParagraphId] = useState<string | null>(null);
  /**
   * Progress on the one-time model download, 0–1, or null when indeterminate.
   *
   * A separate piece of state from `enhancingParagraphId` because the two say
   * different things: one is "work is happening", the other is "and this much
   * of it is done". Conflating them would mean showing a progress bar during
   * inference, where there is nothing to measure.
   */
  const [enhanceProgress, setEnhanceProgress] = useState<number | null>(null);
  /** Cancels the run in flight. Held in a ref: aborting is not a render. */
  const enhanceAbort = useRef<AbortController | null>(null);
  const [pendingEnhancement, setPendingEnhancement] = useState<CoverLetterParagraph | null>(null);
  const [proposal, setProposal] = useState<EnhancementProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  /**
   * Puts the setup column back to what the letter was written with (§10.2).
   *
   * Reopening a saved letter used to restore `company`, `roleTitle` and
   * `jobTargetId` and nothing else — so the recipient, the greeting and the
   * sign-off all silently reverted to defaults, and pressing Recompose then
   * rewrote the letter without them. Everything the document actually carries
   * is restored here.
   *
   * `tone`, `angle` and `availability` are **not** stored on the document
   * (that needs a schema v2, recorded in Tier 3), so they cannot be restored
   * and the user is told so rather than shown a control that lies about which
   * setting produced the text in front of them.
   */
  const restoreSetupFrom = useCallback((document: CoverLetterDocument) => {
    setRecipientName(document.recipient.name);
    setRecipientTitle(document.recipient.title);
    setRecipientAddress(document.recipient.address);
    setSalutation(document.salutation || DEFAULT_SALUTATION);
    setSignOff(document.signOff || DEFAULT_SIGN_OFF);
    setRestoreNotice(
      "Tone, angle and availability are not saved with a letter yet, so they show their defaults — " +
        "set them again before you recompose, or the draft will change voice.",
    );
  }, []);

  /** A letter handed over by the server restores its setup on first render too. */
  const restoredInitial = useRef(false);
  useEffect(() => {
    if (restoredInitial.current || !letter || !initial) return;
    restoredInitial.current = true;
    restoreSetupFrom(letter);
  }, [letter, initial, restoreSetupFrom]);

  /** The posting currently selected, whether picked here or arrived with. */
  const selectedTarget = jobTargets.find((candidate) => candidate.id === jobTargetId);

  // Both arrival paths — picking a posting, and landing with `?job=` — now
  // produce the same values, because neither writes state at all.
  const company = companyOverride ?? selectedTarget?.company ?? "";
  const roleTitle = roleTitleOverride ?? selectedTarget?.roleTitle ?? "";

  useEffect(() => {
    if (localLoadDone || !letterStore || !letterId) return;
    let cancelled = false;

    void letterStore
      .load(letterId)
      .then((record) => {
        if (cancelled) return;
        setLocalLoadDone(true);
        if (!record) return;

        const migrated = safeMigrateCoverLetter(JSON.parse(record.content) as unknown);
        if (!migrated.ok) {
          setError(migrated.error.message);
          return;
        }
        setLetter(migrated.document);
        setSavedId(record.id);
        setTitle(record.title);
        setCompanyOverride((current) => current ?? record.company);
        setRoleTitleOverride((current) => current ?? record.roleTitle);
        if (record.jobTargetId) setJobTargetId(record.jobTargetId);
        restoreSetupFrom(migrated.document);
      })
      .catch(() => {
        if (!cancelled) setLocalLoadDone(true);
      });

    return () => {
      cancelled = true;
    };
  }, [localLoadDone, letterStore, letterId, restoreSetupFrom]);

  /**
   * The expensive half of the last compose (§10.2, 2.4).
   *
   * State rather than a ref, because the paragraph list reads it during
   * render to decide whether Recompose is available — and a ref read during
   * render is a value React has not been told can change.
   *
   * This used to be the *whole* `ComposeInput`, which is where the bug was:
   * tone, angle and the rest were frozen along with the resume and the match,
   * so changing Tone and then pressing one paragraph's Recompose silently
   * reproduced the old tone. The resume and the match still have to be
   * pinned — they are asynchronous to obtain and they decide which of the
   * user's own sentences get quoted — but nothing else does.
   */
  const [composeSources, setComposeSources] = useState<ComposeSources | null>(null);

  /**
   * The live setup, as one object.
   *
   * Memoised so the callbacks that consume it can depend on a single value
   * instead of naming all ten fields, and so it is stable while nothing in
   * the setup column has changed.
   */
  const setup: ComposeSetup = useMemo(
    () => ({
      company,
      roleTitle,
      tone,
      angle,
      availability,
      recipientName,
      recipientTitle,
      recipientAddress,
      salutation,
      signOff,
    }),
    [
      company,
      roleTitle,
      tone,
      angle,
      availability,
      recipientName,
      recipientTitle,
      recipientAddress,
      salutation,
      signOff,
    ],
  );

  const preview = useCoverLetterPreview(letter);

  /**
   * Choosing a posting is now only a state write.
   *
   * The prefill moved to the effect above, so both ways of arriving at a
   * selected posting — picking one here, or landing with `?job=` — go
   * through one path and produce the same result.
   */
  const selectJobTarget = useCallback((id: string) => setJobTargetId(id), []);

  const suggestedTitle = useMemo(
    () => suggestCoverLetterTitle(company, roleTitle),
    [company, roleTitle],
  );

  /** How many paragraphs carry wording a model proposed and the user accepted. */
  const enhancedCount = letter?.paragraphs.filter((paragraph) => paragraph.enhancement).length ?? 0;

  /** Both inputs hold a posting, and the pasted one is the one that wins. */
  const pastedJdOverrides = pastedJd.trim().length > 0 && jobTargetId !== "";

  /**
   * How many paragraphs a Recompose would overwrite work in.
   *
   * Computable exactly because the composer is deterministic: a paragraph
   * whose text differs from what `composeParagraph` produces for it right now
   * is one the user has edited (or one composed under different setup, which
   * a Recompose is equally about to replace). `custom` is excluded — there is
   * nothing to recompose it *to*, so a Recompose leaves it alone.
   */
  /**
   * The posting's strongest asks, and whether the letter names each.
   *
   * `selectAlignmentSkills` decides what may be named, so this asks it rather
   * than scanning the composed text — a substring search would report a skill
   * as "named" because it happens to appear inside one of the user's own
   * quoted bullets, which is a different claim entirely.
   */
  const topAsks = useMemo(() => {
    if (!composeSources) return [];
    const demonstrated = new Set(selectAlignmentSkills(composeSources.match));
    const listed = new Set(selectListedSkills(composeSources.match));
    return [...composeSources.match.keywords]
      .sort((a, b) => b.jdWeight - a.jdWeight)
      .slice(0, 6)
      .map((keyword) => ({
        skill: keyword.skill.canonical,
        /*
         * Three states, not two (§12).
         *
         * "Named" used to mean "the resume demonstrates it", because nothing
         * else could reach the letter. A listed-only skill can now be named in
         * the weaker sentence, and collapsing that back into "named" here
         * would tell the user the letter said something stronger than it did
         * — in the one panel whose job is to say exactly what it said.
         */
        state: demonstrated.has(keyword.skill.canonical)
          ? ("shown" as const)
          : listed.has(keyword.skill.canonical)
            ? ("listed" as const)
            : ("absent" as const),
      }));
  }, [composeSources]);

  /**
   * What is worth saying about this letter that is not in the letter (§12).
   *
   * Derived from the same input the letter is, so it cannot describe a letter
   * other than the one on screen. Nothing here is persisted.
   */
  const diagnostics = useMemo(
    () => (composeSources ? composeDiagnostics(toComposeInput(composeSources, setup)) : []),
    [composeSources, setup],
  );

  const editedParagraphCount = useMemo(() => {
    if (!letter || !composeSources) return 0;
    const input = toComposeInput(composeSources, setup);
    return letter.paragraphs.filter((paragraph) => {
      if (paragraph.role === "custom") return false;
      const fresh = composeParagraph(paragraph.role, input);
      return fresh !== null && fresh.text !== paragraph.text;
    }).length;
  }, [letter, composeSources, setup]);

  /* ---- Loading the two source documents --------------------------------- */

  const loadResumeDocument = useCallback(async (): Promise<ResumeDocument | null> => {
    if (signedIn && resumeId) {
      const { getResumeContentAction } = await import("@/app/dashboard/actions");
      const result = await getResumeContentAction(resumeId);
      return result.ok ? result.value : null;
    }
    // Guests, and a signed-in user with no saved resume selected: the draft
    // open in the builder is the only resume there is.
    const draft = await createDraftStore(idbBackend).read();
    if (!draft) return null;
    const migrated = safeMigrate(draft.document);
    return migrated.ok ? migrated.document : null;
  }, [signedIn, resumeId]);

  /**
   * The posting to compose against, and where it came from.
   *
   * Returns the *outcome* rather than a bare string, because "no posting" had
   * three meanings and one message (§10.2, Tier 1). Telling somebody to
   * "choose a saved job description" when they already chose one — which was
   * then deleted from the Match tab — sends them back to a select whose
   * option is gone.
   */
  const loadJobDescription = useCallback(async (): Promise<
    | { kind: "pasted"; description: string }
    | { kind: "saved"; description: string; label: string }
    | { kind: "none" }
    | { kind: "deleted" }
  > => {
    const pasted = pastedJd.trim();
    if (pasted) return { kind: "pasted", description: pasted };
    if (!jobStore || !jobTargetId) return { kind: "none" };
    const record = await jobStore.load(jobTargetId);
    // The record, not just its text: an id that no longer resolves is a
    // deleted posting, and that is a different thing from never having
    // picked one.
    if (!record) return { kind: "deleted" };
    return { kind: "saved", description: record.description, label: record.title };
  }, [pastedJd, jobStore, jobTargetId]);

  /* ---- Compose ---------------------------------------------------------- */

  const compose = useCallback(async () => {
    setBusy("composing");
    setError(null);
    setStatus(null);
    try {
      const resume = await loadResumeDocument();
      if (!resume) {
        setError(
          signedIn
            ? "That resume could not be opened. Pick another, or start one in the builder."
            : "There is no resume in this browser yet. Build one first — the letter is assembled from it.",
        );
        return;
      }

      const posting = await loadJobDescription();
      if (posting.kind === "deleted") {
        setError(
          "The posting this letter was written from has been deleted. Pick another, or paste it below.",
        );
        return;
      }
      if (posting.kind === "none") {
        setError("Choose a saved job description, or paste one below.");
        return;
      }

      const skills = await loadSkillIndex();
      const jd = parseJobDescription(posting.description);
      const match: MatchResult = scoreResume(resume, jd, { skills });

      // Only the expensive, decision-bearing half is frozen; the setup column
      // is read live on every recompose. See `lib/cover-letter/setup.ts`.
      const sources: ComposeSources = { resume, match };
      setComposeSources(sources);
      setLetter(composeCoverLetter(toComposeInput(sources, setup)));
      setProposal(null);
      setDirty(true);
      // The controls now match the text on screen, so the warning about them
      // showing defaults has stopped being true.
      setRestoreNotice(null);
      setComposedFrom(
        posting.kind === "pasted" ? "the posting pasted below" : `“${posting.label}”`,
      );
      setStatus(
        "Draft composed. Every sentence came from your resume — edit it in your own voice.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, [loadResumeDocument, loadJobDescription, signedIn, setup]);

  /* ---- Paragraph editing ------------------------------------------------ */

  const updateParagraph = useCallback((id: string, text: string) => {
    setLetter((current) =>
      current
        ? {
            ...current,
            paragraphs: current.paragraphs.map((paragraph) =>
              // A manual edit becomes the new source of truth. Retaining an
              // old undo snapshot after it would make Revert destructive.
              paragraph.id === id ? { ...paragraph, text, enhancement: undefined } : paragraph,
            ),
          }
        : current,
    );
    setDirty(true);
  }, []);

  /* ---- Provenance, made legible (§10.2, 2.1) ---------------------------- */

  /**
   * The entries behind a paragraph, as phrases.
   *
   * The chip used to be a count whose tooltip was a pair of UUIDs — so the
   * product's central claim, that every sentence came from your resume, was
   * evidenced to the user by two opaque identifiers. Ids that no longer
   * resolve are dropped by `describeSources` and the chip falls back to the
   * count, which is honest rather than wrong: a letter outlives the resume
   * entry it quoted, and naming a deleted entry would be a false statement in
   * the one place that must not make them.
   */
  const sourceLabelsFor = useCallback(
    (paragraph: CoverLetterParagraph): string[] =>
      composeSources ? describeSources(composeSources.resume, paragraph.sources) : [],
    [composeSources],
  );

  /**
   * The resume text a paragraph drew on, for the disclosure.
   *
   * Bullets rather than the whole entry: the bullet *is* the sentence in the
   * letter, and showing it beside the paragraph is the closest thing to
   * "here is where that came from" the product can offer without the trace
   * highlighting deferred to Tier 3.
   */
  const sourceQuotesFor = useCallback(
    (paragraph: CoverLetterParagraph): { label: string; bullets: string[] }[] => {
      const resume = composeSources?.resume;
      if (!resume) return [];
      const seen = new Set<string>();
      const quoted: { label: string; bullets: string[] }[] = [];

      for (const id of paragraph.sources) {
        if (seen.has(id)) continue;
        seen.add(id);
        const entry = findEntry(resume, id);
        if (!entry) continue;
        const label = describeSources(resume, [id])[0];
        if (!label) continue;
        quoted.push({ label, bullets: bulletsForEntry(resume, id) });
      }

      return quoted;
    },
    [composeSources],
  );

  const updateSalutation = useCallback((text: string) => {
    setLetter((current) => (current ? { ...current, salutation: text } : current));
    setSalutation(text);
    setDirty(true);
  }, []);

  const updateSignOff = useCallback((text: string) => {
    setLetter((current) => (current ? { ...current, signOff: text } : current));
    setSignOff(text);
    setDirty(true);
  }, []);

  /* ---- The user's own paragraphs (§10.2, 2.6) -------------------------- */

  /**
   * Enforced here as well as in the schema.
   *
   * `coverLetterDocumentSchema` caps the array, so without this the twelfth
   * paragraph is written, the thirteenth is written, and the failure arrives
   * as an opaque zod error at Save — after the writing is done, which is the
   * worst moment to find out.
   */
  const canAddParagraph = (letter?.paragraphs.length ?? 0) < MAX_COVER_LETTER_PARAGRAPHS;

  const addCustomParagraph = useCallback(() => {
    setLetter((current) => {
      if (!current || current.paragraphs.length >= MAX_COVER_LETTER_PARAGRAPHS) return current;
      return {
        ...current,
        paragraphs: [
          ...current.paragraphs,
          // `sources: []` is the honest value and the UI reads it as such: a
          // paragraph the user wrote has no resume provenance, and claiming
          // one would be the exact failure this feature exists to avoid.
          { id: `custom-${crypto.randomUUID()}`, role: "custom" as const, text: "", sources: [] },
        ],
      };
    });
    setDirty(true);
  }, []);

  const removeParagraph = useCallback((id: string) => {
    setLetter((current) => {
      if (!current) return current;
      const target = current.paragraphs.find((paragraph) => paragraph.id === id);
      // Only their own writing can be lost this way, so only their own
      // writing needs confirming.
      if (target?.text.trim() && !window.confirm("Delete this paragraph and its text?")) {
        return current;
      }
      return { ...current, paragraphs: current.paragraphs.filter((p) => p.id !== id) };
    });
    setDirty(true);
  }, []);

  const moveParagraph = useCallback((id: string, by: -1 | 1) => {
    setLetter((current) => {
      if (!current) return current;
      const from = current.paragraphs.findIndex((paragraph) => paragraph.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= current.paragraphs.length) return current;
      const paragraphs = [...current.paragraphs];
      const [moved] = paragraphs.splice(from, 1);
      if (moved) paragraphs.splice(to, 0, moved);
      return { ...current, paragraphs };
    });
    setDirty(true);
  }, []);

  const recomposeParagraph = useCallback(
    (paragraph: CoverLetterParagraph) => {
      if (!composeSources) return;

      /*
       * Recomposing an enhanced paragraph throws the enhancement away.
       *
       * `composeParagraph` returns a fresh object with no `enhancement` key,
       * so the metadata — including the `originalText` that Revert depends
       * on — goes with it. The plan allows either warning or silently
       * clearing the metadata; warning is the right half of that choice,
       * because the user reviewed and accepted this wording and would not
       * expect a button labelled "Recompose" to discard a decision.
       */
      if (
        paragraph.enhancement &&
        !window.confirm(
          "This paragraph has an enhancement you applied. Recomposing replaces it with the deterministic wording and you will not be able to revert. Continue?",
        )
      ) {
        return;
      }

      // Sources frozen, setup live — the whole point of the split.
      const rebuilt = composeParagraph(paragraph.role, toComposeInput(composeSources, setup));
      if (!rebuilt) return;
      setLetter((current) =>
        current
          ? {
              ...current,
              paragraphs: current.paragraphs.map((existing) =>
                existing.id === paragraph.id ? rebuilt : existing,
              ),
            }
          : current,
      );
      setDirty(true);
    },
    [composeSources, setup],
  );

  /* ---- Local enhancement ------------------------------------------------ */

  const enhanceParagraph = useCallback(
    async (paragraph: CoverLetterParagraph) => {
      if (!composeSources || enhancingParagraphId) return;
      const input = toComposeInput(composeSources, setup);

      const controller = new AbortController();
      enhanceAbort.current = controller;
      setEnhancingParagraphId(paragraph.id);
      setEnhanceProgress(null);
      setError(null);
      setStatus("Preparing a local wording suggestion. Your text stays in this browser.");
      try {
        const request = createEnhancementRequest(paragraph, input);
        // The model runtime is a separate client-only chunk. It is not loaded
        // until the user explicitly asks for this optional feature.
        const { enhanceLocally } = await import("@/lib/cover-letter/enhance.browser");
        const result = await enhanceLocally(request, {
          signal: controller.signal,
          onProgress: setEnhanceProgress,
        });
        setProposal({
          paragraphId: paragraph.id,
          originalText: paragraph.text,
          ...result,
        });
        setStatus("Suggestion ready. Review it before applying it to your letter.");
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "";
        if (cause instanceof Error && cause.name === "EnhancementAbortedError") {
          // The user asked for this. Saying "cancelled" is enough; an error
          // banner would read as something having gone wrong.
          setStatus("Enhancement cancelled. Your paragraph is unchanged.");
        } else {
          /*
           * A rejection from the guardrail is shown verbatim, and that is
           * deliberate. "The proposal newly claimed Prometheus, which your
           * resume does not demonstrate" tells the user something true and
           * useful about what the model tried to do; a generic failure
           * message would hide the most interesting thing that just happened.
           */
          setError(
            message.startsWith("The proposal") || message.startsWith("The local model")
              ? message
              : "Local enhancement is unavailable right now. Your original paragraph is unchanged.",
          );
          setStatus(null);
        }
      } finally {
        enhanceAbort.current = null;
        setEnhancingParagraphId(null);
        setEnhanceProgress(null);
      }
    },
    [composeSources, setup, enhancingParagraphId],
  );

  /**
   * Stops the run in flight.
   *
   * Real interruption rather than a discarded result — the adapter passes the
   * signal to `InterruptableStoppingCriteria`, which is checked between
   * generated tokens. On the WASM path, where a beam search can run for tens
   * of seconds, leaving it going while the UI pretended it had stopped would
   * be the worst of both.
   */
  const cancelEnhancement = useCallback(() => {
    enhanceAbort.current?.abort();
  }, []);

  // A navigation away must not leave a beam search running in a dead tab.
  useEffect(() => () => enhanceAbort.current?.abort(), []);

  const requestEnhancement = useCallback(
    async (paragraph: CoverLetterParagraph) => {
      setError(null);
      setStatus(null);
      setProposal(null);

      /*
       * Checked before the consent dialog, not after it.
       *
       * Offering somebody a one-time model download and *then* discovering
       * their browser cannot run it wastes their bandwidth to tell them no.
       * The deterministic Recompose stays available either way — per the
       * plan, an unsupported device leaves the feature unavailable rather
       * than moving any of this to a server.
       */
      const { isEnhancementSupported, isEnhancementInstalled } =
        await import("@/lib/cover-letter/enhance.browser");
      if (!isEnhancementSupported()) {
        setError(
          "This browser cannot run the local enhancement model. Recompose still works, and it needs no model at all.",
        );
        return;
      }
      /*
       * The model is vendored per deployment, not per build (~120MB), so a
       * build without it is a normal supported state. Finding out here is
       * what stops the user being offered a download that will 404 — and
       * saying which of the two reasons applies is more use than a shared
       * "unavailable".
       */
      if (!(await isEnhancementInstalled())) {
        setError(
          "This deployment does not ship the local enhancement model, so Enhance is unavailable here. Recompose needs no model and works as normal.",
        );
        return;
      }

      try {
        if (window.localStorage.getItem(ENHANCEMENT_NOTICE_KEY) === "accepted") {
          void enhanceParagraph(paragraph);
          return;
        }
      } catch {
        // Storage can be disabled. The consent dialog is still safe to show.
      }
      setPendingEnhancement(paragraph);
    },
    [enhanceParagraph],
  );

  const startPendingEnhancement = useCallback(() => {
    const paragraph = pendingEnhancement;
    if (!paragraph) return;
    try {
      window.localStorage.setItem(ENHANCEMENT_NOTICE_KEY, "accepted");
    } catch {
      // This merely controls whether to repeat a disclosure; enhancement does
      // not depend on persistent browser storage being available.
    }
    setPendingEnhancement(null);
    void enhanceParagraph(paragraph);
  }, [enhanceParagraph, pendingEnhancement]);

  const applyEnhancement = useCallback(() => {
    const accepted = proposal;
    if (!accepted) return;

    const target = letter?.paragraphs.find((paragraph) => paragraph.id === accepted.paragraphId);
    if (!target || target.text !== accepted.originalText) {
      setProposal(null);
      setError("That paragraph changed while its suggestion was open. Ask for a new enhancement.");
      return;
    }

    setLetter((current) => {
      if (!current) return current;
      return {
        ...current,
        paragraphs: current.paragraphs.map((paragraph) => {
          if (paragraph.id !== accepted.paragraphId) return paragraph;
          // Do not overwrite text the user changed while the proposal was on
          // screen. The stale suggestion can simply be requested again.
          if (paragraph.text !== accepted.originalText) return paragraph;
          const enhancement: CoverLetterEnhancement = {
            originalText: accepted.originalText,
            modelId: accepted.modelId,
            modelRevision: accepted.modelRevision,
            appliedAt: new Date().toISOString(),
          };
          return { ...paragraph, text: accepted.text, enhancement };
        }),
      };
    });
    setProposal(null);
    setDirty(true);
    setError(null);
    setStatus("Local enhancement applied. Review every claim before sending.");
  }, [letter, proposal]);

  const revertEnhancement = useCallback((id: string) => {
    setLetter((current) =>
      current
        ? {
            ...current,
            paragraphs: current.paragraphs.map((paragraph) =>
              paragraph.id === id && paragraph.enhancement
                ? { ...paragraph, text: paragraph.enhancement.originalText, enhancement: undefined }
                : paragraph,
            ),
          }
        : current,
    );
    setDirty(true);
    setProposal((current) => (current?.paragraphId === id ? null : current));
    setStatus("Original paragraph restored.");
  }, []);

  /* ---- Save ------------------------------------------------------------- */

  const save = useCallback(async () => {
    if (!letterStore || !letter) return;
    setBusy("saving");
    setError(null);
    try {
      /*
       * A posting pasted here is saved with the letter (§10.2, Tier 1).
       *
       * It was written nowhere: only `jobTargetId` was stored, so reopening a
       * letter composed from pasted text and pressing Recompose failed with
       * "Choose a saved job description, or paste one below" — about a
       * posting the user had already supplied.
       *
       * `create`, never `save(jobTargetId, …)`. Pasting new text after
       * picking a saved posting must not silently overwrite that posting; a
       * spare row costs one click to delete, an overwrite destroys something.
       *
       * The text does **not** go into `CoverLetterDocument`. That would need
       * a schema v2 for something the `JobTarget` table already exists to
       * hold, and would push up to 60 KB into a column documented as
       * self-contained. The storage seam is already right: a guest's posting
       * goes to IndexedDB (D6 intact), a signed-in user's to the same Server
       * Action the Match tab uses.
       */
      let savedJobTargetId = jobTargetId;
      const pasted = pastedJd.trim();
      if (pasted && jobStore) {
        const created = await jobStore.create({
          title: suggestedTitle,
          company: company || null,
          roleTitle: roleTitle || null,
          description: pasted,
        });
        savedJobTargetId = created.id;
        setJobTargetId(created.id);
        // Cleared so a second Save cannot duplicate the row, and so the
        // select below stops being overridden by a box that is now saved.
        setPastedJd("");
        setJobTargets((current) =>
          current.some((target) => target.id === created.id)
            ? current
            : [
                {
                  id: created.id,
                  title: created.title,
                  company: created.company,
                  roleTitle: created.roleTitle,
                },
                ...current,
              ],
        );
        // Company and Role title are derived from whichever posting is
        // selected, and the newly created one carries the same values, so
        // selecting it changes nothing the user can see.
      }

      const draft = {
        title: title.trim() || suggestedTitle,
        content: JSON.stringify(letter),
        resumeId: signedIn ? resumeId || null : null,
        jobTargetId: savedJobTargetId || null,
        company,
        roleTitle,
      };

      const record = savedId
        ? await letterStore.save(savedId, draft)
        : await letterStore.create(draft);

      if (!record) {
        setError("That letter no longer exists.");
        return;
      }

      setSavedId(record.id);
      setTitle(record.title);
      setDirty(false);
      setStatus(
        pasted
          ? `Saved as “${record.title}”, and the posting you pasted was saved with it.`
          : `Saved as “${record.title}”.`,
      );

      /**
       * A new letter gets its own URL, so reload and back both work.
       *
       * Through the **native History API** rather than `router.replace`, and
       * the difference is not cosmetic. `/letters/new` and `/letters/<id>`
       * are the same dynamic segment with a different param, so a router
       * navigation between them remounts this component — which throws away
       * the state set two lines above. The visible symptom is that clicking
       * Save flashes "Saved as …" and erases it in the same frame, leaving
       * the user with no confirmation that anything happened.
       *
       * Next integrates `pushState`/`replaceState` with its own router, so
       * `usePathname` stays correct and a later `router.refresh()` still
       * targets the right URL. See `next/dist/docs/01-app/01-getting-started/
       * 04-linking-and-navigating.md`, "Native History API".
       */
      if (!savedId) window.history.replaceState(null, "", `/letters/${record.id}`);
      else router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }, [
    letterStore,
    letter,
    title,
    suggestedTitle,
    signedIn,
    resumeId,
    jobTargetId,
    jobStore,
    pastedJd,
    company,
    roleTitle,
    savedId,
    router,
  ]);

  /* ---- Losing work ------------------------------------------------------ */

  /**
   * The "Unsaved changes" badge was the whole guard (§10.2, Tier 1).
   *
   * It rendered, and nothing stopped anybody navigating away past it. Two
   * exits need covering and they need different mechanisms:
   *
   *   - **Closing or reloading the tab** — `beforeunload`, which is the only
   *     hook a browser gives for it.
   *   - **The "All letters" link** — App Router client navigation does not
   *     fire `beforeunload` at all, so that one needs an explicit confirm.
   *     `window.confirm` rather than a modal because `LettersBrowser` already
   *     uses it for deletion; house style beats a second pattern.
   *
   * Registered only while `dirty`, so a browser's "leave site?" interstitial
   * never appears for a letter with nothing to lose — and, on the tabs where
   * it would, the listener is not installed at all.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmLeaving = useCallback(
    (event: React.MouseEvent) => {
      if (!dirty) return;
      const leave = window.confirm(
        "This letter has changes you have not saved. Leave the page and lose them?",
      );
      if (!leave) event.preventDefault();
    },
    [dirty],
  );

  /* ---- Downloads -------------------------------------------------------- */

  const fileNameFor = (format: ExportFormat) =>
    coverLetterFileName(letter?.contact.fullName ?? "", format);

  const downloadPdf = () => {
    if (!preview.bytes) return;
    // The exact bytes the preview rendered — not a second render (D2).
    download(new Blob([preview.bytes.slice()], { type: "application/pdf" }), fileNameFor("pdf"));
  };

  const downloadDocx = async () => {
    if (!letter) return;
    const { blob } = await renderCoverLetterDocx(letter);
    download(blob, fileNameFor("docx"));
  };

  const downloadText = () => {
    if (!letter) return;
    download(
      new Blob([renderCoverLetterText(letter)], { type: "text/plain;charset=utf-8" }),
      fileNameFor("txt"),
    );
  };

  /* ---- Render ----------------------------------------------------------- */

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      {/* ---- Left: setup --------------------------------------------------- */}
      <section
        aria-label="Letter setup"
        className="border-line min-h-0 overflow-auto border-b p-5 xl:w-80 xl:shrink-0 xl:border-r xl:border-b-0"
      >
        <h2 className="text-text text-sm font-semibold">Setup</h2>
        <p className="text-muted mt-1 text-xs">
          Nothing composes until you press the button. The draft is built from the resume and the
          posting you choose here.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {signedIn && resumes.length > 0 ? (
            <Field label="Resume">
              {({ id }) => (
                <Select id={id} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <p className="border-line bg-surface-1 text-muted rounded-md border p-3 text-xs">
              {signedIn
                ? "No saved resumes yet — the draft open in your builder will be used."
                : "The resume in this browser will be used. Nothing is uploaded."}
            </p>
          )}

          <Field
            label="Job description"
            hint="Pick one you saved from the Match tab, or paste a new one below."
          >
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={jobTargetId}
                onChange={(e) => selectJobTarget(e.target.value)}
              >
                <option value="">— none selected —</option>
                {jobTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/*
            Which of the two inputs actually wins (§10.2, Tier 1).
            `pastedJd` silently overrode a selected posting, with nothing on
            screen saying so — the select still showed a title that was not
            being used.
          */}
          {pastedJdOverrides ? (
            <p className="text-warn text-xs">
              The pasted text below is used instead of the posting selected above.
            </p>
          ) : null}

          <Field
            label="Or paste a posting"
            /*
              The field had no hint at all, which is most of why the posting
              felt ignored: nothing said what it decides, and nothing said
              what it does not do. Both halves matter — the second is the
              product's whole position (D8).
            */
            hint="It decides which of your bullets get quoted and which skills the letter may name. No wording from the posting is ever copied into your letter."
          >
            {({ id, describedBy }) => (
              <>
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={4}
                  value={pastedJd}
                  onChange={(e) => setPastedJd(e.target.value)}
                  placeholder="Paste a job description…"
                />
                {pastedJd ? (
                  <p className="mt-1">
                    <Button size="sm" variant="ghost" onClick={() => setPastedJd("")}>
                      Clear pasted posting
                    </Button>
                  </p>
                ) : null}
              </>
            )}
          </Field>

          <Field
            label="Company"
            hint="Named in the opening sentence, and used as the recipient. Left out entirely if blank."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={company}
                onChange={(e) => setCompanyOverride(e.target.value)}
              />
            )}
          </Field>

          <Field
            label="Role title"
            hint="Your words for the role, not the posting's. It appears in the opening sentence."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={roleTitle}
                onChange={(e) => setRoleTitleOverride(e.target.value)}
              />
            )}
          </Field>

          <Field label="Tone" hint={TONE_DESCRIPTIONS[tone]}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
              >
                {TONES.map((value) => (
                  <option key={value} value={value}>
                    {TONE_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Angle" hint={ANGLE_DESCRIPTIONS[angle]}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={angle}
                onChange={(e) => setAngle(e.target.value as Angle)}
              >
                {ANGLES.map((value) => (
                  <option key={value} value={value}>
                    {ANGLE_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Availability"
            hint="Your own words. Copied into the letter exactly as typed, or left out entirely."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="I can start from mid-November."
              />
            )}
          </Field>

          <details className="border-line rounded-md border p-3">
            <summary className="text-text cursor-pointer text-xs font-medium select-none">
              Addressed to (optional)
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Name">
                {({ id }) => (
                  <Input
                    id={id}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Their title">
                {({ id }) => (
                  <Input
                    id={id}
                    value={recipientTitle}
                    onChange={(e) => setRecipientTitle(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Address">
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={3}
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                  />
                )}
              </Field>
            </div>
          </details>

          <Button
            variant="primary"
            onClick={() => void compose()}
            disabled={busy !== null || enhancingParagraphId !== null}
          >
            {busy === "composing" ? "Composing…" : letter ? "Recompose draft" : "Compose draft"}
          </Button>

          {letter ? (
            /*
              Says how many, not merely that it might (§10.2, 2.6).
              "including any you have edited" is a note; "this replaces 2
              paragraphs you have edited" is a decision the user can make.
              An edited paragraph is one whose text no longer matches what the
              composer would produce for it — which is knowable exactly,
              because the composer is deterministic.
            */
            <p className="text-muted text-xs">
              {editedParagraphCount > 0
                ? `Recomposing replaces every paragraph, including the ${editedParagraphCount} you have edited.`
                : "Recomposing replaces every paragraph."}
            </p>
          ) : null}
        </div>
      </section>

      {/* ---- Middle: paragraphs -------------------------------------------- */}
      <section
        aria-label="Letter paragraphs"
        className="border-line min-h-0 flex-1 overflow-auto border-b p-5 xl:border-r xl:border-b-0"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Field
            label="Save this letter as"
            hint="Your own name for it. Nothing is derived silently."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={title}
                placeholder={suggestedTitle}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() => void save()}
              disabled={!letter || busy !== null || enhancingParagraphId !== null}
            >
              {busy === "saving" ? "Saving…" : savedId ? "Save" : "Save letter"}
            </Button>
            {dirty ? <Badge tone="warn">Unsaved changes</Badge> : null}
            {savedId && !dirty ? <Badge tone="ok">Saved</Badge> : null}
            <Link
              href="/letters"
              onClick={confirmLeaving}
              className="text-muted hover:text-text focus-visible:ring-accent rounded-md px-2 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
            >
              All letters
            </Link>
          </div>

          {error ? (
            <p role="alert" className="text-danger flex items-start gap-2 text-sm font-medium">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          {status ? (
            <p role="status" className="text-muted text-xs">
              {status}
            </p>
          ) : null}

          {/*
            An honest warning rather than a silent lie (§10.2, Tier 1).
            Reopening a letter cannot restore tone, angle or availability
            because they are not stored on the document — that needs the
            schema bump recorded in Tier 3. Showing the controls at their
            defaults with no explanation implies the letter was written with
            them, and pressing Recompose then changes its voice.
          */}
          {restoreNotice ? (
            <p className="border-warn/40 bg-warn-weak text-warn rounded-md border p-3 text-xs">
              {restoreNotice}
            </p>
          ) : null}

          {letter ? (
            <>
              <div className="border-accent/30 bg-accent-weak rounded-lg border p-3">
                {/*
                  Two accurate statements rather than one absolute one.

                  "Every sentence came from your resume" is the product's
                  central claim and it stops being true the moment a model
                  rewrites a paragraph. It also stays true of every paragraph
                  the model did *not* touch, so a mixed letter needs both
                  halves — saying only the AI half would understate the
                  provenance of the rest, and saying only the resume half
                  would be a false claim about the enhanced ones.
                */}
                <p className="text-accent text-xs">
                  {enhancedCount === 0
                    ? "This is a draft. Every sentence came from your resume — edit it in your own voice."
                    : enhancedCount === letter.paragraphs.length
                      ? "AI-assisted wording throughout. Review every claim before sending."
                      : `AI-assisted wording in ${enhancedCount} of ${letter.paragraphs.length} paragraphs — review every claim before sending. The rest came from your resume unaltered.`}
                </p>
                {/*
                  Which posting this draft actually came from (§10.2, Tier 1).
                  With two inputs for one thing, "it used the other one" is
                  not something a user should have to work out from the text.
                */}
                {composedFrom ? (
                  <p className="text-muted mt-1 text-xs">Composed against {composedFrom}.</p>
                ) : null}
              </div>

              {/*
                The same words the Match tab uses (§10.2, 2.2). Without this
                the editor produced a bracketed prompt telling the user to add
                bullets — blaming the resume for a posting we could not read.
              */}
              {composeSources?.match.unmatchedJd ? <UnmatchedPostingNotice /> : null}

              {/*
                What the posting weighted, and which of them the letter
                actually names. Already computed by `scoreResume` and thrown
                away here; the letter's whole relationship to the posting is
                these few rows, and it was invisible.
              */}
              {/*
                What the composer could not do, said beside the letter (§12).

                These used to be the evidence *paragraph* — a bracketed message
                where somebody's letter should be, relied on not to be sent.
                A warning wearing a document's clothes. The letter is a letter
                now and the warning is a warning.
              */}
              {diagnostics.length > 0 ? (
                <section
                  aria-labelledby="letter-diagnostics"
                  className="border-line bg-surface-1 rounded-lg border p-3"
                >
                  <h3 id="letter-diagnostics" className="text-text text-xs font-semibold">
                    Worth knowing about this draft
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {diagnostics.map((note) => (
                      <li key={note.kind} className="flex items-start gap-2">
                        <Badge tone={note.advisory ? "warn" : "danger"}>
                          {note.advisory ? "Note" : "Action"}
                        </Badge>
                        <span className="text-muted text-xs leading-relaxed">{note.message}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {topAsks.length > 0 ? (
                <section
                  aria-labelledby="letter-top-asks"
                  className="border-line rounded-lg border p-3"
                >
                  <h3 id="letter-top-asks" className="text-text text-xs font-semibold">
                    What this posting asked for, and what the letter says
                  </h3>
                  <p className="text-muted mt-1 text-xs">
                    Ranked by the weight the posting itself puts on each one. A skill a bullet shows
                    is named as demonstrated; one you only list is named as something you have
                    worked with, in its own sentence, and never as more than that.
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {topAsks.map((ask) => (
                      <li key={ask.skill} className="flex flex-wrap items-baseline gap-2 text-xs">
                        <span className="text-text font-medium">{ask.skill}</span>
                        <Badge
                          tone={
                            ask.state === "shown"
                              ? "accent"
                              : ask.state === "listed"
                                ? "warn"
                                : "neutral"
                          }
                        >
                          {ask.state === "shown"
                            ? "shown in your work"
                            : ask.state === "listed"
                              ? "on your skills list only"
                              : "not named"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/*
                Greeting and sign-off are letter *content*, so they belong
                here beside the paragraphs and must be editable without
                recomposing (§10.2, 2.3). `composeCoverLetter` has always
                honoured both; the gap was purely that nothing rendered them,
                so every letter went out addressed "Dear Hiring Manager,".
              */}
              <Field
                label="Greeting"
                hint="Use a name if you have one. No honorific is ever guessed for you."
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    value={letter.salutation}
                    onChange={(e) => updateSalutation(e.target.value)}
                  />
                )}
              </Field>

              <ul className="flex flex-col gap-4">
                {letter.paragraphs.map((paragraph, index) => (
                  <li key={paragraph.id}>
                    <ParagraphBlock
                      paragraph={paragraph}
                      sourceLabels={sourceLabelsFor(paragraph)}
                      sourceQuotes={sourceQuotesFor(paragraph)}
                      canRecompose={composeSources !== null && paragraph.role !== "custom"}
                      canEnhance={composeSources !== null && paragraph.role !== "custom"}
                      canMoveUp={index > 0}
                      canMoveDown={index < letter.paragraphs.length - 1}
                      isEnhancing={enhancingParagraphId === paragraph.id}
                      enhanceProgress={enhanceProgress}
                      proposal={proposal?.paragraphId === paragraph.id ? proposal : null}
                      onChange={(text) => updateParagraph(paragraph.id, text)}
                      onRecompose={() => recomposeParagraph(paragraph)}
                      onEnhance={() => requestEnhancement(paragraph)}
                      onApplyEnhancement={applyEnhancement}
                      onKeepOriginal={() => setProposal(null)}
                      onRevertEnhancement={() => revertEnhancement(paragraph.id)}
                      onCancelEnhancement={cancelEnhancement}
                      onMove={(by) => moveParagraph(paragraph.id, by)}
                      onRemove={() => removeParagraph(paragraph.id)}
                    />
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={addCustomParagraph} disabled={!canAddParagraph}>
                  Add a paragraph of your own
                </Button>
                {!canAddParagraph ? (
                  <span className="text-muted text-xs">
                    {MAX_COVER_LETTER_PARAGRAPHS} paragraphs is the limit for one letter.
                  </span>
                ) : null}
              </div>

              <Field label="Sign-off">
                {({ id }) => (
                  <Input
                    id={id}
                    value={letter.signOff}
                    onChange={(e) => updateSignOff(e.target.value)}
                  />
                )}
              </Field>
            </>
          ) : (
            <div className="border-line bg-surface-1 rounded-lg border p-6 text-center">
              <p className="text-text text-sm font-medium">No draft yet</p>
              <p className="text-muted mx-auto mt-1 max-w-md text-xs">
                Choose a resume and a job description on the left, then press Compose draft. The
                letter is assembled from bullets already in your resume — this tool never writes a
                sentence you did not.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---- Right: preview ------------------------------------------------ */}
      <section
        aria-label="Letter preview"
        className="flex min-h-0 flex-col xl:w-[28rem] xl:shrink-0"
      >
        <div className="border-line flex items-center gap-2 border-b px-4 py-2">
          <span className="text-text text-sm font-medium">
            {preview.pageCount > 0
              ? `${preview.pageCount} page${preview.pageCount === 1 ? "" : "s"}`
              : "—"}
          </span>
          <span
            aria-live="polite"
            className={cn(
              "text-muted text-xs transition-opacity",
              preview.rendering ? "opacity-100" : "opacity-0",
            )}
          >
            Updating…
          </span>
        </div>

        <div className="bg-canvas min-h-0 flex-1 overflow-auto p-4">
          {preview.error ? (
            <p role="alert" className="text-danger text-sm">
              The preview could not be generated: {preview.error}
            </p>
          ) : preview.bytes ? (
            <PdfCanvas bytes={preview.bytes} scale={0.72} label="Cover letter" />
          ) : (
            <p className="text-muted py-12 text-center text-sm">
              {letter ? "Rendering your letter…" : "Compose a draft to see it here."}
            </p>
          )}
        </div>

        <div className="border-line flex flex-wrap gap-2 border-t px-4 py-3">
          <Button variant="primary" onClick={downloadPdf} disabled={!preview.bytes}>
            Download PDF
          </Button>
          <Button onClick={() => void downloadDocx()} disabled={!letter}>
            Download DOCX
          </Button>
          <Button onClick={downloadText} disabled={!letter}>
            Download TXT
          </Button>
        </div>
      </section>

      <Dialog
        open={pendingEnhancement !== null}
        onClose={() => setPendingEnhancement(null)}
        title="Enhance this paragraph locally"
        description="The free model downloads once and runs on your device. Your resume, job description, and letter are not sent to our server or an AI API."
        footer={
          <>
            <Button onClick={() => setPendingEnhancement(null)}>Not now</Button>
            <Button variant="primary" onClick={startPendingEnhancement}>
              Download and enhance
            </Button>
          </>
        }
      >
        <p className="text-muted text-sm leading-relaxed">
          You will see a suggestion before anything changes. You can keep the original or restore it
          later after saving.
        </p>
      </Dialog>
    </div>
  );
}

/**
 * The bullets on one entry, whatever kind of section it lives in.
 *
 * Module scope rather than inside the component: it is a pure read of a
 * document and has no business capturing anything.
 */
function bulletsForEntry(resume: ResumeDocument, entryId: string): string[] {
  for (const section of resume.sections) {
    if (section.type === "skills" || section.type === "summary") continue;
    const entry = section.entries.find((candidate) => candidate.id === entryId);
    if (!entry) continue;
    return "bullets" in entry ? entry.bullets.filter((bullet) => bullet.trim()) : [];
  }
  return [];
}

/* -------------------------------------------------------------------------- */
/* The enhancement diff                                                        */
/* -------------------------------------------------------------------------- */

/**
 * What the model proposes to change, word by word.
 *
 * ## Accessible, not merely colourful
 *
 * `<del>` and `<ins>` rather than styled `<span>`s. Screen readers announce
 * them as deletions and insertions, so the change is conveyed by the markup
 * and not only by a red or green background — which is the difference between
 * a review a blind user can do and one they cannot. The strikethrough and the
 * underline carry it for anyone who cannot distinguish the two colours.
 *
 * The full suggested text follows the diff, plainly. Reading a marked-up
 * paragraph tells you *what changed*; reading it clean tells you whether the
 * result is a sentence you would send, and both questions have to be
 * answerable before Apply is a responsible click.
 */
function EnhancementDiff({ original, suggested }: { original: string; suggested: string }) {
  const segments = useMemo(() => diffWords(original, suggested), [original, suggested]);
  const summary = useMemo(() => summarizeDiff(segments), [segments]);

  return (
    <div className="mt-2 flex flex-col gap-2 text-xs leading-relaxed">
      <p className="text-muted font-medium">{summary}</p>

      <p className="text-text whitespace-pre-wrap">
        {segments.map((segment, index) => {
          if (segment.kind === "same") return <span key={index}>{segment.text}</span>;
          if (segment.kind === "removed") {
            return (
              <del key={index} className="text-danger bg-danger-weak rounded-sm decoration-1">
                {segment.text}
              </del>
            );
          }
          return (
            <ins key={index} className="text-ok bg-ok-weak rounded-sm underline decoration-1">
              {segment.text}
            </ins>
          );
        })}
      </p>

      <details className="border-line rounded-md border p-2">
        <summary className="text-muted cursor-pointer font-medium select-none">
          The suggested paragraph on its own
        </summary>
        <p className="text-text mt-2 whitespace-pre-wrap">{suggested}</p>
      </details>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One paragraph                                                               */
/* -------------------------------------------------------------------------- */

const ROLE_LABELS: Record<CoverLetterParagraph["role"], string> = {
  opening: "Opening",
  evidence: "Evidence",
  alignment: "Alignment",
  closing: "Closing",
  custom: "Your own",
};

function ParagraphBlock({
  paragraph,
  sourceLabels,
  sourceQuotes,
  canRecompose,
  canEnhance,
  canMoveUp,
  canMoveDown,
  isEnhancing,
  enhanceProgress,
  proposal,
  onChange,
  onRecompose,
  onEnhance,
  onApplyEnhancement,
  onKeepOriginal,
  onRevertEnhancement,
  onCancelEnhancement,
  onMove,
  onRemove,
}: {
  paragraph: CoverLetterParagraph;
  sourceLabels: string[];
  sourceQuotes: { label: string; bullets: string[] }[];
  canRecompose: boolean;
  canEnhance: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isEnhancing: boolean;
  /** 0–1 while the one-time model download runs; null when indeterminate. */
  enhanceProgress: number | null;
  proposal: EnhancementProposal | null;
  onChange: (text: string) => void;
  onRecompose: () => void;
  onEnhance: () => void;
  onApplyEnhancement: () => void;
  onKeepOriginal: () => void;
  onRevertEnhancement: () => void;
  onCancelEnhancement: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sourcesId = `${paragraph.id}-sources`;

  return (
    <div className="border-line bg-surface-0 rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{ROLE_LABELS[paragraph.role]}</Badge>
        {/*
          The Sources chip is the composer's provenance made visible. An
          `evidence` paragraph with no sources would mean it invented
          something, so the absence of a chip is itself informative.

          A disclosure rather than a static badge since §10.2. It used to be
          a chip whose `title` was a list of UUIDs — provenance shown to a
          debugger rather than to the person deciding whether to trust the
          letter. `aria-expanded` on a button is the pattern `MatchReport`'s
          `ChecklistRow` already uses.
        */}
        {paragraph.sources.length > 0 ? (
          <button
            type="button"
            aria-expanded={sourcesOpen}
            aria-controls={sourcesId}
            onClick={() => setSourcesOpen((open) => !open)}
            className="border-accent/40 bg-accent-weak text-accent focus-visible:ring-accent rounded-full border px-2 py-0.5 text-xs font-medium transition hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
          >
            {/*
              Named when the ids resolve, counted when they do not. A letter
              can outlive the resume entry it quoted, and a stale label would
              be a false statement about where a sentence came from — in the
              one component whose whole job is to be truthful about that.
            */}
            {sourceLabels.length > 0
              ? `From ${sourceLabels.join(", ")}`
              : `${paragraph.sources.length} source${paragraph.sources.length === 1 ? "" : "s"} in your resume`}
          </button>
        ) : null}
        {paragraph.enhancement ? <Badge tone="warn">Enhanced locally</Badge> : null}
        <div className="ml-auto flex flex-wrap gap-1">
          {canEnhance ? (
            <Button size="sm" variant="ghost" onClick={onEnhance} disabled={isEnhancing}>
              {isEnhancing ? "Enhancing…" : "Enhance"}
            </Button>
          ) : null}
          {canRecompose ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<RedoIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={onRecompose}
              disabled={isEnhancing}
            >
              Recompose
            </Button>
          ) : null}
          {paragraph.enhancement ? (
            <Button size="sm" variant="ghost" onClick={onRevertEnhancement} disabled={isEnhancing}>
              Revert
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp || isEnhancing}
            aria-label={`Move the ${ROLE_LABELS[paragraph.role].toLowerCase()} paragraph up`}
          >
            Up
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMove(1)}
            disabled={!canMoveDown || isEnhancing}
            aria-label={`Move the ${ROLE_LABELS[paragraph.role].toLowerCase()} paragraph down`}
          >
            Down
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={isEnhancing}
            aria-label={`Remove the ${ROLE_LABELS[paragraph.role].toLowerCase()} paragraph`}
          >
            Remove
          </Button>
        </div>
      </div>

      {/*
        What the paragraph actually drew on, in the user's own words.
        Hidden with `hidden` rather than unmounted, so `aria-controls` always
        points at something that exists.
      */}
      <div id={sourcesId} hidden={!sourcesOpen} className="border-line mb-2 rounded-md border p-3">
        {sourceQuotes.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {sourceQuotes.map((source) => (
              <li key={source.label}>
                <p className="text-text text-xs font-medium">{source.label}</p>
                {source.bullets.length > 0 ? (
                  <ul className="text-muted mt-1 flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed">
                    {source.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mt-1 text-xs">
                    This entry has no bullets — the sentence came from its title.
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-xs">
            This paragraph was written from entries that are no longer in the resume it was composed
            against.
          </p>
        )}
      </div>

      {/*
        Said per paragraph, not only in the banner above the list.
        The sources chip stays exactly as it was — the resume entries this
        paragraph was assembled from are still the entries it was assembled
        from — but it can no longer be read as "these words are verbatim",
        so the qualification has to sit next to it rather than at the top of
        a list the reader may have scrolled past.
      */}
      {paragraph.enhancement ? (
        <p className="text-warn mb-2 text-xs">
          AI-assisted wording — review every claim before sending. Revert restores what the composer
          wrote.
        </p>
      ) : null}

      <Textarea
        aria-label={`${ROLE_LABELS[paragraph.role]} paragraph`}
        // Grows with its content rather than scrolling inside a fixed box:
        // a paragraph you cannot see all of is a paragraph you cannot edit.
        rows={Math.max(3, Math.ceil(paragraph.text.length / 90) + 1)}
        value={paragraph.text}
        onChange={(event) => onChange(event.target.value)}
        disabled={isEnhancing}
      />

      {isEnhancing ? (
        <div
          className="border-line bg-surface-1 mt-3 flex flex-wrap items-center gap-3 rounded-md border p-3"
          role="status"
          aria-live="polite"
        >
          <span className="text-muted text-xs">
            {enhanceProgress === null
              ? "Working locally on your device\u2026"
              : `Downloading the model once \u2014 ${Math.round(enhanceProgress * 100)}%`}
          </span>
          {enhanceProgress !== null ? (
            <span aria-hidden className="bg-surface-2 h-1 w-32 overflow-hidden rounded-full">
              <span
                className="bg-accent block h-full transition-[width] duration-300"
                style={{ width: `${Math.round(enhanceProgress * 100)}%` }}
              />
            </span>
          ) : null}
          {/*
            A run on the WASM path can take tens of seconds. Without this the
            only way out is to close the tab.
          */}
          <Button size="sm" variant="ghost" onClick={onCancelEnhancement}>
            Cancel
          </Button>
        </div>
      ) : null}

      {proposal ? (
        <div className="border-accent/30 bg-accent-weak mt-3 rounded-md border p-3" role="status">
          <p className="text-accent text-xs font-medium">Suggested local enhancement</p>

          {/*
            A word-level diff, not two paragraphs side by side (the plan's
            step 5). For a rewrite that changes six words in a hundred, "spot
            the difference" is not a review — and skimming is the one thing a
            user must not do with a model's suggestion.
          */}
          <EnhancementDiff original={proposal.originalText} suggested={proposal.text} />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={onApplyEnhancement}>
              Apply enhancement
            </Button>
            <Button size="sm" onClick={onKeepOriginal}>
              Keep original
            </Button>
            {/*
              Deterministic decoding means this is an honest retry of a
              failure, not a reroll for a luckier answer — it is worth having
              because the *inputs* can change: edit the paragraph, change the
              tone, and the next attempt is a different question.
            */}
            <Button size="sm" onClick={onEnhance} disabled={isEnhancing}>
              Try again
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
