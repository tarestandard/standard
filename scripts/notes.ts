import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

/**
 * The notes: dated observations from the scans behind the standard.
 *
 * The standard's own changelog is the record of what the standard published;
 * these are the record of what we found in the world while applying it. They
 * are dated, public and citable, and they exist because a finding that is
 * only in a private report cannot be referenced by anyone — least of all by a
 * writer or an answer engine looking for a dated sentence to quote.
 *
 * One shape, enforced: `## YYYY-MM-DD — title`, newest first. A dated heading
 * with the wrong dash is an entry the feed would silently skip, so it throws
 * instead — the same rule the changelog feed enforces, for the same reason.
 */

export interface NoteEntry {
  /** ISO date, and the entry's anchor: one place per day per note. */
  date: string;
  title: string;
  /** The entry body as HTML, rendered at build time. */
  html: string;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NOTES_SOURCE = join(REPO_ROOT, "docs", "notes.md");
const SITE_ORIGIN = "https://tarestandard.org";

const HEADING = /^## (\d{4}-\d{2}-\d{2}) — (.+)$/;

export function loadNotes(source = NOTES_SOURCE): NoteEntry[] {
  const markdown = readFileSync(source, "utf8");
  const lines = markdown.split("\n");
  const entries: NoteEntry[] = [];
  let current: { date: string; title: string; body: string[] } | undefined;

  for (const line of lines) {
    const match = HEADING.exec(line);
    if (match) {
      if (current) entries.push(finish(current));
      current = { date: match[1] as string, title: (match[2] as string).trim(), body: [] };
      continue;
    }
    // A dated heading with the wrong dash is a silently dropped note.
    if (/^## \d{4}-\d{2}-\d{2}(?! — )/.test(line)) {
      throw new Error(
        `The note heading "${line}" is dated but not "## YYYY-MM-DD — title"; ` +
          "the feed would silently skip it.",
      );
    }
    if (current) current.body.push(line);
  }
  if (current) entries.push(finish(current));

  if (entries.length === 0) {
    throw new Error(
      "docs/notes.md has no dated entry; the notes page and its feed would be empty.",
    );
  }
  for (const entry of entries) {
    if (Number.isNaN(Date.parse(`${entry.date}T00:00:00Z`))) {
      throw new Error(`The note "${entry.date}" is not a date.`);
    }
  }
  const dates = entries.map((entry) => entry.date);
  const sorted = [...dates].sort().reverse();
  if (dates.some((date, index) => date !== sorted[index])) {
    throw new Error("The notes are not newest-first; the feed's order is the page's order.");
  }
  if (new Set(dates).size !== dates.length) {
    throw new Error("Two notes share a date, so their anchors would collide.");
  }
  return entries;
}

function finish(entry: { date: string; title: string; body: string[] }): NoteEntry {
  const body = entry.body.join("\n").trim();
  if (body === "") {
    throw new Error(`The note "${entry.date} — ${entry.title}" has no body to publish.`);
  }
  // A small renderer on purpose: the notes are prose, and the standard's own
  // renderer carries table and register machinery these pages do not need.
  const marked = new Marked({ gfm: true });
  return { date: entry.date, title: entry.title, html: marked.parse(body) as string };
}

/** The feed the page advertises: one entry per note, anchored to its date. */
export function atomNotesFeed(entries: readonly NoteEntry[]): string {
  const updated = `${entries[0]?.date ?? "1970-01-01"}T00:00:00Z`;
  const items = entries
    .map(
      (entry) => `  <entry>
    <title>${escapeXml(`${entry.date} — ${entry.title}`)}</title>
    <id>${escapeXml(`${SITE_ORIGIN}/notes#${entry.date}`)}</id>
    <updated>${entry.date}T00:00:00Z</updated>
    <link rel="alternate" type="text/html" href="${escapeXml(`${SITE_ORIGIN}/notes#${entry.date}`)}"/>
    <content type="html">${escapeXml(entry.html)}</content>
  </entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <title>Tare Standard — notes</title>
  <subtitle>Dated observations from the scans behind the standard.</subtitle>
  <id>${SITE_ORIGIN}/notes.xml</id>
  <updated>${updated}</updated>
  <link rel="self" type="application/atom+xml" href="${SITE_ORIGIN}/notes.xml"/>
  <link rel="alternate" type="text/html" href="${SITE_ORIGIN}/notes"/>
  <author><name>Tare Standard</name><uri>${SITE_ORIGIN}/</uri></author>
  <rights>CC BY 4.0</rights>
${items}
</feed>
`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
