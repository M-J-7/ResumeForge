/**
 * The gallery's pictures are renders of what the emitter produces today.
 *
 * `template-images.ts` explains why the template gallery ships files rather
 * than rendering in the browser. The cost of files is that they can go stale:
 * change a preset, the sample resume, a heading style or the emitter, and the
 * picture goes on showing the old page. This is what stops that. Every run
 * renders each template's PDF through the real emitter and compares its
 * fingerprint with the one the picture was drawn from.
 *
 * ## Regenerating
 *
 *   pnpm thumbnails:build
 *
 * runs this file with `UPDATE_TEMPLATE_IMAGES=1`: the same renders, then
 * `scripts/rasterize-pdfs.mjs` draws page one of each in a real Chromium with
 * the app's own pdfjs, and the manifest and `public/template-images/` are
 * rewritten. The assertions then run against what was just written, so an
 * update that produced a broken file still fails.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { pdfContentFingerprint } from "@/lib/emit/pdf/determinism";
import { renderPdf } from "@/lib/emit/pdf/render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { TEMPLATES } from "@/lib/resume/templates";
import {
  TEMPLATE_IMAGE_DIR,
  TEMPLATE_IMAGE_SCALE,
  type TemplateImageManifest,
} from "./template-images";
import { templateSample } from "./template-sample";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "src/lib/thumbnail/template-images.json");
const IMAGES = path.join(ROOT, "public", TEMPLATE_IMAGE_DIR);
const UPDATE = Boolean(process.env.UPDATE_TEMPLATE_IMAGES);

interface Rendered {
  bytes: Uint8Array;
  fingerprint: string;
}

const rendered = new Map<string, Rendered>();

function readManifest(): TemplateImageManifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as TemplateImageManifest;
}

/** Writes the PDFs, has a real browser draw them, and records the result. */
function regenerate(): void {
  const scratch = mkdtempSync(path.join(tmpdir(), "template-images-"));
  try {
    for (const [id, { bytes }] of rendered) writeFileSync(path.join(scratch, `${id}.pdf`), bytes);

    mkdirSync(IMAGES, { recursive: true });
    const sizes = JSON.parse(
      execFileSync(
        process.execPath,
        ["scripts/rasterize-pdfs.mjs", scratch, IMAGES, String(TEMPLATE_IMAGE_SCALE)],
        { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      ),
    ) as Record<string, { width: number; height: number }>;

    // A template that was removed leaves no picture behind.
    for (const file of readdirSync(IMAGES)) {
      if (!rendered.has(file.replace(/\.webp$/, ""))) unlinkSync(path.join(IMAGES, file));
    }

    const images: TemplateImageManifest["images"] = {};
    for (const id of [...rendered.keys()].sort()) {
      images[id] = { fingerprint: rendered.get(id)!.fingerprint, ...sizes[id]! };
    }
    const manifest: TemplateImageManifest = { scale: TEMPLATE_IMAGE_SCALE, images };
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

beforeAll(async () => {
  for (const template of TEMPLATES) {
    const { bytes } = await renderPdf(templateSample(template), { resolveFont: nodeFontResolver });
    const fingerprint = createHash("sha256").update(pdfContentFingerprint(bytes)).digest("hex");
    rendered.set(template.id, { bytes, fingerprint });
  }
  if (UPDATE) regenerate();
}, 300_000);

describe("the template gallery's pictures", () => {
  it("were drawn from the PDF each template produces today", () => {
    const manifest = readManifest();
    const stale = TEMPLATES.filter(
      (template) => manifest.images[template.id]?.fingerprint !== rendered.get(template.id)!.fingerprint,
    ).map((template) => template.id);

    expect(
      stale,
      "these templates render differently from their pictures — run `pnpm thumbnails:build` " +
        "and commit the result:\n" +
        stale.join("\n"),
    ).toEqual([]);
    expect(manifest.scale).toBe(TEMPLATE_IMAGE_SCALE);
  });

  it("are all on disk, as WebP, and nothing else is", () => {
    const manifest = readManifest();
    for (const template of TEMPLATES) {
      const file = path.join(IMAGES, `${template.id}.webp`);
      expect(existsSync(file), `${template.id}.webp is missing`).toBe(true);
      const head = readFileSync(file).subarray(0, 12);
      expect(head.subarray(0, 4).toString("latin1"), template.id).toBe("RIFF");
      expect(head.subarray(8, 12).toString("latin1"), template.id).toBe("WEBP");

      // The size the <img> reserves before the file arrives. Page proportions,
      // at the recorded scale — a zero here would be a card with no height.
      const { width, height } = manifest.images[template.id]!;
      const page = template.settings.pageSize === "LETTER" ? [612, 792] : [595.28, 841.89];
      expect(Math.abs(width - page[0]! * TEMPLATE_IMAGE_SCALE), template.id).toBeLessThan(2);
      expect(Math.abs(height - page[1]! * TEMPLATE_IMAGE_SCALE), template.id).toBeLessThan(2);
    }

    const expected = TEMPLATES.map((template) => `${template.id}.webp`).sort();
    expect(readdirSync(IMAGES).sort()).toEqual(expected);
    expect(Object.keys(manifest.images).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
  });

  it("render the same PDF twice over", async () => {
    // The pin above is only meaningful if an unchanged template fingerprints
    // the same on every run. `pdfContentFingerprint` exists for exactly this —
    // and for the same run on another machine, which `determinism.test.ts`
    // covers — and this holds it to it on the documents the pin depends on.
    const template = TEMPLATES[0]!;
    const { bytes } = await renderPdf(templateSample(template), { resolveFont: nodeFontResolver });
    const again = createHash("sha256").update(pdfContentFingerprint(bytes)).digest("hex");
    expect(again).toBe(rendered.get(template.id)!.fingerprint);
  });
});
