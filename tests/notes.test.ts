import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildStandardSite } from "../scripts/build-standard";
import { atomNotesFeed, loadNotes } from "../scripts/notes";

/**
 * The notes are the site's dated observations (#788). Two things are worth a
 * test: the page and its feed are actually emitted and linked, and the one
 * shape an entry may take is enforced — a dated heading the feed would skip is
 * an error, not a silently missing finding.
 */

const build = buildStandardSite({ outDir: mkdtempSync(join(tmpdir(), "notes-build-")) });
afterAll(() => rmSync(build.outDir, { recursive: true, force: true }));

function source(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "notes-src-"));
  const file = join(dir, "notes.md");
  writeFileSync(file, body, "utf8");
  return file;
}

describe("the notes page and feed (#788)", () => {
  it("emits /notes, its feed, and links both from the page and the sitemap", () => {
    expect(build.pages).toContain("/notes");
    const page = readFileSync(join(build.outDir, "notes.html"), "utf8");
    // The entry's anchor is its date, and the feed links that anchor.
    expect(page).toContain('id="2026-11-24"');
    expect(page).toContain("A guest who declines cookies cannot reach the agent");
    expect(page).toContain('href="/notes.xml"');
  });

  it("serves an Atom feed whose entries are the notes, dated and anchored", () => {
    const xml = readFileSync(join(build.outDir, "notes.xml"), "utf8");
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    expect(xml).toContain("<id>https://tarestandard.org/notes.xml</id>");
    expect(xml).toMatch(/<entry>/);
    expect(xml).toContain("<id>https://tarestandard.org/notes#2026-11-24</id>");
    expect(xml).toContain("<updated>2026-11-24T00:00:00Z</updated>");
  });

  it("lists /notes in the sitemap", () => {
    const sitemap = readFileSync(join(build.outDir, "sitemap.xml"), "utf8");
    expect(sitemap).toContain("https://tarestandard.org/notes</loc>");
  });
});

describe("the one shape a note may take", () => {
  it("parses a dated entry into a title, a date and rendered prose", () => {
    const entries = loadNotes(
      source("# Notes\n\n## 2026-11-24 — A finding\n\nThe body, with a **bold** word.\n"),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.date).toBe("2026-11-24");
    expect(entries[0]?.title).toBe("A finding");
    expect(entries[0]?.html).toContain("<strong>bold</strong>");
  });

  it("refuses a dated heading the feed would silently skip", () => {
    expect(() => loadNotes(source("# Notes\n\n## 2026-11-24 - A finding\n\nThe body.\n"))).toThrow(
      /not "## YYYY-MM-DD — title"/,
    );
  });

  it("refuses a note with no body, because the feed would carry an empty entry", () => {
    expect(() => loadNotes(source("# Notes\n\n## 2026-11-24 — A finding\n\n"))).toThrow(
      /has no body/,
    );
  });

  it("refuses out-of-order notes, because the feed's order is the page's order", () => {
    expect(() =>
      loadNotes(
        source("# Notes\n\n## 2026-11-20 — Older\n\nBody.\n\n## 2026-11-24 — Newer\n\nBody.\n"),
      ),
    ).toThrow(/newest-first/);
  });

  it("refuses two notes on one date, because their anchors would collide", () => {
    expect(() =>
      loadNotes(
        source("# Notes\n\n## 2026-11-24 — One\n\nBody.\n\n## 2026-11-24 — Two\n\nBody.\n"),
      ),
    ).toThrow(/share a date/);
  });

  it("escapes the feed's content rather than letting prose become markup", () => {
    const entries = loadNotes(
      source("# Notes\n\n## 2026-11-24 — A finding\n\nA line with <script> and & in it.\n"),
    );
    const xml = atomNotesFeed(entries);
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&lt;script&gt;");
  });
});
