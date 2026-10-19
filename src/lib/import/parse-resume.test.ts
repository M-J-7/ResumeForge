/**
 * P31-A2 acceptance.
 *
 * The bar the plan sets: every one of the seven fixtures round-trips through
 * PDF *and* DOCX import with the contact fields and every role's title,
 * organisation and dates recovered. The same inversion the X-Ray suite uses
 * applies — we generated these documents, so anything that fails to come
 * back is a defect here rather than a limitation of the format.
 *
 * Recovery is asserted by containment rather than equality, the same
 * comparison `scoreRecovery` makes and for the same reason: a parser that
 * recovered a field plus the text right of it on the same visual line has
 * still recovered the field, and a real ATS reading that line would agree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseResumeFile,
  parseResumeLines,
  importKindFromFilename,
  type ImportResult,
} from "./parse-resume";
import {
  headingKindOf,
  headingStrength,
  classifyHeading,
  docxHeadingLevel,
  isWholeHeading,
} from "./headings";
import { findDateRange, parsePartialDate } from "./dates";
import { renderPdf } from "@/lib/emit/pdf/render";
import { renderDocx } from "@/lib/emit/docx/render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { resumeDocumentSchema, type ResumeDocument } from "@/lib/resume/schema";
import { ALL_FIXTURES, midCareerResume, fresherResume } from "@/test/fixtures/resumes";

async function importedFromPdf(document: ResumeDocument): Promise<ImportResult> {
  const { bytes } = await renderPdf(document, { resolveFont: nodeFontResolver });
  return parseResumeFile(bytes, "pdf");
}

async function importedFromDocx(document: ResumeDocument): Promise<ImportResult> {
  const { bytes } = await renderDocx(document);
  return parseResumeFile(bytes, "docx");
}

/** The comparison `scoreRecovery` makes: recovered, possibly with neighbours. */
function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^a-z0-9@.+\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function recovers(actual: string, expected: string): boolean {
  if (expected.trim().length === 0) return true;
  return normalized(actual).includes(normalized(expected));
}

function rolesOf(document: ResumeDocument) {
  const section = document.sections.find((s) => s.type === "experience");
  return section?.type === "experience" ? section.entries : [];
}

/* -------------------------------------------------------------------------- */

describe("heading detection", () => {
  it("takes an all-caps or colon-terminated line as a heading", () => {
    expect(headingStrength("EXPERIENCE")).toBe("strong");
    expect(headingStrength("Skills:")).toBe("strong");
  });

  it("treats a short unrecognised mixed-case line as no heading at all", () => {
    // "Author" and "Team Lead" are project roles set on their own line. They
    // pass every shape test there is, which is exactly why strength exists.
    expect(headingStrength("Author")).toBe("weak");
    expect(headingKindOf("Author")).toBeNull();
    expect(headingKindOf("Team Lead")).toBeNull();
  });

  it("still recognises the ordinary mixed-case headings resumes use", () => {
    expect(headingKindOf("Work Experience")).toBe("experience");
    expect(headingKindOf("Technical Skills")).toBe("skills");
  });

  it("tests the specific pattern before the general one", () => {
    // Each left-hand heading contains the right-hand one as a substring, so
    // the wrong order makes the specific classification unreachable.
    expect(classifyHeading("Volunteer Experience")).toBe("custom");
    expect(classifyHeading("Experience")).toBe("experience");
    expect(classifyHeading("Courses & Certifications")).toBe("certifications");
    expect(classifyHeading("Academic Projects")).toBe("projects");
  });

  it("never reads a dated line as a section heading", () => {
    expect(headingStrength("Senior Backend Engineer Mar 2022 – Present")).toBeNull();
    expect(headingStrength("2019 – 2022")).toBeNull();
  });

  it("reads a DOCX heading level from every spelling Word produces", () => {
    expect(docxHeadingLevel("Heading1")).toBe(1);
    expect(docxHeadingLevel("heading 2")).toBe(2);
    expect(docxHeadingLevel("SectionHeading")).toBe(1);
    expect(docxHeadingLevel("Normal")).toBeNull();
    expect(docxHeadingLevel("ResumeBullet")).toBeNull();
  });
});

describe("date reading", () => {
  it("reads the forms resumes actually write", () => {
    expect(findDateRange("Mar 2022 – Present")?.range).toEqual({
      start: { year: 2022, month: 3 },
      end: null,
      current: true,
    });
    expect(findDateRange("January 2019 to March 2022")?.range).toEqual({
      start: { year: 2019, month: 1 },
      end: { year: 2022, month: 3 },
      current: false,
    });
    expect(findDateRange("2019 - 2022")?.range).toEqual({
      start: { year: 2019, month: null },
      end: { year: 2022, month: null },
      current: false,
    });
    expect(findDateRange("06/2019 – 02/2022")?.range).toEqual({
      start: { year: 2019, month: 6 },
      end: { year: 2022, month: 2 },
      current: false,
    });
  });

  it("reads a two-digit year after an apostrophe, the way Indian resumes abbreviate", () => {
    expect(parsePartialDate("Mar’25")?.date).toEqual({ year: 2025, month: 3 });
    expect(parsePartialDate("July'23")?.date).toEqual({ year: 2023, month: 7 });
    expect(parsePartialDate("Oct ’99")?.date).toEqual({ year: 1999, month: 10 });
    expect(findDateRange("Backend Developer Mar’25 - May’25")?.range).toEqual({
      start: { year: 2025, month: 3 },
      end: { year: 2025, month: 5 },
      current: false,
    });
    expect(findDateRange("Systems Engineer Aug'23 - Present")?.range).toEqual({
      start: { year: 2023, month: 8 },
      end: null,
      current: true,
    });
  });

  it("reads a month joined to its year by punctuation", () => {
    expect(parsePartialDate("Mar-2022")?.date).toEqual({ year: 2022, month: 3 });
    expect(parsePartialDate("Sep, 2021")?.date).toEqual({ year: 2021, month: 9 });
    expect(parsePartialDate("Jan'2024")?.date).toEqual({ year: 2024, month: 1 });
  });

  it("refuses to guess between dd/mm and mm/dd, and says the month is uncertain", () => {
    // 03/04/2023 is March in one hemisphere and April in the other, and
    // nothing in a resume disambiguates it. Keeping the year and reporting
    // the loss beats moving somebody's start date by a month in silence.
    const parsed = parsePartialDate("03/04/2023");
    expect(parsed).toEqual({ date: { year: 2023, month: null }, monthCertain: false });

    const range = findDateRange("03/04/2023 – 05/06/2024");
    expect(range?.certain).toBe(false);
    expect(range?.range.start.month).toBeNull();
  });

  it("orders a backwards range rather than emitting one the schema rejects", () => {
    const range = findDateRange("Mar 2024 – Jan 2022");
    expect(range?.range.start).toEqual({ year: 2022, month: 1 });
    expect(range?.certain).toBe(false);
  });

  it("finds a range that sits at the end of a longer line", () => {
    const found = findDateRange("Senior Backend Engineer Mar 2022 – Present");
    expect(found?.index).toBe("Senior Backend Engineer ".length);
  });

  it("does not let the word before a year stand in for a month name", () => {
    // Caught by `e2e/import.spec.ts`, not by anything here, and it is the
    // worst failure this module has: the token pattern matched "Associate
    // 2026", `parsePartialDate` rejected the pair, and the line came back
    // *undated* — so the role lost its dates, its title and its employer at
    // once and the section fell apart into one entry per line.
    const found = findDateRange("Research Associate 2026 – Present");
    // The bare year, and only the bare year — so the title in front of it
    // survives the slice that removes the date from the line.
    expect(found?.index).toBe("Research Associate ".length);
    expect(found?.range).toEqual({
      start: { year: 2026, month: null },
      end: null,
      current: true,
    });
  });

  it("does not read a word that merely starts like a month as one", () => {
    // "Marketing" begins with "mar" and "Senior" with "sen"; a month
    // alternation without a word boundary matches both.
    expect(findDateRange("Marketing Lead 2019 – 2021")?.index).toBe("Marketing Lead ".length);
    expect(parsePartialDate("Marketing 2019")).toBeNull();
    expect(parsePartialDate("Mar 2019")).toEqual({
      date: { year: 2019, month: 3 },
      monthCertain: true,
    });
  });

  it("keeps scanning past a token it could not parse", () => {
    // "13/2022" matches the numeric shape and is not a real month, so the
    // scan must not consume the year inside it and give up.
    const found = findDateRange("13/2022 2019 – 2021");
    expect(found?.range.start).toEqual({ year: 2019, month: null });
  });
});

describe("round-tripping our own output — PDF", () => {
  it.each(ALL_FIXTURES)("$name recovers contact and every role", async ({ document }) => {
    const result = await importedFromPdf(document);

    expect(resumeDocumentSchema.safeParse(result.document).success).toBe(true);
    expect(recovers(result.document.contact.fullName, document.contact.fullName)).toBe(true);
    expect(result.document.contact.email).toBe(document.contact.email);
    expect(recovers(result.document.contact.phone, document.contact.phone)).toBe(true);

    const expected = rolesOf(document);
    const actual = rolesOf(result.document);
    expect(actual).toHaveLength(expected.length);

    expected.forEach((role, i) => {
      const got = actual[i]!;
      expect(recovers(got.title, role.title), `role ${i} title: got "${got.title}"`).toBe(true);
      expect(
        recovers(got.organization, role.organization),
        `role ${i} organisation: got "${got.organization}"`,
      ).toBe(true);
      expect(got.dates.start.year, `role ${i} start year`).toBe(role.dates.start.year);
      expect(got.dates.start.month, `role ${i} start month`).toBe(role.dates.start.month);
      expect(got.dates.current, `role ${i} current`).toBe(role.dates.current);
      if (!role.dates.current) expect(got.dates.end).toEqual(role.dates.end);
    });
  });
});

describe("round-tripping our own output — DOCX", () => {
  it.each(ALL_FIXTURES)("$name recovers contact and every role", async ({ document }) => {
    const result = await importedFromDocx(document);

    expect(resumeDocumentSchema.safeParse(result.document).success).toBe(true);
    expect(recovers(result.document.contact.fullName, document.contact.fullName)).toBe(true);
    expect(result.document.contact.email).toBe(document.contact.email);
    expect(recovers(result.document.contact.phone, document.contact.phone)).toBe(true);

    const expected = rolesOf(document);
    const actual = rolesOf(result.document);
    expect(actual).toHaveLength(expected.length);

    expected.forEach((role, i) => {
      const got = actual[i]!;
      expect(recovers(got.title, role.title), `role ${i} title: got "${got.title}"`).toBe(true);
      expect(
        recovers(got.organization, role.organization),
        `role ${i} organisation: got "${got.organization}"`,
      ).toBe(true);
      expect(got.dates.start.year, `role ${i} start year`).toBe(role.dates.start.year);
      expect(got.dates.start.month, `role ${i} start month`).toBe(role.dates.start.month);
      expect(got.dates.current, `role ${i} current`).toBe(role.dates.current);
    });
  });
});

/**
 * The `.doc` Word itself saved from each fixture's DOCX — see
 * `legacy-word.test.ts` for where the files come from. The bar is the one the
 * PDF and the DOCX meet.
 */
describe("round-tripping our own output — DOC, as Word saves it", () => {
  it.each(ALL_FIXTURES)("$name recovers contact and every role", async ({ name, document }) => {
    const bytes = new Uint8Array(
      readFileSync(path.join(process.cwd(), "src", "test", "fixtures", "word", `${name}.doc`)),
    );
    const result = await parseResumeFile(bytes, "doc");

    expect(result.strategy).toBe("doc");
    expect(resumeDocumentSchema.safeParse(result.document).success).toBe(true);
    expect(recovers(result.document.contact.fullName, document.contact.fullName)).toBe(true);
    expect(result.document.contact.email).toBe(document.contact.email);
    expect(recovers(result.document.contact.phone, document.contact.phone)).toBe(true);

    const expected = rolesOf(document);
    const actual = rolesOf(result.document);
    expect(actual).toHaveLength(expected.length);
    expected.forEach((role, i) => {
      const got = actual[i]!;
      expect(recovers(got.title, role.title), `role ${i} title: got "${got.title}"`).toBe(true);
      expect(
        recovers(got.organization, role.organization),
        `role ${i} organisation: got "${got.organization}"`,
      ).toBe(true);
      expect(got.dates).toEqual(role.dates);
      expect(got.bullets).toEqual(role.bullets);
    });
  });
});

describe("the rest of the document", () => {
  it("recovers the summary, skills, education and projects from a DOCX", async () => {
    const result = await importedFromDocx(midCareerResume);
    const doc = result.document;

    const summary = doc.sections.find((s) => s.type === "summary");
    expect(summary?.type === "summary" && summary.content).toContain("Backend engineer");

    const skills = doc.sections.find((s) => s.type === "skills");
    expect(skills?.type === "skills" ? skills.groups[0]?.label : null).toBe(
      "Languages & Frameworks",
    );
    expect(skills?.type === "skills" ? skills.groups[0]?.skills : []).toContain("TypeScript");

    const education = doc.sections.find((s) => s.type === "education");
    const degree = education?.type === "education" ? education.entries[0] : undefined;
    expect(degree?.institution).toContain("Universitat Politècnica de Catalunya");
    expect(degree?.credential).toBe("BSc");
    expect(degree?.field).toBe("Computer Science");

    const projects = doc.sections.find((s) => s.type === "projects");
    const project = projects?.type === "projects" ? projects.entries[0] : undefined;
    expect(project?.name).toBe("ledger-diff");
    expect(project?.url).toBe("https://github.com/josemunoz/ledger-diff");
  });

  it("reads education the same way out of a PDF, where the two lines are the other way round", async () => {
    // The PDF sets the institution first and the DOCX sets the credential
    // first. Classifying by content rather than by position is what makes
    // one parser handle both — and what makes it handle a third layout.
    const result = await importedFromPdf(midCareerResume);
    const education = result.document.sections.find((s) => s.type === "education");
    const degree = education?.type === "education" ? education.entries[0] : undefined;
    expect(degree?.institution).toContain("Universitat Politècnica de Catalunya");
    expect(degree?.credential).toBe("BSc");
  });

  it("keeps a section it has no type for rather than dropping its content", async () => {
    const result = await importedFromDocx(midCareerResume);
    const custom = result.document.sections.filter((s) => s.type === "custom");
    expect(custom.map((s) => s.type === "custom" && s.label)).toContain("Languages");
  });

  it("keeps a project role off the section list", async () => {
    // "Team Lead" and "Author" sit on their own line under a project name.
    // A shape-only heading test reads both as headings and splits the
    // Projects section in half.
    const result = await importedFromPdf(fresherResume);
    const projects = result.document.sections.find((s) => s.type === "projects");
    const entries = projects?.type === "projects" ? projects.entries : [];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe("Campus Placement Portal");
    expect(entries[0]?.bullets.join(" ")).toContain("900 students");
  });
});

describe("the confidence report", () => {
  it("reports every contact field and every role", async () => {
    const result = await importedFromDocx(midCareerResume);
    const names = result.fields.map((f) => f.field);
    expect(names).toEqual(
      expect.arrayContaining([
        "Name",
        "Email",
        "Phone",
        "Location",
        "Role 1 — title",
        "Role 1 — organisation",
        "Role 1 — dates",
        "Role 2 — title",
      ]),
    );
  });

  it("points every field at the builder step that fixes it", async () => {
    const result = await importedFromDocx(midCareerResume);
    for (const field of result.fields) {
      expect(["contact", "experience"]).toContain(field.stepId);
      expect(field.note.length).toBeGreaterThan(0);
    }
  });

  it("warns that a PDF's link addresses are not in its text layer", async () => {
    // A PDF stores a link target in an annotation; only the anchor text
    // survives extraction. Saying so beats silently losing the URL.
    const result = await importedFromPdf(midCareerResume);
    expect(result.document.contact.links).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/addresses behind them/i);
  });

  it("recovers link addresses from a DOCX, where they are real text", async () => {
    const result = await importedFromDocx(midCareerResume);
    expect(result.document.contact.links.map((l) => l.url)).toContain(
      "https://linkedin.com/in/josemunoz",
    );
    expect(result.document.contact.links.map((l) => l.label)).toContain("LinkedIn");
  });
});

describe("the layout most Indian resumes use", () => {
  /**
   * The shape of the real resume that found the iPhone failure on
   * 2026-10-19, with every word of it replaced: "Company | Role  Mon'YY –
   * Mon'YY", "●" bullets that wrap onto an unmarked second line, the degree
   * and grade on a bullet under the school, undated projects, and an
   * "Academic and … Achievements" heading. Before that day it came back with
   * every role undated, every bullet a role of its own, and the education
   * section lost.
   */
  const lines = [
    "ARJUN MEHTA",
    "arjun.mehta@example.com | +91-98100 12345 | www.linkedin.com/in/arjunmehta",
    "Education",
    "Delhi Technological University, India 2019 - 2023",
    "● B.Tech, CSE | CGPA: 8.4",
    "Kendriya Vidyalaya School, India 2018 - 2019",
    "● CBSE (Class XII), Aggregate: 91%",
    "Skills",
    "Java | Spring Boot | MySQL | Docker",
    "Work Experience",
    "Infosys Ltd. | Systems Engineer Aug’23 - Present",
    "● Built 6 REST services for the claims platform, cutting average response time",
    "from 900ms to 300ms.",
    "● Migrated nightly batch jobs to Spring Batch.",
    "Zeta Labs Pvt. Ltd. | Backend Intern Jan’23 - Jun’23",
    "● Wrote integration tests for the payments API.",
    "Projects",
    "Expense Splitter",
    "A web app that splits shared expenses between friends.",
    "● Used by 300 students in its first month.",
    "● Built with React and Node.js.",
    "Academic and Extracurricular Achievements",
    "● Won second place in the college hackathon among 80 teams.",
  ];
  const result = parseResumeLines(lines);
  const section = <T extends ResumeDocument["sections"][number]["type"]>(type: T) =>
    result.document.sections.find((s) => s.type === type) as Extract<
      ResumeDocument["sections"][number],
      { type: T }
    >;

  it("reads each role's title, employer and dates, whichever order they are in", () => {
    expect(section("experience").entries.map((e) => [e.title, e.organization, e.dates])).toEqual([
      [
        "Systems Engineer",
        "Infosys Ltd.",
        { start: { year: 2023, month: 8 }, end: null, current: true },
      ],
      [
        "Backend Intern",
        "Zeta Labs Pvt. Ltd.",
        { start: { year: 2023, month: 1 }, end: { year: 2023, month: 6 }, current: false },
      ],
    ]);
  });

  it("joins a bullet that wrapped back onto the bullet", () => {
    expect(section("experience").entries[0]?.bullets).toEqual([
      "Built 6 REST services for the claims platform, cutting average response time from 900ms to 300ms.",
      "Migrated nightly batch jobs to Spring Batch.",
    ]);
  });

  it("keeps the education section, with the degree and grade from the bullet under each school", () => {
    expect(
      section("education").entries.map((e) => [e.institution, e.credential, e.field, e.result]),
    ).toEqual([
      ["Delhi Technological University, India", "B.Tech", "CSE", "CGPA: 8.4"],
      ["Kendriya Vidyalaya School, India", "CBSE (Class XII)", "", "91%"],
    ]);
  });

  it("keeps an undated project's description and bullets together", () => {
    expect(section("projects").entries.map((p) => [p.name, p.bullets])).toEqual([
      [
        "Expense Splitter",
        [
          "A web app that splits shared expenses between friends.",
          "Used by 300 students in its first month.",
          "Built with React and Node.js.",
        ],
      ],
    ]);
  });

  it("does not file achievements under education", () => {
    expect(classifyHeading("Academic and Extracurricular Achievements")).toBe("custom");
    const custom = result.document.sections.filter((s) => s.type === "custom");
    expect(custom.map((s) => s.type === "custom" && s.label)).toEqual([
      "Academic and Extracurricular Achievements",
    ]);
  });
});

describe("headings above a dated line", () => {
  it("takes a whole section name as a heading, and a job title that starts like one as an entry", () => {
    expect(isWholeHeading("Work Experience")).toBe(true);
    expect(isWholeHeading("Education")).toBe(true);
    expect(isWholeHeading("Projects Lead")).toBe(false);

    const result = parseResumeLines([
      "Sam Lee",
      "sam@example.com",
      "Projects",
      "Projects Lead, Acme Corp Jan 2020 – Present",
      "• Ran the migration.",
    ]);
    const projects = result.document.sections.find((s) => s.type === "projects");
    expect(projects?.type === "projects" && projects.entries[0]?.name).toMatch(/^Projects Lead/);
  });
});

describe("a role written “Title, Company” with its description under it", () => {
  it("splits at the comma rather than taking the description as the employer", () => {
    const result = parseResumeLines([
      "Jane Doe",
      "jane@example.com",
      "EXPERIENCE",
      "Data Analyst, Globex Analytics Jan 2022 – Present",
      "Built weekly dashboards for 40 regional managers.",
    ]);
    const experience = result.document.sections.find((s) => s.type === "experience");
    const [role] = experience?.type === "experience" ? experience.entries : [];
    expect([role?.title, role?.organization, role?.location]).toEqual([
      "Data Analyst",
      "Globex Analytics",
      "",
    ]);
    expect(role?.bullets).toEqual(["Built weekly dashboards for 40 regional managers."]);
  });
});

describe("a layout neither emitter produces", () => {
  /**
   * Hand-built, and deliberately awkward in every way a real third-party
   * resume is: the date on its own line under the title, an employer line
   * with an unusual separator, a numeric date whose month is ambiguous, and
   * a section heading we have no type for.
   *
   * This cannot be a committed third-party file — republishing someone
   * else's resume is the same copyright problem `QA.md` already refuses for
   * job postings. A structural fixture is the honest substitute.
   */
  const foreignLayout = [
    "PRIYA RAGHUNATHAN",
    "priya.raghunathan@example.com",
    "+91 80 4567 8901",
    "Bengaluru, Karnataka",
    "",
    "CAREER HISTORY",
    "Lead Data Engineer",
    "Zenith Analytics Pvt Ltd",
    "03/04/2021 — 05/06/2024",
    "• Rebuilt the ingestion tier, cutting nightly batch time from 6h to 40m.",
    "Data Engineer",
    "Northwind Systems",
    "2018 - 2021",
    "• Owned the customer event pipeline across 40 million daily events.",
    "",
    "PROFESSIONAL DEVELOPMENT",
    "Kaggle Grandmaster",
  ].join("\n");

  it("parses without throwing and reports low confidence rather than wrong data", () => {
    const result = parseResumeLines(foreignLayout.split("\n"));

    expect(result.document.contact.fullName).toBe("PRIYA RAGHUNATHAN");
    expect(result.document.contact.email).toBe("priya.raghunathan@example.com");
    expect(result.document.contact.location).toBe("Bengaluru, Karnataka");

    const roles = rolesOf(result.document);
    expect(roles).toHaveLength(2);
    expect(roles[0]?.title).toBe("Lead Data Engineer");
    expect(roles[0]?.organization).toBe("Zenith Analytics Pvt Ltd");
    expect(roles[1]?.title).toBe("Data Engineer");

    // The ambiguous numeric date keeps the year, drops the month, and says so.
    expect(roles[0]?.dates.start).toEqual({ year: 2021, month: null });
    const datesField = result.fields.find((f) => f.field === "Role 1 — dates");
    expect(datesField?.confidence).toBe("low");
    expect(datesField?.note).toMatch(/ambiguous/i);

    // A section we have no type for is kept, not dropped.
    const custom = result.document.sections.filter((s) => s.type === "custom");
    expect(custom.map((s) => (s.type === "custom" ? s.label : ""))).toContain(
      "PROFESSIONAL DEVELOPMENT",
    );
  });

  it("never invents a field it could not read", () => {
    const result = parseResumeLines(["Someone Anonymous", "SKILLS", "Python, SQL"]);
    expect(result.document.contact.email).toBe("");
    expect(result.document.contact.phone).toBe("");
    expect(rolesOf(result.document)).toHaveLength(0);
    expect(result.fields.find((f) => f.field === "Email")?.confidence).toBe("low");
  });
});

describe("file kinds", () => {
  it("recognises the formats it can read by name", () => {
    expect(importKindFromFilename("resume.pdf")).toBe("pdf");
    expect(importKindFromFilename("Resume.DOCX")).toBe("docx");
    expect(importKindFromFilename("resume.doc")).toBe("doc");
    expect(importKindFromFilename("resume.rtf")).toBe("doc");
    expect(importKindFromFilename("resume.txt")).toBeNull();
  });
});
