/**
 * Layouts found in twenty real resumes on 2026-09-30 (QA.md §7).
 *
 * University career centres publish sample resumes made in Word, and put
 * through `/check`'s parser they failed in ways our own emitters never
 * exercise: the phone came back missing on every one, Word's bullets read as
 * paragraphs, "Clinical Experience" became a custom section, degrees under
 * "University of …" lost their school. The samples themselves are not here —
 * `QA.md` refuses to commit other people's resumes — so each shape is
 * restated as a structural fixture with content written for this file. It is
 * the code path a real file takes, minus the extraction.
 */

import { describe, expect, it } from "vitest";
import { findDateRange, findEntryDate } from "./dates";
import { classifyHeading } from "./headings";
import { parseResumeLines } from "./parse-resume";
import { recoverPhone } from "@/lib/xray/scorecard";
import type { ResumeDocument } from "@/lib/resume/schema";

function parse(lines: string[]): ResumeDocument {
  return parseResumeLines(lines).document;
}

function section<T extends ResumeDocument["sections"][number]["type"]>(
  document: ResumeDocument,
  type: T,
) {
  return document.sections.find((s) => s.type === type) as Extract<
    ResumeDocument["sections"][number],
    { type: T }
  >;
}

describe("phone numbers written the way people write their own", () => {
  it("recovers a national number with no country code, in each common form", () => {
    for (const phone of ["(215) 567-8910", "973.761.9355", "973-761-9355", "98765 43210"]) {
      expect(recoverPhone(`Sam Doe\nsam@example.com | ${phone}`), phone).toBe(phone);
    }
    expect(recoverPhone("+91 98765 43210")).toBe("+91 98765 43210");
  });

  it("does not read a year range or a short number as a phone", () => {
    expect(recoverPhone("Coordinator 2019 - 2021")).toBeNull();
    expect(recoverPhone("Managed 40 staff across 3 sites")).toBeNull();
  });

  it("keeps the opening bracket of an area code", () => {
    const document = parse([
      "Sam Doe",
      "Boston, MA ● sam@example.com ● (617) 555-0142",
      "EXPERIENCE",
    ]);
    expect(document.contact.phone).toBe("(617) 555-0142");
  });
});

describe("bullets as Word draws them", () => {
  it("reads Symbol and Wingdings bullets, whatever they extract as", () => {
    const document = parse([
      "Sam Doe",
      "sam@example.com",
      "EXPERIENCE",
      "Northfield Clinic, Portland, OR",
      "Medical Assistant May 2022 – Present",
      "\u0087 Roomed 30 patients a day",
      // The next line opens with U+F0B7, Word's Symbol-font bullet, which renders as nothing.
      " Took vitals and histories",
      "x Scheduled follow-up visits",
      "o Trained two new assistants",
    ]);
    const role = section(document, "experience").entries[0]!;
    expect(role.bullets).toEqual([
      "Roomed 30 patients a day",
      "Took vitals and histories",
      "Scheduled follow-up visits",
      "Trained two new assistants",
    ]);
  });

  it("drops rules typed as underscores, and keeps the heading they sat beside", () => {
    const document = parse([
      "Sam Doe",
      "sam@example.com",
      "Objective ______________________________",
      "_______________________________________",
      "A front-desk role in a family practice.",
    ]);
    expect(section(document, "summary").content).toBe("A front-desk role in a family practice.");
  });
});

describe("section headings real resumes use", () => {
  it("files every kind of work history as experience", () => {
    for (const heading of [
      "Clinical and Related Experience",
      "HEALTHCARE AND RELATED EXPERIENCE",
      "Teaching Experience",
      "Additional Work Experience",
      "Employment",
    ]) {
      expect(classifyHeading(heading), heading).toBe("experience");
    }
  });

  it("keeps leadership, research and volunteering apart, as their own sections", () => {
    for (const heading of [
      "Leadership Experience",
      "Leadership and Activities",
      "Research Experience",
      "Volunteer Experience",
    ]) {
      expect(classifyHeading(heading), heading).toBe("custom");
    }
  });

  it("reads '<kind> Skills' as skills and 'Highlights of Qualifications' as the summary", () => {
    expect(classifyHeading("Computer Skills")).toBe("skills");
    expect(classifyHeading("Laboratory Skills")).toBe("skills");
    expect(classifyHeading("Highlights of Qualifications")).toBe("summary");
  });
});

describe("entries that carry one date, or a season", () => {
  it("starts an entry at a single date, a season, or two months sharing a year", () => {
    expect(findEntryDate("Camp Counselor, Pine Lake Camp June – August 2023")?.range).toEqual({
      start: { year: 2023, month: 6 },
      end: { year: 2023, month: 8 },
      current: false,
    });
    expect(findEntryDate("Student Nurse, Pediatrics Spring 2024")?.range.start).toEqual({
      year: 2024,
      month: null,
    });
    expect(findEntryDate("Bachelor of Science in Finance, May 2023")?.range.start).toEqual({
      year: 2023,
      month: 5,
    });
  });

  it("does not start one at a wrapped sentence, a labelled detail, or a year mid-line", () => {
    expect(findEntryDate("Association of Pennsylvania Convention in November 2023.")).toBeNull();
    expect(findEntryDate("Honors: Dean's List Scholarship Recipient 2023")).toBeNull();
    expect(findEntryDate("Presented at the 2023 regional meeting and ran the session")).toBeNull();
  });

  it("leaves findDateRange as it was: a lone date is not a range", () => {
    expect(findDateRange("Bachelor of Science in Finance, May 2023")).toBeNull();
  });

  it("groups a paragraph-style role — organisation, title, description — around its date", () => {
    const document = parse([
      "Sam Doe",
      "sam@example.com",
      "WORK EXPERIENCE",
      "RIVERSIDE CHILDREN'S HOSPITAL, Columbus, OH May 2023 – Present",
      "Patient Care Technician",
      "Take vital signs and record intake and output.",
      "Assist with transfers and patient hygiene.",
      "LAKESIDE DAY CAMP, Columbus, OH June – August 2022",
      "Camp Counselor",
      "Supervised groups of twelve children.",
    ]);
    const roles = section(document, "experience").entries;
    expect(roles).toHaveLength(2);
    expect(roles[0]!.organization).toContain("RIVERSIDE CHILDREN'S HOSPITAL");
    expect(roles[1]!.dates).toEqual({
      start: { year: 2022, month: 6 },
      end: { year: 2022, month: 8 },
      current: false,
    });
  });
});

describe("education as career-centre templates set it", () => {
  it("keeps the school above a dated degree, and the grade beside the date", () => {
    const [first, second] = section(
      parse([
        "Sam Doe",
        "sam@example.com",
        "EDUCATION",
        "Northgate University, Columbus, OH",
        "Master of Science in Nursing, expected December 2025 Cumulative G.P.A.: 3.81/4.00",
        "Honors: Nursing Leadership Scholarship Recipient 2024",
        "Lakeview College, Dayton, OH",
        "Bachelor of Arts in Psychology, May 2021",
        "Cumulative G.P.A.: 3.42/4.00",
      ]),
      "education",
    ).entries;

    expect(first).toMatchObject({
      credential: "Master of Science in Nursing",
      institution: "Northgate University",
      location: "Columbus, OH",
      result: "3.81/4.00",
    });
    expect(first!.dates?.start).toEqual({ year: 2025, month: 12 });
    expect(second).toMatchObject({
      credential: "Bachelor of Arts in Psychology",
      institution: "Lakeview College",
      location: "Dayton, OH",
      result: "3.42/4.00",
    });
  });

  it("splits a degree, a school and a city given on one line", () => {
    const [entry] = section(
      parse([
        "Sam Doe",
        "sam@example.com",
        "EDUCATION",
        "M.B.A. Business Administration, Northgate University, South Bend, IN 2019",
      ]),
      "education",
    ).entries;
    expect(entry).toMatchObject({
      credential: "M.B.A. Business Administration",
      institution: "Northgate University",
      location: "South Bend, IN",
    });
  });

  it("recognises the Indian credentials the India examples use", () => {
    const entries = section(
      parse([
        "Asha Varma",
        "asha@example.com",
        "EDUCATION",
        "B.Com, St. Anne's College, Hyderabad, Telangana 2024",
        "Class XII, Kendriya Vidyalaya School, Hyderabad, Telangana 2021",
      ]),
      "education",
    ).entries;
    expect(entries.map((e) => e.credential)).toEqual(["B.Com", "Class XII"]);
  });
});

describe("the location in the contact block", () => {
  it("never joins the name line to the city beneath it", () => {
    const document = parse(["Sam Doe", "Philadelphia, PA ● sam@example.com", "EDUCATION"]);
    expect(document.contact.location).toBe("Philadelphia, PA");
  });

  it("reads past a street address, an address label and a ZIP or PIN code", () => {
    expect(
      parse(["Sam Doe", "4004 Helix Lane Urbana, IL 61801", "EXPERIENCE"]).contact.location,
    ).toBe("Urbana, IL");
    expect(
      parse(["Sam Doe", "Current Address: Pune, Maharashtra 411001", "EXPERIENCE"]).contact
        .location,
    ).toBe("Pune, Maharashtra");
  });
});
