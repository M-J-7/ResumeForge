"use client";

/**
 * Running the match, on demand (P27-H2).
 *
 * **Nothing here is reactive to typing.** D12 is explicit that a live score
 * is the wrong product: a number that updates as you type gets optimised
 * instead of the resume, and every rule in `lib/match/score.ts` exists to
 * make that unprofitable. So this exposes an imperative `analyse()` that the
 * user presses a button to reach, and a result that stays put until they
 * press it again.
 *
 * The skill vocabulary is ~1.2 MB and loads lazily (`loadSkillIndex`), so
 * the first analysis in a session pays for it and later ones do not. That is
 * also why the button reports "Analysing…" rather than pretending to be
 * instant — on a throttled connection the download is the slow part.
 */

import { useCallback, useRef, useState } from "react";
import { parseJobDescription, type ParsedJd } from "@/lib/jd/parse";
import { scoreResume, type MatchResult } from "@/lib/match/score";
import { loadSkillIndex } from "@/lib/skills";
import type { ResumeDocument } from "@/lib/resume/schema";

export interface MatchAnalysis {
  result: MatchResult;
  jd: ParsedJd;
  /** The posting this was run against, so the view cannot misreport its source. */
  description: string;
}

export type AnalysisState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; analysis: MatchAnalysis }
  | { status: "error"; message: string };

export interface MatchAnalysisController {
  state: AnalysisState;
  analyse(resume: ResumeDocument, description: string): Promise<void>;
  reset(): void;
}

export function useMatchAnalysis(): MatchAnalysisController {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });

  /**
   * Guards against an earlier run landing after a later one.
   *
   * The vocabulary load is the slow step and it is cached, so a second
   * analysis usually finishes far sooner than the first. Without this, the
   * first run's result would arrive last and overwrite it.
   */
  const runId = useRef(0);

  const analyse = useCallback(async (resume: ResumeDocument, description: string) => {
    const id = ++runId.current;
    setState({ status: "running" });

    try {
      const skills = await loadSkillIndex();
      const jd = parseJobDescription(description);
      const result = scoreResume(resume, jd, { skills });
      if (id !== runId.current) return;
      setState({ status: "done", analysis: { result, jd, description } });
    } catch (error) {
      if (id !== runId.current) return;
      setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, analyse, reset };
}
