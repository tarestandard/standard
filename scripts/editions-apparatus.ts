import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LICENSE_NAME,
  LICENSE_URL,
  SHOPFRONT_VERSION_LINE,
  SITE_VERSION_LINE,
  STANDARD_VERSION_LINE,
  TRADEMARK_URL,
} from "./standard-docs.js";

/**
 * Correct the apparatus of the frozen editions, and only the apparatus.
 *
 * An edition is the record of what shipped on its date, so its pages are not
 * rebuilt: this script touches the dated line and the licence apparatus in each
 * page, and nothing else.
 *
 * The running head must print the edition the page belongs to: the site-level
 * pages print the newest edition's date, and each standard's pages print that
 * standard's own version and date. A head that fuses the two standards, names
 * the wrong edition, or carries an old line is corrected here, and the archive
 * banner gets one dated note saying what changed. A page whose head the script
 * cannot recognise is an error, not a skip.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDITIONS = join(REPO_ROOT, "standard-site", "editions");
const CORRECTION =
  "Apparatus corrected 2026-11-14: the running head now names the page's own edition and date.";
const LICENCE_CORRECTION =
  "Licence updated 2026-11-15: the text is CC BY 4.0 and the name and marks are reserved.";

/** The running head's dated span, which is always the second span in the head. */
const RUNNING_HEAD =
  /(<div class="running-head">\s*<span[^>]*>[\s\S]*?<\/span>\s*<span[^>]*>)([\s\S]*?)(<\/span>\s*<\/div>)/;
const BANNER = /<div(\s[^>]*class="[^"]*edition-banner[^"]*"[^>]*)><p>([\s\S]*?)<\/p><\/div>/;

/**
 * A frozen edition printed the licence it shipped under. The apparatus records
 * the current terms and dates the change; it never touches the document's text.
 */
const LICENCE_LINK =
  /<link rel="license" href="https:\/\/creativecommons\.org\/licenses\/by-nd\/4\.0\/">/g;
const LICENCE_JSONLD = /"license":"https:\/\/creativecommons\.org\/licenses\/by-nd\/4\.0\/"/g;
const COLOPHON_LICENCE = /<p class="colophon-licence">[\s\S]*?<\/p>/;
const LICENCE_SENTENCE = `<p class="colophon-licence">Published under <a href="${LICENSE_URL}">${LICENSE_NAME}</a>: share it and adapt it with attribution; the marks are reserved — see the <a href="${TRADEMARK_URL}">trademark policy</a>.</p>`;

/** The dated line as HTML, so the edition's date stays machine-readable. */
function versionLineHtml(line: string): string {
  const date = line.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (date === undefined) return line;
  return line.replace(date, `<time datetime="${date}">${date}</time>`);
}

/** The dated line a page of a frozen edition must print. */
export function lineFor(relativePath: string): string {
  const path = relativePath.split(sep).join("/");
  if (path === "agent.html" || path.startsWith("agent/")) return STANDARD_VERSION_LINE;
  if (path === "shopfront.html" || path.startsWith("shopfront/")) return SHOPFRONT_VERSION_LINE;
  return SITE_VERSION_LINE;
}

export type Correction = { html: string; changed: boolean };

export function correctPage(html: string, versionLine: string): Correction {
  const head = html.match(RUNNING_HEAD);
  const banner = html.match(BANNER);
  if (head === null) {
    throw new Error(
      "The frozen edition has no running head in the shape this script corrects; " +
        "teach scripts/editions-apparatus.ts the new shape before shipping it.",
    );
  }
  if (banner === null) {
    throw new Error("The frozen edition has no archive banner to date the correction in.");
  }

  let next = html;
  const text = (head[2] ?? "").replace(/<[^>]+>/g, "");
  let headChanged = false;
  if (text !== versionLine) {
    // A function replacer, so a `$` in the version line can never be read as a
    // replacement pattern.
    next = next.replace(
      RUNNING_HEAD,
      (_match, open: string, _date: string, close: string) =>
        `${open}${versionLineHtml(versionLine)}${close}`,
    );
    headChanged = true;
  }

  // The licence is apparatus, not content: the colophon, the reuse link and the
  // structured data must name the terms in force, and the banner dates the note.
  const licensed = next
    .replace(LICENCE_LINK, `<link rel="license" href="${LICENSE_URL}">`)
    .replace(LICENCE_JSONLD, `"license":"${LICENSE_URL}"`)
    .replace(COLOPHON_LICENCE, LICENCE_SENTENCE);
  const licenceChanged = licensed !== next;
  next = licensed;

  // Any earlier correction note is replaced rather than stacked, so a rewording
  // of it reaches the pages that already carry one. A page whose head and
  // licence were already right keeps the note it has.
  const body = banner[2] ?? "";
  const hasNote = /Apparatus corrected/.test(body);
  const hasLicenceNote = /Licence updated/.test(body);
  const original = body
    .replace(/\s*Apparatus corrected \d{4}-\d{2}-\d{2}:[^.]*\./, "")
    .replace(/\s*Licence updated \d{4}-\d{2}-\d{2}:[^.]*\./, "")
    .trimEnd();
  const notes = [
    ...(headChanged || hasNote ? [CORRECTION] : []),
    ...(licenceChanged || hasLicenceNote ? [LICENCE_CORRECTION] : []),
  ];
  const wanted = notes.length === 0 ? original : `${original} ${notes.join(" ")}`.trim();
  if (body !== wanted) {
    // Splice the sentence in rather than rebuilding the element, so whatever
    // attributes the banner carries survive.
    next = next.replace(banner[0], `<div${banner[1] ?? ""}><p>${wanted}</p></div>`);
  }

  return { html: next, changed: next !== html };
}

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "assets") continue;
      out.push(...pages(path));
      continue;
    }
    if (entry.endsWith(".html")) out.push(path);
  }
  return out;
}

export function run(): { pages: number; changed: number } {
  let changed = 0;
  let count = 0;
  for (const entry of readdirSync(EDITIONS)) {
    const dir = join(EDITIONS, entry);
    if (!statSync(dir).isDirectory()) continue;
    for (const path of pages(dir)) {
      const before = readFileSync(path, "utf8");
      const result = correctPage(before, lineFor(relative(dir, path)));
      count += 1;
      if (result.changed) {
        writeFileSync(path, result.html);
        changed += 1;
      }
    }
  }
  return { pages: count, changed };
}

// Importing this module for its helpers must not write to the repository.
if (process.argv[1]?.endsWith("editions-apparatus.ts")) {
  const { pages: count, changed } = run();
  console.log(
    changed === 0
      ? `The frozen editions carry the corrected apparatus (${count} pages).`
      : `Corrected the apparatus on ${changed} of ${count} frozen edition pages.`,
  );
}
