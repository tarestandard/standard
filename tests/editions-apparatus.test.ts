import { describe, expect, it } from "vitest";
import { correctPage, lineFor } from "../scripts/editions-apparatus";
import {
  SHOPFRONT_VERSION_LINE,
  SITE_VERSION_LINE,
  STANDARD_VERSION_LINE,
} from "../scripts/standard-docs";

/**
 * The frozen editions are the record of what shipped, so the only thing that
 * may change in them is the apparatus that dates them. These tests are the
 * guard on that line: they prove the page's own dated line is restored, that
 * the note is dated and idempotent, and that a page this script cannot
 * recognise is an error rather than a silent skip.
 */

const AGENT_PAGE = `<!doctype html>
<html lang="en">
<body>
<div class="edition-banner" role="note" data-edition="2026-11-14"><p><strong>Archive.</strong> This is the 2026-11-14 edition of Tare Standard v1.0.</p></div>
<header class="masthead">
  <div class="running-head">
    <span>Published standard · tarestandard.org</span>
    <span>Tare Agent Standard v1.0 · suite v2.2 · 2026-11-12</span>
  </div>
</header>
<main><p>The content this script must not touch.</p></main>
</body>
</html>`;

describe("the frozen editions' apparatus", () => {
  it("names the site, agent and shopfront editions separately", () => {
    expect(lineFor("index.html")).toBe(SITE_VERSION_LINE);
    expect(lineFor("agent/jobs.html")).toBe(STANDARD_VERSION_LINE);
    expect(lineFor("shopfront/levels.html")).toBe(SHOPFRONT_VERSION_LINE);
  });

  it("replaces a stale dated line with the page's own edition line", () => {
    const { html, changed } = correctPage(AGENT_PAGE, STANDARD_VERSION_LINE);
    expect(changed).toBe(true);
    expect(html.replace(/<[^>]+>/g, "")).toContain(STANDARD_VERSION_LINE);
    expect(html).toContain('<time datetime="2026-11-14">2026-11-14</time>');
    expect(html).not.toContain("suite v2.2");
  });

  it("leaves the content and the banner's own attributes alone", () => {
    const { html } = correctPage(AGENT_PAGE, STANDARD_VERSION_LINE);
    expect(html).toContain("<p>The content this script must not touch.</p>");
    expect(html).toContain('class="edition-banner" role="note" data-edition="2026-11-14"');
    expect(html.match(/class="edition-banner"/g)).toHaveLength(1);
    expect(html.match(/class="running-head"/g)).toHaveLength(1);
  });

  it("dates the correction and says what changed", () => {
    const { html } = correctPage(AGENT_PAGE, STANDARD_VERSION_LINE);
    expect(html).toContain("Apparatus corrected 2026-11-14");
    expect(html).toContain("names the page's own edition and date");
  });

  it("is idempotent: a second run changes nothing", () => {
    const once = correctPage(AGENT_PAGE, STANDARD_VERSION_LINE);
    const twice = correctPage(once.html, STANDARD_VERSION_LINE);
    expect(twice.changed).toBe(false);
    expect(twice.html).toBe(once.html);
  });

  it("rewrites an earlier note instead of stacking a second one", () => {
    const once = correctPage(AGENT_PAGE, STANDARD_VERSION_LINE);
    const stale = once.html.replace(
      "Apparatus corrected 2026-11-14",
      "Apparatus corrected 2026-11-10",
    );
    const fixed = correctPage(stale, STANDARD_VERSION_LINE);
    expect(fixed.html.match(/Apparatus corrected/g)).toHaveLength(1);
    expect(fixed.html).toContain("Apparatus corrected 2026-11-14");
  });

  it("refuses a page whose running head it cannot recognise", () => {
    const noHead = AGENT_PAGE.replace(/<div class="running-head">[\s\S]*?<\/div>/, "");
    expect(() => correctPage(noHead, STANDARD_VERSION_LINE)).toThrow(/running head/);
  });

  it("refuses a page with nothing to date the correction in", () => {
    const noBanner = AGENT_PAGE.replace(/<div class="edition-banner"[\s\S]*?<\/div>\s*/, "");
    expect(() => correctPage(noBanner, STANDARD_VERSION_LINE)).toThrow(/archive banner/);
  });
});
