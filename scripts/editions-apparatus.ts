import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDARD_VERSION_LINE } from "./standard-docs.js";

/**
 * Correct the apparatus of the frozen editions, and only the apparatus.
 *
 * An edition is the record of what shipped on its date, so its pages are not
 * rebuilt: this script touches two strings in each page and nothing else.
 *
 *  1. The running head. When the 2026-11-13 edition was frozen, the build
 *     printed one fused date line — "Tare Standard v1.0 · suite v2.2 ·
 *     2026-11-12" — naming the suite a day before it was released. The live
 *     build now refuses that line, while the citation on every live page names
 *     this edition as the URL to cite. A cited object that prints a date the
 *     publisher has disowned is worse than an archive with a note on it, so
 *     the head takes the current, corrected line.
 *  2. The banner. It says what was corrected, when, and that the content did
 *     not change, so a reader comparing the archive to the live site is not
 *     left to guess why the frame differs.
 *
 * A page that carries a running head or a banner this script cannot recognise
 * is an error, not a skip: a head redesign that slipped through unannounced
 * would leave the cited editions printing the line the build forbids, while
 * this script reported success.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDITIONS = join(REPO_ROOT, "standard-site", "editions");
const CORRECTION =
  "Apparatus corrected 2026-11-14: the running head now names the standard's date and the suite's release date separately. The content is unchanged.";

/** The running head's dated span, which is always the second span in the head. */
const RUNNING_HEAD = /(<div class="running-head">\s*<span>[^<]*<\/span>\s*<span>)([^<]*)(<\/span>)/;
const BANNER = /<div(\s[^>]*class="[^"]*edition-banner[^"]*"[^>]*)><p>([\s\S]*?)<\/p><\/div>/;

export type Correction = { html: string; changed: boolean };

export function correctPage(html: string): Correction {
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
  if (head[2] !== STANDARD_VERSION_LINE) {
    // A function replacer, so a `$` in the version line can never be read as a
    // replacement pattern.
    next = next.replace(RUNNING_HEAD, (_match, open: string, _date: string, close: string) => {
      return `${open}${STANDARD_VERSION_LINE}${close}`;
    });
  }

  // Any earlier correction note is replaced rather than stacked, so a rewording
  // of it reaches the pages that already carry one.
  const body = banner[2] ?? "";
  const original = body.replace(/\s*Apparatus corrected[\s\S]*$/, "").trimEnd();
  const wanted = `${original} ${CORRECTION}`;
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
      const result = correctPage(before);
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
