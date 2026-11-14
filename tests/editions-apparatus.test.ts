import { describe, expect, it } from "vitest";
import { correctPage } from "../scripts/editions-apparatus";
import { STANDARD_VERSION_LINE } from "../scripts/standard-docs";

/**
 * The frozen editions are the record of what shipped, so the only thing that
 * may change in them is the apparatus that dates them. These tests are the
 * guard on that line: they prove the dated line is corrected, that the note is
 * dated and idempotent, and that a page this script cannot recognise is an
 * error rather than a silent skip.
 */

const PAGE = `<!doctype html>
<html lang="en">
<body>
<div class="edition-banner" role="note" data-edition="2026-11-13"><p><strong>Archive.</strong> This is the 2026-11-13 edition of Tare Standard.</p></div>
<header class="masthead">
  <div class="running-head">
    <span>Published standard · tarestandard.org</span>
    <span>Tare Standard v1.0 · suite v2.2 · 2026-11-12</span>
  </div>
</header>
<main><p>The content this script must not touch.</p></main>
</body>
</html>`;

describe("the frozen editions' apparatus", () => {
  it("replaces the fused dated line with the one the live build publishes", () => {
    const { html, changed } = correctPage(PAGE);
    expect(changed).toBe(true);
    expect(html).toContain(`<span>${STANDARD_VERSION_LINE}</span>`);
    expect(html).not.toContain("Tare Standard v1.0 · suite v2.2 · 2026-11-12");
  });

  it("leaves the content, the page and the banner's own attributes alone", () => {
    const { html } = correctPage(PAGE);
    expect(html).toContain("<p>The content this script must not touch.</p>");
    expect(html).toContain('class="edition-banner" role="note" data-edition="2026-11-13"');
    expect(html).toContain("This is the 2026-11-13 edition of Tare Standard.");
    // One banner, one head: the correction is a note, not a second frame.
    expect(html.match(/class="edition-banner"/g)).toHaveLength(1);
    expect(html.match(/class="running-head"/g)).toHaveLength(1);
  });

  it("dates the correction and says the content did not change", () => {
    const { html } = correctPage(PAGE);
    expect(html).toContain("Apparatus corrected 2026-11-14");
    expect(html).toContain("The content is unchanged.");
  });

  it("is idempotent: a second run changes nothing", () => {
    const once = correctPage(PAGE);
    const twice = correctPage(once.html);
    expect(twice.changed).toBe(false);
    expect(twice.html).toBe(once.html);
  });

  it("rewrites an earlier note instead of stacking a second one", () => {
    const once = correctPage(PAGE);
    const stale = {
      html: once.html.replace("2026-11-14", "2026-11-10"),
      changed: true,
    };
    const fixed = correctPage(stale.html);
    expect(fixed.changed).toBe(true);
    expect(fixed.html.match(/Apparatus corrected/g)).toHaveLength(1);
    expect(fixed.html).toContain("Apparatus corrected 2026-11-14");
  });

  it("refuses a page whose running head it cannot recognise", () => {
    const noHead = PAGE.replace(/<div class="running-head">[\s\S]*?<\/div>/, "");
    expect(() => correctPage(noHead)).toThrow(/running head/);
  });

  it("refuses a page with nothing to date the correction in", () => {
    const noBanner = PAGE.replace(/<div class="edition-banner"[\s\S]*?<\/div>\s*/, "");
    expect(() => correctPage(noBanner)).toThrow(/archive banner/);
  });
});
