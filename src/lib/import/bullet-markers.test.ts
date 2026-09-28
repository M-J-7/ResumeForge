/**
 * List markers, and the first bullet of every role (2026-09-28).
 *
 * An unmarked line under a role is read as the role's meta line — employer,
 * location — so a marker the importer did not recognise cost each role its
 * first bullet, with no warning anywhere. The keyword scanner found it:
 * "Python — missing" for a resume whose first bullet was about Python.
 *
 * These are new cases on the same code path the fixtures take; the existing
 * round-trip tests in `parse-resume.test.ts` are what show the wider marker
 * set changed nothing for the documents this app writes.
 */

import { describe, expect, it } from "vitest";
import { parseResumeLines, parseResumeText } from "./parse-resume";

function bulletsOf(result: ReturnType<typeof parseResumeLines>): string[] {
  const experience = result.document.sections.find((section) => section.type === "experience");
  if (!experience || experience.type !== "experience") return [];
  return experience.entries.flatMap((entry) => entry.bullets);
}

function roleWith(marker: string): string[] {
  return [
    "Asha Varma",
    "asha@example.com",
    "EXPERIENCE",
    "Backend Engineer | Brightfold | Jan 2022 – Present",
    `${marker} Rewrote the Python billing pipeline`,
    `${marker} Migrated invoices to PostgreSQL`,
  ];
}

describe("list markers in extracted lines", () => {
  it.each(["•", "●", "○", "■", "►", "✓", "-", "*"])(
    "keeps both bullets, and the first, when they are marked with %s",
    (marker) => {
      expect(bulletsOf(parseResumeLines(roleWith(marker)))).toEqual([
        "Rewrote the Python billing pipeline",
        "Migrated invoices to PostgreSQL",
      ]);
    },
  );

  it("does not read a wrapped date's continuation as a bullet", () => {
    // Why en and em dashes are not markers in extracted text.
    const result = parseResumeLines([
      "Asha Varma",
      "EXPERIENCE",
      "Backend Engineer | Brightfold | Jan 2022",
      "– Present",
      "• Rewrote the Python billing pipeline",
    ]);
    expect(bulletsOf(result)).not.toContain("Present");
  });
});

describe("parseResumeText", () => {
  it.each(["–", "—", "1.", "2)"])("accepts %s as a typed list marker", (marker) => {
    expect(bulletsOf(parseResumeText(roleWith(marker).join("\n")))).toEqual([
      "Rewrote the Python billing pipeline",
      "Migrated invoices to PostgreSQL",
    ]);
  });

  it("reads Windows line endings", () => {
    expect(bulletsOf(parseResumeText(roleWith("-").join("\r\n")))).toHaveLength(2);
  });
});
