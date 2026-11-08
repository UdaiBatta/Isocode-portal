import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { chromium } from "@playwright/test";
import { marked } from "marked";

async function main() {
  // Reuse the build's local fonts so the PDF needs neither a server nor a network request.
  const build = resolve(process.env.NEXT_DIST_DIR ?? ".next-e2e", "static");
  const faces = readdirSync(resolve(build, "chunks")).filter((file) => file.endsWith(".css"))
    .flatMap((file) => readFileSync(resolve(build, "chunks", file), "utf8").match(/@font-face\{[^}]+\}/g) ?? [])
    .join("\n").replace(/url\(\.\.\/media\/([^)]*)\)/g, (_, file: string) =>
      `url(data:font/woff2;base64,${readFileSync(resolve(build, "media", file)).toString("base64")})`);
  assert(faces.includes("Noto Sans Devanagari"), "Build the app first; the PDF requires its Hindi font.");
  let source = readFileSync("docs/TDD.md", "utf8");
  if (process.argv.includes("--no-live")) {
    source = source.replace(/^Live application:.*\r?\n/gm, "")
      .replaceAll("<GATE_0_RESULTS>", "Not run; no human findings supplied");
    assert(!source.includes("<LIVE_URL>"));
    assert(!source.includes("<GATE_0_RESULTS>"));
  }
  const content = (await marked.parse(source)).replace(/src="(screens\/[^\"]+)"/g, (_, file: string) => {
    const path = resolve("docs", file);
    assert(path.startsWith(resolve("docs/screens") + sep));
    return `src="data:image/png;base64,${readFileSync(path).toString("base64")}"`;
  });
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Coaching Fees</title><style>
  ${faces}
  body { font: 10pt/1.5 Inter, "Noto Sans Devanagari", sans-serif; color: #17231d; }
  h1 { font-size: 25pt; line-height: 1.2; margin: 20pt 0 12pt; }
  h2 { font-size: 16pt; margin: 22pt 0 9pt; border-bottom: 1px solid #ced7d0; padding-bottom: 5pt; }
  h3 { font-size: 12pt; margin: 15pt 0 7pt; }
  h1,h2,h3 { break-after: avoid; }
  p { margin: 7pt 0; } a { color: #25502e; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; font-size: 8.3pt; margin: 10pt 0; }
  thead { display: table-header-group; } th { background: #edf2ed; text-align: left; }
  td,th { border: 1px solid #ced7d0; padding: 5pt; vertical-align: top; }
  tr { break-inside: avoid; }
  pre { white-space: pre-wrap; background: #f1f4f0; padding: 9pt; font-size: 8pt; break-inside: avoid; }
  code { font-family: "Noto Sans Devanagari", monospace; font-size: .9em; overflow-wrap: anywhere; }
  pre code { font-family: "IBM Plex Mono", "Noto Sans Devanagari", monospace; }
  img { display: block; max-width: 100%; max-height: 125mm; object-fit: contain; margin: 10pt auto 4pt; }
  img[alt="Hindi parent dues"] { width: 62mm; height: 110mm; object-fit: cover; object-position: top; }
  img[alt="Accounts dashboard"], img[alt="Counsellor tasks"] { width: 100%; height: 110mm; object-fit: cover; object-position: top; }
  p:has(> img) { break-inside: avoid; break-after: avoid; } em { color: #48564d; font-size: 9pt; }
  </style><body>${content}</body></html>`;
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/TDD.html", html);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("p").filter({ hasText: "हिन्दी" }).first().evaluate((paragraph) => { paragraph.id = "pdf-hindi"; });
    const client = await page.context().newCDPSession(page);
    await client.send("DOM.enable");
    await client.send("CSS.enable");
    const { root } = await client.send("DOM.getDocument");
    const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#pdf-hindi" });
    const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
    assert(fonts.some((font) => font.isCustomFont && /Noto.*Devanagari/.test(font.familyName)), "Hindi must use the embedded Noto font.");
    assert.equal(await page.locator("img").count(), 4);
    assert(await page.locator("img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0)));
    await page.pdf({ path: "dist/TDD.pdf", format: "A4", printBackground: true,
      margin: { top: "17mm", right: "16mm", bottom: "19mm", left: "16mm" },
      displayHeaderFooter: true, headerTemplate: "<span></span>",
      footerTemplate: '<div style="width:100%;text-align:center;font:8px sans-serif;color:#48564d">Coaching Fees · <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
  } finally { await browser.close(); }
  console.log("Built dist/TDD.pdf with embedded fonts and screenshots.");
}

main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
