/**
 * Heading shapes found in eleven real postings on 2026-09-30 (QA.md §6).
 *
 * The postings themselves are not here — `QA.md` refuses to commit other
 * people's copy — so each shape is restated in text written for this file.
 * What they had in common: every one of these either came back `unknown`,
 * which scores a requirement at a third of its weight, or was misfiled.
 */

import { describe, expect, it } from "vitest";
import { classifyHeading, parseJobDescription } from "./parse";

function kinds(source: string): [string | null, string][] {
  return parseJobDescription(source).sections.map((section) => [section.heading, section.kind]);
}

describe("headings real postings use", () => {
  it("files what the candidate is asked to bring as required", () => {
    for (const heading of [
      "What you'll bring",
      "What you’ll bring",
      "What we look for",
      "What we're looking for",
      "About you",
      "About You",
      "Your expertise",
    ]) {
      expect(classifyHeading(heading), heading).toBe("required");
    }
  });

  it("files the job itself as responsibilities, even when it says 'you will have'", () => {
    for (const heading of [
      "The impact you will have",
      "The impact you'll have",
      "The difference you will make",
      "A typical day",
    ]) {
      expect(classifyHeading(heading), heading).toBe("responsibilities");
    }
  });

  it("files 'Desired' as preferred", () => {
    expect(classifyHeading("Desired")).toBe("preferred");
  });

  it("files the company talking about itself as about, and the role as the job", () => {
    for (const heading of [
      "About Acme Health",
      "Mission",
      "See yourself at Acme",
      "The community you will join",
    ]) {
      expect(classifyHeading(heading), heading).toBe("about");
    }
    expect(classifyHeading("About the role")).toBe("responsibilities");
    expect(classifyHeading("About the job")).toBe("responsibilities");
  });

  it("files benefits, compliance and logistics as boilerplate", () => {
    expect(classifyHeading("How Acme Supports Full-Time Employees")).toBe("benefits");
    expect(classifyHeading("Equity")).toBe("benefits");
    expect(classifyHeading("Time Off")).toBe("benefits");
    expect(classifyHeading("Compliance")).toBe("legal");
    expect(classifyHeading("Travel")).toBe("process");
    expect(classifyHeading("Application deadline information")).toBe("process");
  });

  it("still says unknown for a location, which is a fact rather than a section", () => {
    expect(classifyHeading("Remote")).toBe("unknown");
    expect(classifyHeading("Work Location")).toBe("unknown");
  });
});

describe("sub-headings inside a list", () => {
  it("take the kind of the list they sit in", () => {
    const posting = [
      "Director, Investor Relations",
      "",
      "What you'll do",
      "Earnings preparation and consensus",
      "- Own the quarterly earnings script and model",
      "Investor meetings and events",
      "- Run the annual investor day",
      "",
      "Requirements",
      "- Ten years in equity research or investor relations",
      "Judgement under pressure",
      "- Calm through an earnings call that goes badly",
      "",
      "Benefits",
      "- Health cover",
    ].join("\n");

    expect(kinds(posting)).toEqual([
      ["Earnings preparation and consensus", "responsibilities"],
      ["Investor meetings and events", "responsibilities"],
      ["Requirements", "required"],
      ["Judgement under pressure", "required"],
      ["Benefits", "benefits"],
    ]);
  });

  it("read a duty verb as a duty when there is no list above to inherit from", () => {
    const posting = [
      "Marketing Lead",
      "",
      "We are hiring someone to run marketing for a new region.",
      "",
      "Build and lead the regional strategy",
      "- Set the plan for the year",
      "Drive demand and revenue",
      "- Own pipeline targets",
    ].join("\n");

    expect(kinds(posting).slice(1)).toEqual([
      ["Build and lead the regional strategy", "responsibilities"],
      ["Drive demand and revenue", "responsibilities"],
    ]);
  });

  it("never lends a list's kind to a location", () => {
    const posting = [
      "Nurse Practitioner",
      "",
      "Requirements",
      "- Active nursing licence",
      "Location",
      "- Remote, within the United States",
    ].join("\n");

    expect(kinds(posting)).toEqual([
      ["Requirements", "required"],
      ["Location", "unknown"],
    ]);
  });
});
