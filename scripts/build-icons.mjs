/**
 * Render the site's icons from `src/app/icon.svg`.
 *
 * The favicon this replaces was create-next-app's: the Vercel triangle, in
 * every browser tab and beside every mobile search result for this site. Google
 * shows a site's favicon next to its results, so it is the first thing a
 * searcher sees of the brand, and it was somebody else's logo.
 *
 * The SVG is the source and is served as-is (Next's `icon.svg` convention);
 * this script only rasterises it for the places a vector is not accepted:
 *
 * - `src/app/favicon.ico` — 16, 32 and 48 px, PNG-compressed. Browsers and
 *   crawlers still request `/favicon.ico` directly, and Google asks for a
 *   multiple of 48 px.
 * - `src/app/apple-icon.png` — 180 px, the iOS home-screen size.
 * - `public/logo.png` — 512 px at a stable, unhashed URL, because the
 *   `Organization.logo` in the landing page's JSON-LD must be a URL that does
 *   not change with every build.
 *
 * It renders through `next/og`, the same renderer the Open Graph card uses, so
 * this adds no dependency. The outputs are committed: they change only when
 * the SVG does, and a build that needed this to run would be a build that can
 * fail for a reason unrelated to the code.
 *
 *   node scripts/build-icons.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const svg = readFileSync(`${root}src/app/icon.svg`);
const dataUri = `data:image/svg+xml;base64,${svg.toString("base64")}`;

async function png(size) {
  const element = {
    type: "div",
    props: {
      style: { display: "flex", width: size, height: size },
      children: { type: "img", props: { src: dataUri, width: size, height: size } },
    },
  };
  const response = new ImageResponse(element, { width: size, height: size });
  return Buffer.from(await response.arrayBuffer());
}

/** An ICO whose entries are PNGs — valid since Windows Vista, and far smaller than BMPs. */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // width; 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1); // height
    header.writeUInt8(0, entry + 2); // no palette
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  return Buffer.concat([header, ...images.map(({ data }) => data)]);
}

const favicon = [];
for (const size of [16, 32, 48]) favicon.push({ size, data: await png(size) });

writeFileSync(`${root}src/app/favicon.ico`, ico(favicon));
writeFileSync(`${root}src/app/apple-icon.png`, await png(180));
writeFileSync(`${root}public/logo.png`, await png(512));

console.log("Wrote src/app/favicon.ico, src/app/apple-icon.png, public/logo.png");
