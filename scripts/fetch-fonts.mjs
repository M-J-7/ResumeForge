/**
 * Vendors the font files this app embeds into generated PDFs.
 *
 * Run once with `pnpm fonts:fetch`; the output is committed. Nothing at
 * runtime or test time touches the network — the files must be in the repo,
 * because a PDF cannot be generated without them.
 *
 * ## Why fetch rather than depend on an npm package
 *
 * react-pdf cannot select a weight from a variable font, so we need static
 * instances of each style. Three of our five families (Arimo, EB Garamond,
 * IBM Plex Sans) ship only variable TTFs in google/fonts. The Google Fonts CSS
 * API instantiates them server-side and serves static TTFs to a user-agent
 * that advertises no woff support, which is what this script asks for.
 *
 * Licensing (D1): every family here is open-licensed and may be embedded. The
 * proprietary faces they replace (Arial, Calibri, Times New Roman) may not be,
 * which is the entire reason this pipeline exists. License files are fetched
 * alongside the fonts and committed next to them.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(HERE, "..", "src", "lib", "fonts");
const OUT_DIR = path.join(FONTS_DIR, "files");

/**
 * Safari 4 — the newest user-agent the API still serves plain TTF to.
 *
 * Do not "modernise" this string. MSIE 6 gets EOT; Safari 5.1 and Firefox 27
 * get WOFF; anything current gets WOFF2. react-pdf wants TTF, so this
 * specific vintage is load-bearing.
 */
const TTF_UA =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_5_8; en-us) AppleWebKit/531.22.7 (KHTML, like Gecko) Version/4.0.5 Safari/531.22.7";

const STYLES = [
  { name: "Regular", axis: "0,400" },
  { name: "Bold", axis: "0,700" },
  { name: "Italic", axis: "1,400" },
  { name: "BoldItalic", axis: "1,700" },
];

/**
 * `dir` is the family's directory in github.com/google/fonts. `extraLicense`
 * lists upstream fallbacks for families whose google/fonts directory ships no
 * license text — Tinos is one, despite METADATA.pb declaring OFL.
 */
const FAMILIES = [
  {
    family: "Tinos",
    slug: "Tinos",
    dir: "ofl/tinos",
    extraLicense: [
      "https://raw.githubusercontent.com/googlefonts/tinos/main/OFL.txt",
      "https://raw.githubusercontent.com/googlefonts/tinos/master/OFL.txt",
    ],
  },
  { family: "Arimo", slug: "Arimo", dir: "ofl/arimo", extraLicense: [] },
  { family: "Carlito", slug: "Carlito", dir: "ofl/carlito", extraLicense: [] },
  { family: "EB Garamond", slug: "EBGaramond", dir: "ofl/ebgaramond", extraLicense: [] },
  { family: "IBM Plex Sans", slug: "IBMPlexSans", dir: "ofl/ibmplexsans", extraLicense: [] },
];

const LICENSE_CANDIDATES = ["OFL.txt", "LICENSE.txt", "UFL.txt"];

/**
 * Builds the retained-character string from the shared charset definition.
 *
 * Subsetting is not merely a size optimisation here: per D2 the preview is the
 * real PDF rendered in the browser, so the user downloads these files. Full
 * faces come to ~6 MB, which is not shippable. The glyph coverage test asserts
 * against the same JSON, so the subset can never silently drop a character we
 * promised to support.
 */
async function loadCharsetText() {
  const raw = await readFile(path.join(FONTS_DIR, "charset.json"), "utf8");
  const { ranges, extras } = JSON.parse(raw);

  let text = "";
  for (const { start, end } of ranges) {
    for (let cp = start; cp <= end; cp += 1) text += String.fromCodePoint(cp);
  }
  for (const { codePoint } of extras) text += String.fromCodePoint(codePoint);
  return text;
}

function sniffFormat(buffer) {
  const tag = buffer.subarray(0, 4);
  const ascii = tag.toString("latin1");
  if (ascii === "wOFF") return "woff";
  if (ascii === "wOF2") return "woff2";
  if (ascii === "OTTO") return "otf";
  if (ascii === "ttcf") return "ttc";
  if (tag.readUInt32BE(0) === 0x00010000 || ascii === "true") return "ttf";
  return "unknown";
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.text();
}

async function fetchBinary(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function resolveFontUrl(family, axis) {
  const query = `family=${encodeURIComponent(family)}:ital,wght@${axis}`;
  const css = await fetchText(`https://fonts.googleapis.com/css2?${query}`, {
    "User-Agent": TTF_UA,
  });
  const match = css.match(/url\(([^)]+)\)/);
  if (!match?.[1]) {
    throw new Error(`No font URL in CSS for ${family} @ ${axis}. Response:\n${css}`);
  }
  return match[1];
}

async function fetchLicense(dir, extra) {
  const candidates = [
    ...LICENSE_CANDIDATES.map((name) => ({
      name,
      url: `https://raw.githubusercontent.com/google/fonts/main/${dir}/${name}`,
    })),
    ...extra.map((url) => ({ name: "OFL.txt", url })),
  ];

  for (const { name, url } of candidates) {
    try {
      return { name, text: await fetchText(url), source: url };
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/** METADATA.pb carries the authoritative license declaration and copyright. */
async function fetchMetadata(dir) {
  try {
    return await fetchText(
      `https://raw.githubusercontent.com/google/fonts/main/${dir}/METADATA.pb`,
    );
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const charsetText = await loadCharsetText();
  process.stdout.write(`Subsetting to ${[...charsetText].length} code points from charset.json\n`);

  const manifest = [];
  let failures = 0;
  let rawTotal = 0;

  for (const { family, slug, dir, extraLicense } of FAMILIES) {
    process.stdout.write(`\n${family}\n`);

    for (const style of STYLES) {
      const label = `${slug}-${style.name}.ttf`;
      try {
        const url = await resolveFontUrl(family, style.axis);
        const raw = await fetchBinary(url);
        const format = sniffFormat(raw);

        if (format !== "ttf") {
          throw new Error(`expected a TTF, got "${format}" (${raw.length} bytes)`);
        }

        const subset = await subsetFont(raw, charsetText, { targetFormat: "truetype" });
        if (sniffFormat(subset) !== "ttf") {
          throw new Error("subsetting produced a non-TTF result");
        }
        if (subset.length >= raw.length) {
          throw new Error(`subsetting had no effect (${subset.length} >= ${raw.length})`);
        }

        rawTotal += raw.length;
        await writeFile(path.join(OUT_DIR, label), subset);
        const sha256 = createHash("sha256").update(subset).digest("hex");
        manifest.push({
          family,
          style: style.name,
          file: label,
          bytes: subset.length,
          rawBytes: raw.length,
          sha256,
        });
        const saved = (100 * (1 - subset.length / raw.length)).toFixed(0);
        process.stdout.write(
          `  ok    ${label.padEnd(30)} ${(subset.length / 1024).toFixed(0).padStart(4)} KB  (-${saved}%)\n`,
        );
      } catch (error) {
        failures += 1;
        process.stdout.write(`  FAIL  ${label.padEnd(30)} ${error.message}\n`);
      }
    }

    const license = await fetchLicense(dir, extraLicense);
    if (license) {
      await writeFile(path.join(OUT_DIR, `${slug}-${license.name}`), license.text);
      process.stdout.write(`  ok    ${slug}-${license.name}\n`);
    } else {
      failures += 1;
      process.stdout.write(`  FAIL  no license file found for ${family}\n`);
    }

    const metadata = await fetchMetadata(dir);
    if (metadata) {
      await writeFile(path.join(OUT_DIR, `${slug}-METADATA.pb`), metadata);
    }
  }

  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    `${JSON.stringify(
      { generatedFrom: "Google Fonts CSS API", userAgent: TTF_UA, fonts: manifest },
      null,
      2,
    )}\n`,
  );

  const totalBytes = manifest.reduce((sum, f) => sum + f.bytes, 0);
  const mb = totalBytes / 1024 / 1024;
  process.stdout.write(
    `\n${manifest.length} files, ${mb.toFixed(2)} MB total ` +
      `(from ${(rawTotal / 1024 / 1024).toFixed(2)} MB unsubsetted)\n`,
  );

  // M0-T2 acceptance criterion.
  if (mb > 3) {
    process.stdout.write(`WARNING: vendored fonts exceed the 3 MB budget\n`);
    process.exitCode = 1;
  }

  if (failures > 0) {
    process.stdout.write(`${failures} failure(s)\n`);
    process.exitCode = 1;
  }
}

await main();
