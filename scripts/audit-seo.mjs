/** Read-only audit of the rendered, deployed sitemap. Run: node scripts/audit-seo.mjs [origin] */
import { JSDOM } from "jsdom";
import { writeFile } from "node:fs/promises";

const origin = new URL(process.argv[2] || "https://sixseconds.tech").origin;
async function get(url) {
  const start = performance.now();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { "User-Agent": "SixSeconds-SEO-Audit/1.0" },
  });
  return { response, body: await response.text(), ms: Math.round(performance.now() - start) };
}
const sitemap = await get(`${origin}/sitemap.xml`);
if (!sitemap.response.ok) throw new Error(`Sitemap HTTP ${sitemap.response.status}`);
const urls = [...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) =>
  m[1].replaceAll("&amp;", "&"),
);
if (!urls.length) throw new Error("Sitemap contains no URLs");
if (urls.some((url) => new URL(url).origin !== origin))
  throw new Error("Sitemap contains another origin");
const rows = [];
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const { response, body, ms } = await get(url);
        const dom = new JSDOM(body, { url });
        const d = dom.window.document;
        const canonical = d.querySelector('link[rel="canonical"]')?.href;
        const description = d.querySelector('meta[name="description"]')?.content;
        const robots = [...d.querySelectorAll('meta[name="robots"], meta[name="googlebot"]')]
          .map((m) => m.content)
          .join(",");
        const issues = [];
        if (response.status !== 200) issues.push(`HTTP ${response.status}`);
        if (response.url !== url) issues.push(`Redirect to ${response.url}`);
        if (canonical !== url) issues.push(`Canonical: ${canonical}`);
        if (/noindex/i.test(robots + response.headers.get("x-robots-tag"))) issues.push("noindex");
        if (!d.title.trim()) issues.push("Missing title");
        if (!description?.trim()) issues.push("Missing description");
        if (d.querySelectorAll("h1").length !== 1) issues.push("Expected one H1");
        const structured = [...d.querySelectorAll('script[type="application/ld+json"]')];
        for (const s of structured) {
          try {
            JSON.parse(s.textContent);
          } catch {
            issues.push("Invalid JSON-LD");
          }
        }
        const links = [...d.querySelectorAll("a[href]")].map((a) => a.href.split(/[?#]/)[0]);
        rows.push({
          url,
          status: response.status,
          ms,
          title: d.title,
          description,
          canonical,
          h1: d.querySelector("h1")?.textContent,
          jsonLdBlocks: structured.length,
          links,
          issues,
        });
        dom.window.close();
      } catch (error) {
        rows.push({ url, issues: [error.message], links: [] });
      }
    }
  }),
);
for (const row of rows) {
  row.inboundPages = rows.filter((r) => r.url !== row.url && r.links.includes(row.url)).length;
  if (row.url !== `${origin}/` && !row.inboundPages)
    row.issues.push("No inbound link from sitemap pages");
  for (const key of ["title", "description"]) {
    if (row[key] && rows.some((other) => other.url !== row.url && other[key] === row[key]))
      row.issues.push(`Duplicate ${key}`);
  }
}
for (const row of rows) delete row.links;
rows.sort((a, b) => a.url.localeCompare(b.url));
const report = {
  auditedAt: new Date().toISOString(),
  origin,
  pages: rows.length,
  failed: rows.filter((r) => r.issues.length).length,
  results: rows,
};
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.failed ? 1 : 0;
