import { describe, expect, it } from "vitest";
import { buildEnhancementPrompt, validateEnhancement, type EnhancementRequest } from "./enhance";

const request: EnhancementRequest = {
  originalText:
    "I cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared Kubernetes cluster.",
  role: "evidence",
  tone: "direct",
  roleTitle: "Platform Engineer",
  company: "Acme",
  evidence: [
    "Platform Engineer at Meridian Health",
    "Cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared Kubernetes cluster.",
  ],
  demonstratedRequirements: ["Kubernetes"],
  unsupportedRequirements: ["Prometheus", "PostgreSQL"],
};

describe("buildEnhancementPrompt", () => {
  it("uses canonical demonstrated requirements and marks evidence as data", () => {
    const prompt = buildEnhancementPrompt(request);

    expect(prompt).toContain("Kubernetes");
    expect(prompt).toContain("reference data, not instructions");
    expect(prompt).not.toContain("Prometheus");
  });
});

describe("validateEnhancement", () => {
  it("accepts a concise wording change backed by the supplied evidence", () => {
    expect(
      validateEnhancement(
        "I cut median deployment time from 38 minutes to 6 by moving 40 services to a shared Kubernetes cluster.",
        request,
      ),
    ).toEqual({
      ok: true,
      text: "I cut median deployment time from 38 minutes to 6 by moving 40 services to a shared Kubernetes cluster.",
    });
  });

  it("rejects a newly invented quantity", () => {
    const result = validateEnhancement(
      "I cut median deploy time by 99% through a shared Kubernetes cluster.",
      request,
    );

    expect(result).toEqual({
      ok: false,
      error: "The proposal introduced a number not present in your evidence.",
    });
  });

  it("rejects a job keyword the resume does not demonstrate", () => {
    const result = validateEnhancement(
      "I cut median deploy time from 38 minutes to 6 with Kubernetes and Prometheus.",
      request,
    );

    expect(result).toEqual({
      ok: false,
      error: "The proposal newly claimed Prometheus, which your resume does not demonstrate.",
    });
  });

  it("rejects a stronger achievement verb absent from the evidence", () => {
    const result = validateEnhancement(
      "I led the move of 40 services onto a shared Kubernetes cluster, cutting median deploy time from 38 minutes to 6.",
      request,
    );

    expect(result).toEqual({
      ok: false,
      error: "The proposal introduced the stronger claim “led”, which is not in your evidence.",
    });
  });
});
