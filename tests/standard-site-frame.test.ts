import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertRegisterIds, buildStandardSite } from "../scripts/build-standard";
import {
  PUBLISHED_PAGE_URLS,
  SITE_ORIGIN,
  STANDARD_DATE,
  STANDARD_DOCS,
  STANDARD_VERSION,
  STANDARD_VERSION_LINE,
  SUITE_RELEASE_DATE,
  SUITE_VERSION,
} from "../scripts/standard-docs";
import { AIUC1_LIVE_REQUIREMENTS } from "../scripts/standard-scope";

/**
 * The frame and the reference tables, pinned.
 *
 * `tests/standard-site.test.ts` is the truth PR's file; this one covers the
 * apparatus the frame PR adds: a running head that carries the section, a
 * right margin, a real column plan on the wide tables, phone metadata and
 * contents, the social card and the structured data.
 */

let outDir: string;
let result: ReturnType<typeof buildStandardSite>;
let pageByUrl: Map<string, string>;
let css: string;
let sourceCss: string;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "tare-standard-frame-"));
  result = buildStandardSite({ outDir });
  pageByUrl = new Map(
    result.pages.map((url) => {
      const file =
        url === "/" ? "index.html" : url === "/404" ? "404.html" : `${url.slice(1)}.html`;
      return [url, readFileSync(join(outDir, file), "utf8")];
    }),
  );
  css = readFileSync(join(outDir, "assets", "site.css"), "utf8");
  sourceCss = readFileSync(join(process.cwd(), "standard-site", "site.css"), "utf8");
});

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

function page(url: string): string {
  const html = pageByUrl.get(url);
  if (!html) throw new Error(`No generated page for ${url}`);
  return html;
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The slice of a page between a start and end marker, or "" when absent. */
function between(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  if (from === -1) return "";
  const to = html.indexOf(end, from + start.length);
  return to === -1 ? "" : html.slice(from, to);
}

function tables(html: string): Array<{ classes: string; attrs: string; table: string }> {
  return [...html.matchAll(/<div class="(table-scroll[^"]*)"([^>]*)>([\s\S]*?)<\/table>/g)].map(
    (match) => ({
      classes: match[1] ?? "",
      attrs: match[2] ?? "",
      table: match[3] ?? "",
    }),
  );
}

function columnCount(tableHtml: string): number {
  const head = tableHtml.slice(0, tableHtml.indexOf("</thead>"));
  return [...head.matchAll(/<th\b/g)].length;
}

function anchors(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1] ?? "");
}

function tocLinks(html: string, selector: string): string[] {
  const section = html.slice(html.indexOf(selector));
  const list = section.slice(0, section.indexOf("</nav>"));
  return anchors(list).filter((href) => href.startsWith("#"));
}

describe("the running head carries the section", () => {
  it("names the section on the front page, a document, and the 404", () => {
    expect(page("/")).toContain('<span class="running-section">Contents</span>');
    expect(page("/404")).toContain('<span class="running-section">Not found</span>');
    for (const doc of STANDARD_DOCS) {
      expect(page(doc.url)).toContain(
        `<span class="running-section">${doc.title.replace(/&/g, "&amp;")}</span>`,
      );
    }
  });

  it("keeps the dated version line on the right of every page", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      expect(page(url), url).toContain('<span class="running-version">');
    }
  });
});

describe("the wide-table rule", () => {
  it("folds out wide tables, and four-column tables with a prose column", () => {
    const proseVariants = ["table--coverage-glance", "table--checks"];
    for (const url of PUBLISHED_PAGE_URLS) {
      for (const { classes, table } of tables(page(url))) {
        const wide = classes.split(" ").includes("table-scroll--wide");
        const prose = proseVariants.some((variant) => classes.includes(variant));
        expect(wide, `${url}: ${columnCount(table)} columns`).toBe(
          columnCount(table) >= 5 || prose,
        );
      }
    }
    expect(page("/scope")).toContain("table--coverage-glance");
    expect(page("/settled")).toContain("table--checks");
  });

  it("makes every table that can overflow a labelled, focusable region", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      for (const { classes, attrs, table } of tables(page(url))) {
        const wide = classes.split(" ").includes("table-scroll--wide");
        // A two-column rule table cannot overflow; a three-column one may.
        const scrollable = wide || columnCount(table) >= 3;
        expect(attrs, `${url} ${classes}`).toContain('role="region"');
        expect(attrs, `${url} ${classes}`).toContain("aria-label=");
        expect(attrs.includes('tabindex="0"'), `${url} ${classes}`).toBe(scrollable);
      }
    }
  });

  it("gives the prose-column tables a column plan and the same cue", () => {
    expect(css).toMatch(/\.table--coverage-glance th:nth-child\(4\)\s*\{\s*width: 42%/);
    expect(css).toMatch(/\.table--checks th:nth-child\(4\)\s*\{\s*width: 62%/);
    expect(page("/scope")).toContain("table--coverage-glance");
    expect(page("/settled")).toContain("table--checks");
    expect(page("/scope")).toContain("Scroll → for the full table");
    expect(page("/settled")).toContain("Scroll → for the full table");
  });

  it("keeps one measure and no dead contents column", () => {
    expect(css).toMatch(/--measure:\s*34rem/);
    expect(css).not.toMatch(/\.contents-table td:last-child/);
    expect(css).not.toMatch(/contents-table[^}]*white-space:\s*nowrap/);
  });

  it("keeps the rail dates only where the margin cannot show them", () => {
    const jobs = page("/jobs");
    expect(jobs).toContain('<dd><a href="/">Tare Standard</a></dd>');
    // The dates stay in the HTML (the rail is the only persistent date between
    // 900 and 1360px) and are hidden from 1360 up, where the margin prints them.
    expect(jobs).toContain('<div class="doc-meta-time"><dt>Published</dt>');
    expect(css).toMatch(/@media \(min-width: 1360px\) \{[^}]*\.doc-meta-time \{\s*display: none;/s);
  });

  it("sizes the two-column grades table to the reading column, not a 640px ribbon", () => {
    const grades = tables(page("/grades"));
    expect(grades.length).toBeGreaterThan(0);
    for (const table of grades) {
      expect(table.classes).not.toContain("table-scroll--wide");
    }
    // The min-width lives on the wide modifier only.
    expect(css).toContain(".document .table-scroll--wide table");
    expect(css).not.toContain(".document .table-scroll table {\n  min-width");
  });

  it("labels the wide register with a column plan and a scroll cue", () => {
    const html = page("/jobs");
    expect(html).toContain("table-scroll table-scroll--wide table--register");
    expect(html).toContain('<p class="table-hint">Scroll → for the full table</p>');
    expect(html).not.toContain('<p class="table-hint" aria-hidden');
    expect(css).toContain(".table--register th:nth-child(4)");
  });
});

describe("row identity", () => {
  it("anchors the job register by the suite's own ids", () => {
    const html = page("/jobs");
    // The register prints the id the rest of the standard cites, so a row is
    // addressable as `#v2-s17` exactly as the mapping page addresses it.
    expect(html).toContain('<tr id="v2-s01">');
    expect(html).toContain('<a class="row-id" href="#v2-s01">V2-S01</a>');
    expect(html).toContain('<tr id="v2-a04">');
    expect(html).toContain('<a class="row-id" href="#v2-a04">V2-A04</a>');
    // No row keeps the positional counter: two numbering systems is the
    // ambiguity the ids were printed to end.
    expect(html).not.toMatch(/<tr id="job-\d+">/);
  });

  it("prints each register cell's column so the phone layout can label it", () => {
    const html = page("/jobs");
    expect(html).toContain('<td data-label="Id">');
    expect(html).toContain('<td data-label="Must not">');
    expect(html).toContain('<td data-label="Anchor">');
  });

  it("anchors the mapped scenarios by their existing label", () => {
    const html = page("/scope");
    expect(html).toContain('<tr id="v2-s01">');
    expect(html).toContain('<a class="row-id" href="#v2-s01">V2-S01</a>');
  });

  it("keeps every self-link resolving inside the page", () => {
    const ids = new Set([...page("/jobs").matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] ?? ""));
    for (const href of anchors(page("/jobs")).filter((href) => href.startsWith("#"))) {
      expect(ids.has(href.slice(1)), href).toBe(true);
    }
  });
});

describe("the right margin and the citation", () => {
  it("prints the dated citation, the URL and both links on every document", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      const margin = html.slice(html.indexOf('<aside class="margin"'));
      const close = margin.indexOf("</aside>");
      const block = margin.slice(0, close);
      expect(plainText(block), doc.url).toContain(STANDARD_VERSION_LINE);
      expect(block, doc.url).toContain(`<time datetime="${STANDARD_DATE}">${STANDARD_DATE}</time>`);
      expect(block, doc.url).toContain(
        `<time datetime="${SUITE_RELEASE_DATE}">${SUITE_RELEASE_DATE}</time>`,
      );
      expect(block, doc.url).not.toContain("margin-url");
      expect(block, doc.url).toContain('href="/scope#how-to-cite-this"');
      expect(block, doc.url).toContain(`href="${doc.url}.md"`);
    }
  });

  it("does not invent a margin on the front page or the 404", () => {
    expect(page("/")).not.toContain('<aside class="margin"');
    expect(page("/404")).not.toContain('<aside class="margin"');
  });

  it("folds the citation out at the top of the document, not at its foot", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      const h1End = html.indexOf("</h1>");
      const details = html.indexOf('<details class="doc-cite"', h1End);
      expect(details, doc.url).toBeGreaterThan(h1End);
      // The id is uniquified when the page already owns "cite-this" (/settled),
      // so every page keeps its own anchor and no id is printed twice.
      const ids = [...html.matchAll(/id="(cite-this[^"]*)"/g)].map((m) => m[1]);
      expect(new Set(ids).size, doc.url).toBe(ids.length);
      expect(html, doc.url).toContain("<summary>Cite this</summary>");
    }
  });
});

describe("the phone carries the payload", () => {
  it("puts a compact dated metadata line under each document title", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      expect(html, doc.url).toContain('<p class="doc-meta-line">');
      expect(html, doc.url).toContain(STANDARD_VERSION_LINE);
      expect(html, doc.url).toContain(`href="${doc.url}.md">Source (Markdown)</a>`);
    }
  });

  it("renders the same section list as a native disclosure", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      expect(html, doc.url).toContain('<details class="doc-contents">');
      expect(html, doc.url).toContain("<summary>On this page</summary>");
      const rail = tocLinks(html, '<nav class="toc"');
      const disclosure = tocLinks(html, '<details class="doc-contents">');
      expect(disclosure, doc.url).toEqual(rail);
      expect(rail.length, doc.url).toBeGreaterThan(0);
    }
  });

  it("labels the table-of-contents navigation", () => {
    for (const doc of STANDARD_DOCS) {
      expect(page(doc.url), doc.url).toContain('<nav class="toc" aria-label="On this page">');
    }
  });

  it("keeps the dead rail-only mobile rules out of the stylesheet", () => {
    expect(css).not.toContain(".doc-meta {\n    display: grid");
    expect(css).not.toContain(".toc-list {\n    display: grid");
  });
});

describe("the front contents table", () => {
  it("offers one link and one tab stop per document", () => {
    const html = page("/");
    const body = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
    const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((match) => match[1] ?? "");
    expect(rows).toHaveLength(STANDARD_DOCS.length);
    for (const row of rows) {
      expect([...row.matchAll(/<a\b/g)]).toHaveLength(1);
    }
    expect(html).not.toContain('class="read-link"');
    expect(html).not.toContain('class="read-mark"');
    expect(html).not.toContain('<th scope="col">Read</th>');
    for (const row of rows) {
      expect([...row.matchAll(/<td\b/g)]).toHaveLength(2);
      expect(row).toContain('<span aria-hidden="true"> →</span></a>');
    }
  });

  it("does not make the contents a scroll region", () => {
    const contents = tables(page("/")).find((table) => table.table.includes("contents-table"));
    expect(contents).toBeDefined();
    expect(contents?.attrs ?? "").not.toContain("tabindex");
  });
});

describe("the social card and the structured data", () => {
  it("ships a 1200×630 PNG and references its absolute URL", () => {
    const png = readFileSync(join(outDir, "assets", "og.png"));
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      expect(html, url).toContain(
        `<meta property="og:image" content="${SITE_ORIGIN}/assets/og.png">`,
      );
      expect(html, url).toContain(
        `<meta name="twitter:image" content="${SITE_ORIGIN}/assets/og.png">`,
      );
      expect(html, url).toContain('<meta name="twitter:card" content="summary_large_image">');
      const alt = html.match(/<meta property="og:image:alt" content="([^"]*)">/)?.[1] ?? "";
      expect(alt, url).toContain(STANDARD_VERSION);
    }
  });

  it("pins the social card composition to the published version line", () => {
    const composition = readFileSync(
      join(process.cwd(), "standard-site", "assets", "og.html"),
      "utf8",
    );
    expect(composition).toContain(STANDARD_VERSION);
    expect(composition).toContain(SUITE_VERSION);
    expect(composition).toContain(STANDARD_DATE);
    expect(composition).toContain(STANDARD_VERSION_LINE);
    expect(composition).toContain(SUITE_RELEASE_DATE);
  });

  it("keeps every register column plan within the table width", () => {
    const matches = [
      ...sourceCss.matchAll(/\.table--register th:nth-child\((\d+)\)\s*\{\s*width:\s*([\d.]+)%/g),
    ];
    expect(matches.length).toBeGreaterThanOrEqual(7);
    // Later declarations are the narrow-screen overrides; the effective plan
    // is what the last value per column leaves behind.
    const effective = new Map<number, number>();
    for (const match of matches) effective.set(Number(match[1]), Number(match[2]));
    expect([...effective.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const total = [...effective.values()].reduce((sum, width) => sum + width, 0);
    expect(total, `columns ${[...effective.keys()].join(",")}`).toBe(100);
    for (const width of effective.values()) expect(width).toBeGreaterThan(0);
  });

  it("parses as JSON-LD and names the document", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      expect(raw, doc.url).toBeTruthy();
      const data = JSON.parse(raw ?? "{}") as Record<string, unknown>;
      expect(data["@type"], doc.url).toBe("TechArticle");
      expect(data.name, doc.url).toBe(doc.title);
      expect(data.description, doc.url).toBe(doc.description);
      expect(data.url, doc.url).toBe(`${SITE_ORIGIN}${doc.url}`);
      expect(data.datePublished, doc.url).toBe(STANDARD_DATE);
      expect(data.dateModified, doc.url).toBe(SUITE_RELEASE_DATE);
      expect(data.version, doc.url).toBe(STANDARD_VERSION);
      expect(data.additionalProperty, doc.url).toEqual({
        "@type": "PropertyValue",
        name: "suiteVersion",
        value: SUITE_VERSION,
      });
      expect(data.isBasedOn, doc.url).toBe("https://github.com/tarestandard/standard");
      expect(data.publisher, doc.url).toMatchObject({ "@type": "Organization" });
    }
  });

  it("describes the front page as a WebSite", () => {
    const html = page("/");
    const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    const data = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    expect(data["@type"]).toBe("WebSite");
    expect(data.url).toBe(`${SITE_ORIGIN}/`);
    expect(data.datePublished).toBe(STANDARD_DATE);
    expect(data.dateModified).toBe(SUITE_RELEASE_DATE);
    expect(data.version).toBe(STANDARD_VERSION);
    expect(data.additionalProperty).toMatchObject({ value: SUITE_VERSION });
  });
});

describe("the dated record is one derived pair", () => {
  it("prints the derived line in the running head, the margin and the colophon", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      expect(
        plainText(between(html, '<div class="running-head">', "</div>")),
        `${url} running head`,
      ).toContain(STANDARD_VERSION_LINE);
      expect(plainText(between(html, '<p class="colophon-version">', "</p>")), url).toContain(
        STANDARD_VERSION_LINE,
      );
      if (html.includes('<aside class="margin"')) {
        expect(plainText(between(html, '<aside class="margin"', "</aside>")), url).toContain(
          STANDARD_VERSION_LINE,
        );
      }
    }
  });

  it("dates the rail's publication and the suite's release as two facts", () => {
    for (const doc of STANDARD_DOCS) {
      const rail = between(page(doc.url), '<dl class="doc-meta">', "</dl>");
      expect(rail, doc.url).toContain("<dt>Published</dt>");
      expect(rail, doc.url).toContain(`<time datetime="${STANDARD_DATE}">${STANDARD_DATE}</time>`);
      expect(rail, doc.url).toContain("<dt>Suite released</dt>");
      expect(rail, doc.url).toContain(
        `<time datetime="${SUITE_RELEASE_DATE}">${SUITE_RELEASE_DATE}</time>`,
      );
    }
  });

  it("never fuses the suite version to the standard's publication date", () => {
    const staleLine = `Tare Standard ${STANDARD_VERSION} · suite ${SUITE_VERSION} · ${STANDARD_DATE}`;
    // A copyable line that names suite v2.2 and then dates it 2026-11-12 is the
    // ticket's bug: the suite shipped a day later.
    const fused = new RegExp(`suite v2\\.2[^<]{0,80}${STANDARD_DATE}`);
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      const lines = [
        between(html, '<div class="running-head">', "</div>"),
        between(html, '<aside class="margin"', "</aside>"),
        between(html, '<p class="colophon-version">', "</p>"),
      ].map(plainText);
      for (const line of lines) {
        expect(line, url).not.toContain(staleLine);
        expect(line, url).not.toMatch(fused);
      }
      // The old line is nowhere on the page, including the body's own prose.
      expect(html, url).not.toContain(staleLine);
    }
  });

  it("prints the same derived line in llms.txt", () => {
    const index = readFileSync(join(outDir, "llms.txt"), "utf8");
    expect(index).toContain(`Version: ${STANDARD_VERSION_LINE}`);
  });

  it("dates every sitemap entry from the suite release", () => {
    const sitemap = readFileSync(join(outDir, "sitemap.xml"), "utf8");
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((match) => match[1]);
    expect(lastmods).toEqual(PUBLISHED_PAGE_URLS.map(() => SUITE_RELEASE_DATE));
  });
});

describe("the mark on the rail", () => {
  it("generates a :target rule for every section a rail link names", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      const rail = html.slice(html.indexOf('<nav class="toc"'), html.indexOf("</nav>"));
      for (const href of anchors(rail).filter((href) => href.startsWith("#"))) {
        const id = href.slice(1);
        expect(css, `${doc.url} ${id}`).toContain(`.doc-shell:has(#${id}:target)`);
        expect(css, `${doc.url} ${id}`).toContain(`.rail a[href="#${id}"]`);
      }
    }
  });

  it("keeps the mark out of the stylesheet until a hash targets a section", () => {
    expect(css).toContain(".doc-shell:has(");
    // No unconditional target styling: every generated rule starts with :has.
    const targetRules = css.match(/\.doc-shell:has\(#[\w-]+:target\)/g) ?? [];
    expect(targetRules.length).toBeGreaterThan(0);
  });
});

describe("the print sheet", () => {
  it("sets a page margin and repeats table heads", () => {
    expect(css).toContain("@page {\n  margin: 18mm 16mm;\n}");
    expect(css).toContain("thead {\n    display: table-header-group;\n  }");
    expect(css).toContain("tr,\n  blockquote,\n  .citation {\n    break-inside: avoid;\n  }");
    // The register is taller than a page; `avoid` on its wrapper would only
    // push the first page break before it.
    expect(css).not.toContain("tr,\n  blockquote,\n  .table-scroll {");
    expect(css).toContain("h1,\n  h2,\n  h3 {\n    break-after: avoid;\n  }");
  });

  it("keeps the table head on screen while the register scrolls", () => {
    expect(css).toContain(".table-scroll th {\n  position: sticky;\n  top: 0;\n  z-index: 1;");
  });
});

describe("the stylesheet is not carrying dead duplicates", () => {
  it("declares the base link rule once and text-wrap once", () => {
    expect(css.match(/^a \{\n {2}color: var\(--ink\);/gm) ?? []).toHaveLength(1);
    expect(css.match(/text-wrap: pretty/g) ?? []).toHaveLength(1);
  });

  it("uses vermilion only for the mark, the focus ring and the zero line", () => {
    const uses = sourceCss.match(/var\(--grn\)/g) ?? [];
    expect(uses).toHaveLength(3);
  });
});

describe("the clause apparatus", () => {
  const fixture = JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "standard-heading-ids.json"), "utf8"),
  ) as Record<string, { depth: number; id: string }[]>;

  it("numbers h2 and h3 in document order", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      let h2 = 0;
      let h3 = 0;
      for (const match of html.matchAll(
        /<h([23]) id="[^"]+">(?:<span class="clause">([^<]+)<\/span> )?/g,
      )) {
        const depth = match[1];
        const number = match[2];
        if (depth === "2") {
          h2 += 1;
          h3 = 0;
          expect(number, `${doc.url} h2 #${h2}`).toBe(String(h2));
        } else {
          h3 += 1;
          // The build deliberately numbers an h3 only under an h2.
          if (h2 > 0) expect(number, `${doc.url} h3 under ${h2}`).toBe(`${h2}.${h3}`);
          else expect(number, `${doc.url} h3 before any h2`).toBeUndefined();
        }
      }
      expect(h2).toBeGreaterThan(0);
    }
  });

  it("keeps every heading id from before the change", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      const ids = new Set(
        [...html.matchAll(/<h([1-6]) id="([^"]+)"/g)].map((match) => `${match[1]}:${match[2]}`),
      );
      const before = fixture[doc.url] ?? [];
      expect(before.length, doc.url).toBeGreaterThan(0);
      const expected = new Set(before.map((heading) => `${heading.depth}:${heading.id}`));
      expect([...ids].sort(), doc.url).toEqual([...expected].sort());
    }
  });

  it("carries the clause number in the rail as a section reference", () => {
    const scope = page("/scope");
    const railStart = scope.indexOf('<nav class="toc"');
    const rail = scope.slice(railStart, scope.indexOf("</nav>", railStart));
    expect(rail).toContain('class="clause">§1<');
    expect(rail).toContain('class="clause">§8<');
  });

  it("names the attack group in the rail and nowhere else", () => {
    const jobs = page("/jobs");
    expect(jobs).toContain('<li class="toc-group"><a href="#suite-v2-2">');
    const grouped = STANDARD_DOCS.filter((doc) =>
      page(doc.url).includes('class="register-group"'),
    ).map((doc) => doc.url);
    expect(grouped).toEqual(["/jobs"]);
  });

  it("announces the clause number with the heading", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      expect(html, doc.url).toContain('<span class="clause">1</span> ');
      expect(html, doc.url).not.toContain('<span class="clause" aria-hidden');
    }
  });
});

describe("the attack-job group", () => {
  it("sits above the four V2-A rows and below the last V2-S row", () => {
    const html = page("/jobs");
    const group = html.indexOf('class="register-group"');
    expect(group).toBeGreaterThan(0);
    const lastS = html.lastIndexOf('<tr id="v2-s25">');
    const firstA = html.indexOf('<tr id="v2-a01">');
    expect(group).toBeGreaterThan(lastS);
    expect(group).toBeLessThan(firstA);
    for (const n of ["01", "02", "03", "04"]) {
      expect(html, `v2-a${n}`).toContain(`<tr id="v2-a${n}">`);
    }
  });
});

describe("the register's ids are one list on two pages", () => {
  const ids = (count: number, prefix = "v2-s", from = 1): string[] =>
    Array.from(
      { length: count },
      (_unused, index) => `${prefix}${String(index + from).padStart(2, "0")}`,
    );
  const pageOf = (list: readonly string[]): string =>
    list.map((id) => `<tr id="${id}">`).join("\n");

  it("passes when the register and the mapping agree", () => {
    const list = [...ids(25), ...ids(4, "v2-a", 1)];
    expect(() => assertRegisterIds(pageOf(list), pageOf(list))).not.toThrow();
  });

  it("fails a drift at the row it starts on", () => {
    const register = ids(29);
    const mapping = ids(29);
    mapping[16] = "v2-s99";
    expect(() => assertRegisterIds(pageOf(register), pageOf(mapping))).toThrow(
      /disagree at row 17/,
    );
  });

  it("fails when the register loses a row", () => {
    const list = ids(28);
    expect(() => assertRegisterIds(pageOf(list), pageOf(list))).toThrow(/anchors 28 jobs/);
  });

  it("fails when the mapping loses a row", () => {
    const register = ids(29);
    expect(() => assertRegisterIds(pageOf(register), pageOf(ids(28)))).toThrow(
      /one table gained or lost a row/,
    );
  });
});

describe("the phone register is a catalogue", () => {
  it("hides the head and labels every cell below 640", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 640px)"));
    const block = phone.slice(0, phone.indexOf("\n}\n"));
    expect(block).toMatch(/\.table--register thead\s*\{[^}]*clip-path/);
    expect(block).toMatch(/\.table--register td::before\s*\{[^}]*content: attr\(data-label\)/);
    expect(block).toMatch(/\.table--register tr \+ tr\s*\{[^}]*border-top/);
    // The cue belongs to the scroll, and there is no scroll in this layout.
    expect(block).toMatch(/\.table-hint--register\s*\{[^}]*display: none/);
  });

  it("keeps the widened id column and never wraps an id", () => {
    expect(css).toMatch(/\.table--register th:nth-child\(1\)\s*\{\s*width: 9%/);
    expect(css).toMatch(/\.table-scroll \.row-id\s*\{[^}]*white-space: nowrap/);
  });

  it("prints no scroll cue and gives the seven columns a point size that fits", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/\.table-hint,/);
    expect(print).toMatch(/\.table-scroll--wide table\s*\{\s*font-size: 8pt/);
  });
});

describe("the apparatus is standardised", () => {
  it("gives every document the same dated line", () => {
    const lines = new Set<string>();
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      const kicker = html.match(/<strong class="doc-kicker[^"]*">([^<]*)<\/strong>/)?.[1];
      expect(kicker, doc.url).toBeTruthy();
      lines.add(kicker ?? "");
    }
    // One grammar across six documents, or the apparatus teaches the reader
    // that the apparatus is decoration.
    expect([...lines]).toHaveLength(1);
    expect([...lines][0]).toBe(
      `Tare Standard ${STANDARD_VERSION} · suite ${SUITE_VERSION} · released ${SUITE_RELEASE_DATE}`,
    );
  });

  it("sets the dated line as a sentence, not a band of capitals", () => {
    expect(css).toMatch(/\.document \.doc-kicker \{[^}]*text-transform: none/);
  });
});

describe("the scope tally", () => {
  it("draws one cell per live requirement and fills the covered ones", () => {
    const html = page("/");
    const cells = html.match(/class="tally-cell/g) ?? [];
    const filled = html.match(/class="tally-cell tally-cell--with/g) ?? [];
    expect(cells).toHaveLength(AIUC1_LIVE_REQUIREMENTS);
    expect(filled).toHaveLength(6);
    // The figure restates the numbers in words for anyone who cannot see it.
    expect(html).toContain("6 of 50");
    expect(html).toContain("44 have no row");
  });
});

describe("the citation block", () => {
  it("carries the document's own title, versions and both URLs, inline", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      const id = html.match(/<details class="doc-cite" id="([^"]+)"/)?.[1];
      expect(id, doc.url).toBeTruthy();
      const start = html.indexOf(`<details class="doc-cite" id="${id}"`);
      const raw = html.slice(start, html.indexOf("</details>", start));
      // The URLs carry `<wbr>` break points; the copy is one string regardless.
      const block = raw.replaceAll("<wbr>", "");
      expect(raw).toContain("<wbr>");
      expect(block, doc.url).toContain(doc.title);
      expect(block, doc.url).toContain(STANDARD_VERSION);
      // The page is cited by the URL a reader is on, and by the frozen edition
      // it can still be read at. Both, in one place, so they cannot disagree.
      expect(block, doc.url).toContain(`${SITE_ORIGIN}${doc.url}`);
      expect(block, doc.url).toContain(`editions/${SUITE_RELEASE_DATE}${doc.url}`);
      expect(block, doc.url).toContain(`<time datetime="${STANDARD_DATE}">`);
      expect(block, doc.url).toContain(`<time datetime="${SUITE_RELEASE_DATE}">`);
      // The citation is at the top of the document, before the first section.
      expect(html.indexOf('class="doc-cite"'), doc.url).toBeLessThan(html.indexOf("<h2 id="));
      expect(css).toMatch(/\.cite-line\s*\{[^}]*user-select: all/);
    }
  });

  it("has one citation apparatus, not a second at the foot of the page", () => {
    for (const doc of STANDARD_DOCS) {
      const html = page(doc.url);
      expect(html, doc.url).not.toContain('<section class="citation"');
      expect(html, doc.url).not.toMatch(/<p class="margin-url">/);
      // Exactly one CITATION details, and no jump target at the end of the
      // page for a reader to be teleported to.
      expect(html.match(/<details class="doc-cite"/g), doc.url).toHaveLength(1);
    }
  });
});
