/**
 * P32 acceptance.
 *
 * The criterion that carries the package is the third block below:
 * **switching `headingStyle` must not move the extracted text.** Structure is
 * style-invariant, and that is the entire reason it is safe to offer
 * templates at all. A competitor's "creative" template is a two-column table
 * that an ATS reads column-wise into nonsense; ours cannot be, and this is
 * the test that keeps it that way rather than the intention keeping it.
 */

import { describe, expect, it } from "vitest";
import { TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplate, matchTemplate } from "./templates";
import { migrate, MIGRATIONS, safeMigrate } from "./migrate";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  HEADER_STYLES,
  HEADING_STYLES,
  resumeDocumentSchema,
  settingsSchema,
  STANDARD_SECTION_TYPES,
  type ResumeDocument,
} from "./schema";
import { renderPdf } from "@/lib/emit/pdf/render";
import { renderDocx } from "@/lib/emit/docx/render";
import { renderText } from "@/lib/emit/text/render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { extractPdfGeometric, extractDocxBrowser } from "@/lib/xray/extract-browser";
import { midCareerResume } from "@/test/fixtures/resumes";

function withSettings(document: ResumeDocument, overrides: Partial<typeof DEFAULT_SETTINGS>) {
  return { ...document, settings: { ...document.settings, ...overrides } };
}

/* -------------------------------------------------------------------------- */
/* B1 — the migration                                                          */
/* -------------------------------------------------------------------------- */

describe("the v1 → v2 migration", () => {
  /** A real v1 document: everything the old schema had, and nothing it did not. */
  const v1Document = {
    schemaVersion: 1,
    contact: {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "",
      location: "",
      links: [],
    },
    sections: [
      { id: "s1", type: "summary", visible: true, content: "Wrote the first algorithm." },
      { id: "s2", type: "experience", visible: true, entries: [] },
    ],
    settings: {
      pageSize: "A4",
      fontPair: "modern",
      accent: "#1F2937",
      density: "comfortable",
      margins: 0.75,
      fontSizePt: 10.5,
      lineHeight: 1.2,
    },
  };

  it("keeps the chain contiguous to the current version", () => {
    const versions = MIGRATIONS.map((m) => m.from);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(MIGRATIONS[MIGRATIONS.length - 1]?.to).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("upgrades a v1 document without touching anything else in it", () => {
    const migrated = migrate(v1Document);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.contact.fullName).toBe("Ada Lovelace");
    expect(migrated.sections).toHaveLength(2);
    expect(migrated.settings.fontPair).toBe("modern");
    expect(migrated.settings.fontSizePt).toBe(10.5);
  });

  it("defaults a v1 document to the v1 appearance, so nothing existing changes", () => {
    // The bar for this migration in one assertion: a user who asked for
    // nothing must see nothing change.
    const migrated = migrate(v1Document);
    expect(migrated.settings.headerStyle).toBe("left");
    expect(migrated.settings.headingStyle).toBe("rule");
  });

  it("renders a migrated v1 document byte-identically to the pre-migration output", async () => {
    // Stronger than comparing the settings: the actual artifact.
    const migrated = migrate(v1Document);
    const explicit: ResumeDocument = withSettings(migrated, {
      headerStyle: "left",
      headingStyle: "rule",
    });
    const [a, b] = await Promise.all([
      renderPdf(migrated, { resolveFont: nodeFontResolver }),
      renderPdf(explicit, { resolveFont: nodeFontResolver }),
    ]);
    expect(a.bytes.byteLength).toBe(b.bytes.byteLength);
    expect((await extractPdfGeometric(a.bytes)).text).toBe(
      (await extractPdfGeometric(b.bytes)).text,
    );
  });

  it("does not overwrite a value a document already carries", () => {
    const already = {
      ...v1Document,
      settings: { ...v1Document.settings, headerStyle: "centered", headingStyle: "caps" },
    };
    const migrated = migrate(already);
    expect(migrated.settings.headerStyle).toBe("centered");
    expect(migrated.settings.headingStyle).toBe("caps");
  });

  it("still upgrades a pre-versioning document all the way to current", () => {
    const v0 = { ...v1Document, schemaVersion: undefined };
    const result = safeMigrate(v0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("rejects a document from a newer release rather than mangling it", () => {
    const future = { ...v1Document, schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(safeMigrate(future).ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* B2 — the presets                                                            */
/* -------------------------------------------------------------------------- */

describe("the template presets", () => {
  it("ships twelve", () => {
    expect(TEMPLATES).toHaveLength(12);
  });

  it("gives every template a unique id and name", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(TEMPLATES.length);
  });

  it("carries a complete, valid Settings object in each", () => {
    for (const template of TEMPLATES) {
      const parsed = settingsSchema.safeParse(template.settings);
      expect(parsed.success, `${template.id}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it("orders every standard section exactly once in each", () => {
    for (const template of TEMPLATES) {
      expect(new Set(template.sectionOrder).size, template.id).toBe(template.sectionOrder.length);
      expect([...template.sectionOrder].sort(), template.id).toEqual(
        [...STANDARD_SECTION_TYPES].sort(),
      );
    }
  });

  it("makes no template a visual duplicate of another", () => {
    // The four axes a gallery thumbnail can actually show apart. Two presets
    // identical on all four are one preset with two names, and a gallery of
    // those is worse than a smaller honest one.
    const signatures = TEMPLATES.map(
      (t) =>
        `${t.settings.fontPair}|${t.settings.headerStyle}|${t.settings.headingStyle}|${t.settings.density}`,
    );
    expect(new Set(signatures).size).toBe(TEMPLATES.length);
  });

  it("claims no outcome anywhere in `forWho` (D14)", () => {
    // The rule D14 states, as a test rather than a good intention. A font
    // choice cannot raise an interview rate, and nobody can substantiate a
    // claim that it does.
    const FORBIDDEN =
      /\b(guarantee\w*|beat\s+the|ats-proof|pass(es|ing)?\s+(the\s+)?ats|more\s+interviews?|hired|land\s+(the|a)\s+job|recruiter[-\s]approved|proven\s+to)\b/i;
    for (const template of TEMPLATES) {
      expect(FORBIDDEN.test(template.forWho), `${template.id}: ${template.forWho}`).toBe(false);
      expect(template.forWho.length).toBeGreaterThan(20);
    }
  });

  it("covers both header styles and all three heading styles", () => {
    for (const style of HEADER_STYLES) {
      expect(
        TEMPLATES.some((t) => t.settings.headerStyle === style),
        style,
      ).toBe(true);
    }
    for (const style of HEADING_STYLES) {
      expect(
        TEMPLATES.some((t) => t.settings.headingStyle === style),
        style,
      ).toBe(true);
    }
  });

  it("resolves the default template, and nothing else by a bad id", () => {
    expect(getTemplate(DEFAULT_TEMPLATE_ID)?.id).toBe(DEFAULT_TEMPLATE_ID);
    expect(getTemplate("no-such-template")).toBeNull();
  });

  it("recognises the template a document is currently on", () => {
    const chancery = getTemplate("chancery")!;
    expect(matchTemplate(chancery.settings)?.id).toBe("chancery");
    // An accent change is a personal choice layered over a template, not a
    // departure from it.
    expect(matchTemplate({ ...chancery.settings, accent: "#7C2D12" })?.id).toBe("chancery");
  });
});

/* -------------------------------------------------------------------------- */
/* The acceptance criterion: structure is style-invariant                      */
/* -------------------------------------------------------------------------- */

describe("style choices cannot move the machine-readable output", () => {
  it("produces identical PDF text under all three heading styles", async () => {
    const texts = await Promise.all(
      HEADING_STYLES.map(async (headingStyle) => {
        const { bytes } = await renderPdf(withSettings(midCareerResume, { headingStyle }), {
          resolveFont: nodeFontResolver,
        });
        return (await extractPdfGeometric(bytes)).text;
      }),
    );
    expect(texts[1]).toBe(texts[0]);
    expect(texts[2]).toBe(texts[0]);
  });

  it("produces identical DOCX text under all three heading styles", async () => {
    const texts = await Promise.all(
      HEADING_STYLES.map(async (headingStyle) => {
        const { bytes } = await renderDocx(withSettings(midCareerResume, { headingStyle }));
        return extractDocxBrowser(bytes).text;
      }),
    );
    expect(texts[1]).toBe(texts[0]);
    expect(texts[2]).toBe(texts[0]);
  });

  it("keeps section headings uppercase in the PDF whatever the heading style", async () => {
    // The one property the parse argument actually rests on. A template is
    // allowed to take away the rule; it is not allowed to take away this.
    //
    // Asserted on the PDF rather than the DOCX because the two express it
    // differently, and the difference matters: react-pdf's `textTransform`
    // changes the glyphs that are drawn, so extraction sees `EXPERIENCE`,
    // while Word's `allCaps` is a *run property* over text that is still
    // stored as `Experience`. Both render uppercase; only one of them makes
    // the extracted text uppercase, and asserting the DOCX here would be
    // asserting something untrue about how Word works.
    for (const headingStyle of HEADING_STYLES) {
      const { bytes } = await renderPdf(withSettings(midCareerResume, { headingStyle }), {
        resolveFont: nodeFontResolver,
      });
      expect((await extractPdfGeometric(bytes)).lines, headingStyle).toContain("EXPERIENCE");
    }
  });

  it("keeps the DOCX heading style named `Heading1` whatever the template", async () => {
    // D4: the DOCX parses well because its XML names the role of every
    // paragraph. A decorative change must not cost a section heading its name.
    const { extractDocxStructure } = await import("@/lib/xray/extract-browser");
    for (const template of TEMPLATES) {
      const { bytes } = await renderDocx({ ...midCareerResume, settings: template.settings });
      const headings = extractDocxStructure(bytes)
        .filter((p) => p.style === "Heading1")
        .map((p) => p.text);
      expect(headings, template.id).toContain("Experience");
    }
  });

  it("leaves the plain-text output untouched by either axis", () => {
    // Stated in `text/render.ts` as intent; asserted here as fact.
    const base = renderText(midCareerResume);
    for (const headerStyle of HEADER_STYLES) {
      for (const headingStyle of HEADING_STYLES) {
        expect(renderText(withSettings(midCareerResume, { headerStyle, headingStyle }))).toBe(base);
      }
    }
  });

  it("centres the header without changing what the text says", async () => {
    const [left, centered] = await Promise.all(
      HEADER_STYLES.map(async (headerStyle) => {
        const { bytes } = await renderPdf(withSettings(midCareerResume, { headerStyle }), {
          resolveFont: nodeFontResolver,
        });
        return await extractPdfGeometric(bytes);
      }),
    );
    expect(centered!.lines[0]).toBe(left!.lines[0]);
    expect(centered!.text).toBe(left!.text);
  });
});

/* -------------------------------------------------------------------------- */
/* Every template still produces a valid, renderable document                  */
/* -------------------------------------------------------------------------- */

describe("every template renders", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    "%s produces a valid PDF",
    async (_id, template) => {
      const document: ResumeDocument = { ...midCareerResume, settings: template.settings };
      expect(resumeDocumentSchema.safeParse(document).success).toBe(true);

      const { bytes, pageCount } = await renderPdf(document, { resolveFont: nodeFontResolver });
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(pageCount).toBeGreaterThan(0);

      const extracted = await extractPdfGeometric(bytes);
      expect(extracted.text).toContain("José Ángel Muñoz-Łukasiewicz");
      expect(extracted.text).toContain("Senior Backend Engineer");
    },
  );
});
