import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertClaimFree,
  assertDatedRecord,
  assertEmittedUrlsResolve,
  buildStandardSite,
  findClaimWord,
  type Page,
} from "../scripts/build-standard";
import {
  ERRATA_URL,
  LICENSE_NAME,
  LICENSE_URL,
  PUBLISHED_PAGE_URLS,
  SITE_ORIGIN,
  STANDARD_DATE,
  STANDARD_DOCS,
  STANDARD_VERSION,
  STANDARD_VERSION_LINE,
  type StandardDoc,
  SUITE_RELEASE_DATE,
  SUITE_VERSION,
} from "../scripts/standard-docs";
import {
  CRITICAL_FAIL_CAP,
  CRITICAL_PENDING_CAP,
  PASS_D,
  PASS_E,
  PENALTIES,
  SEVERITY_WEIGHT,
  YES,
} from "../scripts/standard-instrument";
import {
  assertScopeSplit,
  loadScopeCounts,
  parseScopeCounts,
  renderedFamilyCounts,
  scopeHeading,
  scopeSentence,
} from "../scripts/standard-scope";

const tempDirs: string[] = [];
let outDir: string;
let result: ReturnType<typeof buildStandardSite>;
let pageByUrl: Map<string, string>;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "tare-standard-"));
  tempDirs.push(outDir);
  result = buildStandardSite({ outDir });
  pageByUrl = new Map(
    result.pages.map((url) => {
      const file =
        url === "/" ? "index.html" : url === "/404" ? "404.html" : `${url.slice(1)}.html`;
      return [url, readFileSync(join(outDir, file), "utf8")];
    }),
  );
});

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function page(url: string): string {
  const html = pageByUrl.get(url);
  if (!html) throw new Error(`No generated page for ${url}`);
  return html;
}

function article(html: string): string {
  const start = html.indexOf('<article class="document">');
  const end = html.indexOf("</article>", start);
  if (start === -1 || end === -1) throw new Error("No document article");
  return html.slice(start, end);
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

function ids(html: string): Set<string> {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1] ?? ""));
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("the dated record", () => {
  const asPage = (html: string, file = "index.html"): Page => ({
    url: "/",
    file,
    html,
    anchors: new Set<string>(),
  });
  const head = `<span class="running-version">${STANDARD_VERSION_LINE}</span>`;
  const sitemap = PUBLISHED_PAGE_URLS.map(
    (url) => `<url><loc>${SITE_ORIGIN}${url}</loc><lastmod>${SUITE_RELEASE_DATE}</lastmod></url>`,
  ).join("");
  const llms = `Version: ${STANDARD_VERSION_LINE}`;

  it("keeps publication and release as two distinct, ordered facts", () => {
    expect(SUITE_RELEASE_DATE).not.toBe(STANDARD_DATE);
    expect(STANDARD_DATE < SUITE_RELEASE_DATE).toBe(true);
  });

  it("passes only when every surface prints the derived record", () => {
    expect(() => assertDatedRecord([asPage(head)], { sitemap, llms })).not.toThrow();
  });

  it("rejects a page without the derived running head", () => {
    expect(() =>
      assertDatedRecord([asPage("<html><body>no head</body></html>")], { sitemap, llms }),
    ).toThrow(/running head/);
  });

  it("rejects the suite version printed beside the publication date", () => {
    expect(() =>
      assertDatedRecord(
        [
          asPage(
            `${head}<div class="running-head">suite ${SUITE_VERSION} shipped ${STANDARD_DATE}</div>`,
          ),
        ],
        { sitemap, llms },
      ),
    ).toThrow(/within 80 characters/);
  });

  it("rejects a margin citation without the two <time> dates", () => {
    expect(() =>
      assertDatedRecord([asPage(`${head}<aside class="margin"><p>cite</p></aside>`)], {
        sitemap,
        llms,
      }),
    ).toThrow(/<time> element/);
  });

  it("rejects a sitemap that dates the documents by the standard, not the suite", () => {
    const stale = sitemap.replaceAll(SUITE_RELEASE_DATE, STANDARD_DATE);
    expect(() => assertDatedRecord([asPage(head)], { sitemap: stale, llms })).toThrow(/sitemap/);
  });

  it("rejects an agent index without the derived line", () => {
    expect(() => assertDatedRecord([asPage(head)], { sitemap, llms: "# Tare" })).toThrow(/llms/);
  });

  it("rejects structured data that loses the release date", () => {
    const ld = `<script type="application/ld+json">${JSON.stringify({
      datePublished: STANDARD_DATE,
      dateModified: STANDARD_DATE,
      additionalProperty: { "@type": "PropertyValue", value: SUITE_VERSION },
    })}</script>`;
    expect(() => assertDatedRecord([asPage(head + ld)], { sitemap, llms })).toThrow(/structured/);
  });

  it("keeps the standard version in the record the guard checks", () => {
    expect(STANDARD_VERSION_LINE).toContain(STANDARD_VERSION);
    expect(STANDARD_VERSION_LINE).toContain(SUITE_VERSION);
  });
});

describe("the licence and the status of the document", () => {
  it("links the reuse terms from every page and names them in the colophon", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      expect(html, url).toContain(`<link rel="license" href="${LICENSE_URL}">`);
      expect(html, url).toContain(LICENSE_NAME);
      expect(html, url).toContain(ERRATA_URL);
      expect(html, url).toContain("Status: the published edition");
    }
  });

  it("publishes the licence in the structured data", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      const raw = page(url).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      const data = JSON.parse(raw ?? "{}") as { license?: unknown };
      expect(data.license, url).toBe(LICENSE_URL);
    }
  });

  it("says what translation needs, without granting a modification right", () => {
    const html = page("/");
    expect(html).toContain("translating it needs permission");
    expect(html).not.toContain("derivatives are permitted");
  });
});

describe("the published page set", () => {
  it("is exactly the intended list", () => {
    const files = readdirSync(outDir)
      .filter((file) => file.endsWith(".html"))
      .sort();

    expect(files).toEqual([
      "404.html",
      "changelog.html",
      "grades.html",
      "index.html",
      "jobs.html",
      "protocol.html",
      "scope.html",
      "settled.html",
    ]);
    expect(STANDARD_DOCS.map((doc) => doc.url)).toEqual([
      "/jobs",
      "/grades",
      "/scope",
      "/settled",
      "/changelog",
      "/protocol",
    ]);
    expect([...PUBLISHED_PAGE_URLS]).toEqual([
      "/",
      "/jobs",
      "/grades",
      "/scope",
      "/settled",
      "/changelog",
      "/protocol",
    ]);
    expect(result.pages).toEqual([
      "/",
      "/jobs",
      "/grades",
      "/scope",
      "/settled",
      "/changelog",
      "/protocol",
      "/404",
    ]);
  });

  it("accounts for every Markdown file in docs/standard", () => {
    const excluded = [
      "docs/standard/hotel-attack-scenarios-v22-draft.md",
      "docs/standard/hotel-frontdesk-scenarios-v1.md",
      "docs/standard/hotel-frontdesk-scenarios-v2.md",
    ];
    const all = readdirSync(join(process.cwd(), "docs/standard"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => `docs/standard/${file}`)
      .sort();

    expect(all).toEqual([...STANDARD_DOCS.map((doc) => doc.source), ...excluded].sort());
  });

  it("does not publish the draft, the v2.1 jobs page or the v1 pilot suite", () => {
    const sources = STANDARD_DOCS.map((doc) => doc.source);
    expect(sources.some((source) => source.includes("draft"))).toBe(false);
    expect(sources.some((source) => source.endsWith("hotel-frontdesk-scenarios-v1.md"))).toBe(
      false,
    );
    expect(sources.some((source) => source.endsWith("hotel-frontdesk-scenarios-v2.md"))).toBe(
      false,
    );
    expect([...pageByUrl.keys()]).not.toContain("/attack");
  });

  it("is deterministic", () => {
    const second = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(second);
    buildStandardSite({ outDir: second });

    for (const file of result.files) {
      expect(readFileSync(join(second, file), "utf8"), file).toBe(
        readFileSync(join(outDir, file), "utf8"),
      );
    }
  });

  it("fails the build when a published document is missing", () => {
    const base = STANDARD_DOCS[0];
    if (!base) throw new Error("The publication manifest is empty");
    const missing: StandardDoc = {
      ...base,
      source: "docs/standard/this-document-does-not-exist.md",
    };
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);

    expect(() => buildStandardSite({ outDir: scratch, docs: [missing] })).toThrow(
      /Published document is missing/,
    );
  });
});

describe.each(STANDARD_DOCS)("the published document $source", (doc) => {
  const source = readFileSync(resolve(process.cwd(), doc.source), "utf8");
  const html = () => page(doc.url);
  const body = () => article(html());

  it("renders every source heading with a deep-linkable id", () => {
    const sourceH1 = source.match(/^# (.+)$/m)?.[1]?.trim();
    const sourceH2s = [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]?.trim() ?? "");
    const rendered = body();
    const renderedH1 = rendered.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    const renderedH2s = [...rendered.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/g)];

    expect(sourceH1).toBeTruthy();
    expect(plainText(renderedH1)).toBe(sourceH1);
    expect(renderedH2s).toHaveLength(sourceH2s.length);
    for (const [index, match] of renderedH2s.entries()) {
      expect(match[1]).toMatch(/\bid="[^"]+"/);
      // A visible clause number now precedes the heading text (#234); the id
      // and the words are unchanged.
      expect(plainText(match[2] ?? "").replace(/^\d+(\.\d+)*\s+/, "")).toBe(sourceH2s[index]);
    }
  });

  it("renders its tables instead of raw pipes", () => {
    expect(body()).not.toMatch(/^\s*\|/m);
    expect(body()).not.toContain("|---");
    if (!/^\|.+\|$/m.test(source)) return;
    expect(body()).toContain("<table>");
    expect(body()).toContain('<div class="table-scroll"');
  });

  it("carries its title, description and canonical URL", () => {
    expect(html()).toContain(`<title>${doc.title} · Tare Standard</title>`);
    expect(html()).toContain(`<meta name="description" content="${doc.description}">`);
    expect(html()).toContain(`<link rel="canonical" href="${SITE_ORIGIN}${doc.url}">`);
    expect(html()).toContain(`<meta property="og:url" content="${SITE_ORIGIN}${doc.url}">`);
    expect(html()).not.toMatch(/noindex/i);
  });
});

describe("the front page", () => {
  it("states the standard, the version line and the contents", () => {
    const html = page("/");
    expect(html).toContain("<title>Tare Standard — the published Code of Points</title>");
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/">`);
    expect(html).toContain(STANDARD_VERSION_LINE);
    expect(html).toContain("The Code of Points for AI agents.");
    for (const doc of STANDARD_DOCS) {
      expect(html).toContain(`href="${doc.url}"`);
      expect(html).toContain(doc.summary);
    }
    expect(html).not.toMatch(/noindex/i);
  });

  it("links to the scope section and prints its zero line", () => {
    const html = page("/");
    expect(html).toContain('href="/scope#scope-what-this-suite-does-and-does-not-test"');
    expect(plainText(html)).toContain("The scope: 6 of 50");
    expect(plainText(html)).toContain("0 is a fact about the suite, a hole we are not hiding.");
  });
});

describe("the scope page", () => {
  it("keeps the scope section readable and linkable", () => {
    const html = page("/scope");
    const text = plainText(html);

    expect(html).toContain('id="scope-what-this-suite-does-and-does-not-test"');
    expect(text).toContain("Scope — what this suite does and does not test");
    expect(text).toContain("6 of 50.");
    expect(text).toContain("0 is a fact about the suite, a hole we are not hiding.");
    expect(text).toContain("44 of the 50 requirements have no row.");
    expect(text).toContain("A Data & Privacy (0 of 9)");
    expect(text).toContain("B Security (0 of 10)");
    expect(text).toContain("E Accountability (0 of 16)");
    expect(text).toContain("F Society (0 of 2)");
  });

  it("renders the AIUC-1 scope table with one row per named requirement", () => {
    const html = page("/scope");
    const section = html.slice(html.indexOf("scope-what-this-suite-does-and-does-not-test"));
    const rows = [...section.matchAll(/<tr>/g)].length;
    expect(rows).toBeGreaterThanOrEqual(6);
    expect(section).toContain("Prevent harmful outputs");
    expect(section).toContain("Prevent hallucinated outputs");
  });
});

describe("the published numerals", () => {
  it("derives the scope split, the no-row count and the heading from the Family table", () => {
    const counts = loadScopeCounts();
    expect(counts.total).toBe(50);
    expect(counts.covered).toBe(6);
    expect(counts.noRow).toBe(44);
    expect(counts.zeroFamilies).toBe(4);
    expect(counts.families).toEqual([
      { letter: "C", name: "Safety", count: 4 },
      { letter: "D", name: "Reliability", count: 2 },
    ]);

    // The sentence's numerals are the table's, not a second typing of them.
    const sentence = scopeSentence(counts);
    expect(sentence).toContain("Six AIUC-1 requirements");
    expect(sentence).toContain("four in Safety and two in Reliability");
    expect(sentence).toContain("Forty-four have no row");
    expect(sentence).toContain("Four families are at zero");
    expect(scopeHeading(counts)).toBe("The scope: 6 of 50");

    const text = plainText(page("/"));
    expect(text).toContain(scopeHeading(counts));
    expect(text).toContain(sentence);
    expect(() =>
      assertScopeSplit({
        indexHtml: page("/"),
        scopeHtml: page("/scope"),
        counts,
      }),
    ).not.toThrow();
  });

  it("reads a changed Family table into a changed split, not a stale sentence", () => {
    const markdown = readFileSync(join(process.cwd(), "docs/standard/mappings.md"), "utf8");
    const withFifthSafetyRow = markdown.replace(
      "| D Reliability | D001 Prevent hallucinated outputs |",
      "| C Safety | C006 Output vulnerabilities | V2-S22 | observed |\n| D Reliability | D001 Prevent hallucinated outputs |",
    );
    const counts = parseScopeCounts(withFifthSafetyRow);

    expect(counts.covered).toBe(7);
    expect(counts.noRow).toBe(43);
    expect(counts.families).toEqual([
      { letter: "C", name: "Safety", count: 5 },
      { letter: "D", name: "Reliability", count: 2 },
    ]);
    expect(scopeSentence(counts)).toContain("five in Safety and two in Reliability");
    expect(scopeSentence(counts)).toContain("Forty-three have no row");
  });

  it("counts distinct requirement ids and refuses a duplicated row", () => {
    const markdown = readFileSync(join(process.cwd(), "docs/standard/mappings.md"), "utf8");
    const duplicated = markdown.replace(
      "C004 Prevent out-of-scope outputs",
      "C003 Prevent harmful outputs",
    );
    expect(() => parseScopeCounts(duplicated)).toThrow(
      /The AIUC-1 requirement C003 appears twice in the scope Family table/,
    );
  });

  it("refuses a mappings document with no Scope section", () => {
    expect(() => parseScopeCounts("# Framework mapping\n\nNo scope section here.")).toThrow(
      /no Scope section/,
    );
  });

  it("refuses a Scope section with no Family table", () => {
    expect(() =>
      parseScopeCounts("## Scope — what this suite does and does not test\n\nProse only."),
    ).toThrow(/no Family \| AIUC-1 requirement table/);
  });

  it("refuses a Family row without a family", () => {
    const markdown =
      "## Scope — what this suite does and does not test\n\n" +
      "| Family | AIUC-1 requirement | Job(s) | Evidence class |\n" +
      "|---|---|---|---|\n" +
      "| none | C001 Risk taxonomy | V2-S22 | observed |\n";
    expect(() => parseScopeCounts(markdown)).toThrow(/row without a family/);
  });

  it("refuses a scanned Family table with no tbody", () => {
    expect(() =>
      renderedFamilyCounts(
        "<table><thead><tr><th>Family</th><th>AIUC-1 requirement</th></tr></thead></table>",
      ),
    ).toThrow(/no <tbody>/);
  });

  it("fails the build when the front page prints a typed split the table contradicts", () => {
    const counts = loadScopeCounts();
    const typed =
      "Six AIUC-1 requirements have a published job that can genuinely speak to them: " +
      "three in Safety and three in Reliability. Forty-four have no row. Four families are at zero.";
    const index = page("/").replace(scopeSentence(counts), typed);

    expect(() => assertScopeSplit({ indexHtml: index, scopeHtml: page("/scope"), counts })).toThrow(
      /front page does not print the scope derived from its \/scope Family table/,
    );
  });

  it("fails the build when the rendered /scope table disagrees with the parse", () => {
    const counts = loadScopeCounts();
    const scope = page("/scope").replace("<td>C Safety</td>", "<td>D Reliability</td>");

    expect(() =>
      assertScopeSplit({
        indexHtml: page("/"),
        scopeHtml: scope,
        counts,
      }),
    ).toThrow(/\/scope Family table does not match the mappings parse/);
  });

  it("derives the scope metadata from the same table", () => {
    const counts = loadScopeCounts();
    const scopeDoc = STANDARD_DOCS.find((doc) => doc.url === "/scope");
    expect(scopeDoc?.description).toContain(
      `${counts.covered} of ${counts.total} AIUC-1 requirements`,
    );
    expect(scopeDoc?.summary).toContain(`${counts.covered} of ${counts.total} AIUC-1 requirements`);
  });
});

describe("the published instrument", () => {
  it("pins the published rule to the code constants it mirrors", () => {
    const html = page("/grades");
    const text = plainText(html);

    expect(text).toContain("How a score is computed");
    expect(text).toContain("E starts at 10");
    expect(text).toContain(`at least ${YES}`);
    expect(text).toContain(`E ≥ ${PASS_E}`);
    expect(text).toContain(`D ≥ ${PASS_D}`);
    expect(text).toContain(`caps E at ${CRITICAL_FAIL_CAP}`);
    expect(text).toContain(`caps it at ${CRITICAL_PENDING_CAP}`);
    expect(text).toContain(
      `C = ${SEVERITY_WEIGHT.C}, H = ${SEVERITY_WEIGHT.H}, M = ${SEVERITY_WEIGHT.M}`,
    );

    // One assertion per penalty question: the printed deduction cell must be
    // the number `src/scan/questions.ts` applies.
    const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((match) => match[1] ?? "");
    for (const [id, penalty] of Object.entries(PENALTIES)) {
      const row = rows.find((cells) => cells.includes(`<code>${id}</code>`));
      expect(row, `${id} row`).toBeTruthy();
      const cells = [...(row ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
      expect(plainText(cells.at(-1)?.[1] ?? ""), id).toBe(String(penalty));
    }

    for (const outcome of ["passed", "failed", "unresolved", "ineligible", "not captured"]) {
      expect(text).toContain(outcome);
    }
    expect(text).toContain("makes the job ineligible, not failed");
  });

  it("dates the two calibration denominators instead of equating them", () => {
    const text = plainText(page("/grades"));
    expect(text).toContain("18-turn judge brevet (2026-11)");
    expect(text).toContain("72%");
    expect(text).toContain("2026-12 panel's cutover");
    expect(text).toContain("43-turn set");
    expect(text).toContain("different denominators");
    expect(text).not.toContain("current 18-turn calibration set");
  });

  it("states that the protocol is not a result and fixes one sample size", () => {
    const text = plainText(page("/protocol"));
    expect(text).toContain("Sample (10 bots)");
    expect(text).toContain("at least 4 of the 10 bots");
    expect(text).toContain("This page is the protocol, not a result");
    expect(text).toContain("No dated result of the test is published");
    expect(text).not.toContain("8–10 bots");
  });

  it("keeps the scoring-rules claim now that the rule is published", () => {
    expect(page("/jobs")).toContain("and the scoring rules");
    expect(plainText(page("/grades"))).toContain("How a score is computed");
  });
});

describe("the agent index and the changelog", () => {
  it("publishes llms.txt listing every document and its Markdown source", () => {
    const index = readFileSync(join(outDir, "llms.txt"), "utf8");
    expect(index).toContain("# Tare Standard");
    expect(index).toContain(STANDARD_VERSION_LINE);
    for (const doc of STANDARD_DOCS) {
      expect(index).toContain(`${SITE_ORIGIN}${doc.url}`);
      expect(index).toContain(`${SITE_ORIGIN}${doc.url}.md`);
    }
    expect(index).toContain("https://tarestandard.com");
    expect(index).toContain("https://github.com/tarestandard/standard");
    expect(index).toContain("https://github.com/tarestandard/standard/issues/new/choose");
  });

  it("names standards and subjects, never the panel's instrument", () => {
    // The standard cites AIHA, OWASP, NIST, AIUC-1 and the job's own subject
    // matter; it must never name the models or vendors that judge it (ADR-0028).
    for (const url of PUBLISHED_PAGE_URLS) {
      expect(page(url), url).not.toMatch(
        /openai|perplexity|chatgpt|claude|anthropic|copilot|gpt-|pplx|clef|jev/i,
      );
    }
  });

  it("names the panel version, never the instrument", () => {
    // The changelog is a public page. ADR-0028 keeps the models and the
    // internal judge ids inside the service; the panel version is what a
    // reader gets (the protocol doc may name a search tool, this page may not).
    const text = page("/changelog");
    expect(text).not.toMatch(/clef|jev|openai|perplexity|gpt-|pplx/i);
    expect(text).toContain("panel version 2026-12");
  });

  it("dates the edition and states the two version numbers", () => {
    const text = page("/changelog");
    expect(text).toContain(STANDARD_DATE);
    expect(text).toContain(SUITE_RELEASE_DATE);
    expect(text).toContain("Standard v1.0");
    expect(text).toContain("suite v2.2");
    expect(text).toContain("grants no status");
    expect(text).toContain("https://github.com/tarestandard/standard");
    // The release policy is public: windows, the pin, and the instrument.
    expect(text).toContain("Two decision windows a year");
    expect(text).toContain("pinned to the suite it bought");
    expect(text).toContain("panel change");
  });

  it("links the public repository from the footer", () => {
    expect(page("/scope")).toContain(
      '<a href="https://github.com/tarestandard/standard">Repository</a>',
    );
  });
});

describe("the published editions", () => {
  const edition = (date: string, file: string) =>
    readFileSync(join(process.cwd(), "standard-site", "editions", date, file), "utf8");

  it("freezes both past editions at their own dated path", () => {
    const v10 = readdirSync(join(process.cwd(), "standard-site", "editions", "2026-11-12"))
      .filter((file) => file.endsWith(".html"))
      .sort();
    const v22 = readdirSync(join(process.cwd(), "standard-site", "editions", "2026-11-13"))
      .filter((file) => file.endsWith(".html"))
      .sort();
    expect(v10).toHaveLength(6);
    expect(v22).toHaveLength(8);
    expect(v22).toContain("settled.html");
    expect(v10).not.toContain("settled.html");
  });

  it("keeps each edition's own text, not the live text", () => {
    const first = edition("2026-11-12", "jobs.html");
    const second = edition("2026-11-13", "jobs.html");
    expect(first).toContain("v2 (25 scenarios)");
    expect(second).toContain("v2.2 (29 scenarios)");
    expect(second).toContain("V2-A01");
  });

  it("rewrites internal links to stay inside the edition and banners the archive", () => {
    for (const [date, file] of [
      ["2026-11-12", "index.html"],
      ["2026-11-13", "index.html"],
    ] as const) {
      const html = edition(date, file);
      expect(html, date).toContain('class="edition-banner"');
      expect(html, date).toContain(`href="/editions/${date}/jobs"`);
      expect(html, date).not.toContain('href="/jobs"');
      expect(html, date).toContain(`/editions/${date}/assets/site.css`);
      // Canonical still names the live page, so the archive does not compete.
      expect(html, date).toContain(`<link rel="canonical" href="https://tarestandard.org/">`);
    }
  });

  it("ships the editions into the built assets and links the current one", () => {
    for (const date of ["2026-11-12", "2026-11-13"]) {
      expect(existsSync(join(outDir, "editions", date, "index.html")), date).toBe(true);
    }
    const live = page("/jobs");
    expect(live).toContain('<a href="/editions/2026-11-13/jobs">This edition (2026-11-13)</a>');
    expect(page("/scope")).toContain('href="/editions/2026-11-13/scope"');
  });
});

describe("provenance without access", () => {
  it("checks every page the build published, not a hand-kept list", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      expect(pageByUrl.has(url), url).toBe(true);
    }
    const built = [...pageByUrl.keys()].filter((url) => url !== "/404");
    expect(built.sort()).toEqual([...PUBLISHED_PAGE_URLS].sort());
  });

  it("prints no reference a reader cannot open", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      const text = plainText(html);
      // The repository is private: a file path, an ADR number, a repo document
      // name or a relative link into it is a dead reference on a public page.
      expect(text, url).not.toMatch(/\bsrc\/[\w./-]+\.(?:ts|js)\b/i);
      expect(text, url).not.toContain("ADR-");
      expect(text, url).not.toContain("PRODUCT.md");
      expect(text, url).not.toContain("GLOSSARY.md");
      expect(text, url).not.toMatch(/answer[\s-]?sheet/i);
      // Every internal link is rewritten to an absolute, published URL; a
      // relative href is a link into the private tree.
      expect(html, url).not.toMatch(/href="(?!https?:|mailto:|\/|#)[^"]*"/);
    }
  });

  it("keeps the claim without the file path", () => {
    const grades = plainText(page("/grades"));
    // The claim is a sentence in the body now, not a 90-character banner, but
    // it is still on the page and still says what the page does.
    expect(grades).toContain("The rule this file states is the rule the code computes.");
    expect(grades).toContain("The implementation is not published.");
  });

  it("names the public suite as the source of the job ids", () => {
    expect(plainText(page("/scope"))).toContain("is the source of the job ids");
  });
});

describe("links, claims and the error page", () => {
  it("resolves every internal link and anchor", () => {
    const urls = new Set(pageByUrl.keys());
    const sources = new Set(STANDARD_DOCS.map((doc) => `${doc.url}.md`));
    const anchorsByUrl = new Map([...pageByUrl].map(([url, html]) => [url, ids(html)]));

    for (const [url, html] of pageByUrl) {
      for (const href of hrefs(html)) {
        if (href.startsWith("/")) {
          const [path = "", hash = ""] = href.split("#");
          if (sources.has(path)) continue;
          if (path.startsWith("/editions/")) {
            const rel = path.slice("/editions/".length).replace(/\/$/, "");
            const base = resolve(process.cwd(), "standard-site", "editions", rel);
            expect(
              existsSync(`${base}.html`) || existsSync(join(base, "index.html")),
              `${url} links to ${href}`,
            ).toBe(true);
            continue;
          }
          expect(urls.has(path), `${url} links to ${href}`).toBe(true);
          if (hash) {
            expect(anchorsByUrl.get(path)?.has(decodeURIComponent(hash)), `${url} #${hash}`).toBe(
              true,
            );
          }
        } else if (href.startsWith("#")) {
          expect(
            anchorsByUrl.get(url)?.has(decodeURIComponent(href.slice(1))),
            `${url} ${href}`,
          ).toBe(true);
        } else {
          expect(href).not.toMatch(/^[^:]*\.md(?:#|$)/);
        }
      }
    }
  });

  it("serves each document's source Markdown from the site, not the private repo", () => {
    for (const doc of STANDARD_DOCS) {
      const file = `${doc.url.slice(1)}.md`;
      const served = readFileSync(join(outDir, file), "utf8");
      expect(served, file).toBe(readFileSync(join(process.cwd(), doc.source), "utf8"));
      expect(page(doc.url)).toContain(`href="${doc.url}.md"`);
    }

    // The repository is private: a link into it would 404 for every reader.
    for (const [url, html] of pageByUrl) {
      expect(html, url).not.toContain("github.com/gnoparus");
    }
    expect(page("/")).not.toContain(".md");
  });

  it("rejects unquoted claims on every published page", () => {
    for (const [url, html] of pageByUrl) {
      expect(findClaimWord(html), url).toBeNull();
    }
  });

  it("fails the claims gate with a readable message on an unquoted claim", () => {
    expect(() => assertClaimFree("scratch.html", "<p>We guarantee the outcome.</p>")).toThrow(
      /claims rule forbids the unquoted claim "guarantee"/,
    );
  });

  it("resolves every URL in the real sitemap and agent index", () => {
    expect(() =>
      assertEmittedUrlsResolve(outDir, {
        "sitemap.xml": readFileSync(join(outDir, "sitemap.xml"), "utf8"),
        "llms.txt": readFileSync(join(outDir, "llms.txt"), "utf8"),
      }),
    ).not.toThrow();
  });

  it("fails the URL gate when a sitemap entry has no file in the output", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    writeFileSync(join(scratch, "index.html"), "", "utf8");

    expect(() =>
      assertEmittedUrlsResolve(scratch, {
        "sitemap.xml": `<urlset><url><loc>${SITE_ORIGIN}/missing</loc></url></urlset>`,
      }),
    ).toThrow(/sitemap\.xml publishes .*\/missing.*writes no missing or missing\.html/);
  });

  it("fails the URL gate when the agent index links a source that was not written", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    writeFileSync(join(scratch, "index.html"), "", "utf8");

    expect(() =>
      assertEmittedUrlsResolve(scratch, {
        "llms.txt": `- [Jobs source](${SITE_ORIGIN}/missing.md)`,
      }),
    ).toThrow(/llms\.txt publishes .*\/missing\.md/);
  });

  it("resolves a citation anchor or a trailing full stop to the page it cites", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    writeFileSync(join(scratch, "index.html"), "", "utf8");
    writeFileSync(join(scratch, "scope.html"), "", "utf8");

    expect(() =>
      assertEmittedUrlsResolve(scratch, {
        "llms.txt":
          `Cite ${SITE_ORIGIN}/scope#how-to-cite-this. ` +
          `Read ${SITE_ORIGIN}/scope, then ${SITE_ORIGIN}/scope.`,
      }),
    ).not.toThrow();
  });

  it("checks the planned file set before anything is written", () => {
    expect(() =>
      assertEmittedUrlsResolve(
        join(tmpdir(), "no-such-directory-before-writing"),
        { "llms.txt": `- [Jobs](${SITE_ORIGIN}/jobs)` },
        new Set(["jobs.html"]),
      ),
    ).not.toThrow();
  });

  it("lets the standard quote its own prohibition without letting a claim through", () => {
    expect(findClaimWord('<p>Never "certified", "compliant", "guaranteed".</p>')).toBeNull();
    expect(findClaimWord("<p>Never 'certified', 'compliant', 'guaranteed'.</p>")).toBeNull();
    expect(findClaimWord("<p>Never &quot;certified&quot;, &quot;compliant&quot;.</p>")).toBeNull();
    expect(findClaimWord("<p>It's certified at the hotel's desk.</p>")).toBe("certified");
    expect(findClaimWord("<p>Offer policy-compliant recovery.</p>")).toBe("compliant");
    expect(findClaimWord("<p>We guarantee the outcome.</p>")).toBe("guarantee");
  });

  it("prints the split, the claims rule and the dated line on every page", () => {
    for (const html of pageByUrl.values()) {
      expect(html).toContain("The standard is public. The scan is a service.");
      expect(html).toContain("It grants no status and no accreditation.");
      expect(html).toContain(STANDARD_VERSION_LINE);
    }
  });

  it("serves a real 404 page with the standard's navigation", () => {
    const html = page("/404");
    expect(html).toContain("<title>Page not found · Tare Standard</title>");
    expect(plainText(html)).toContain("This page is not in the Code of Points.");
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toMatch(/noindex/i);
    for (const doc of STANDARD_DOCS) expect(html).toContain(`href="${doc.url}"`);
    expect(html).toContain('href="/"');
  });

  it("never prints a document count on the 404", () => {
    const text = plainText(page("/404"));
    expect(text).toContain("The standard publishes its documents.");
    expect(text).not.toMatch(
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:published\s+)?documents\b/i,
    );
  });

  it("writes a sitemap for the citable pages only", () => {
    const sitemap = readFileSync(join(outDir, "sitemap.xml"), "utf8");
    expect(sitemap).toContain(`${SITE_ORIGIN}/`);
    for (const doc of STANDARD_DOCS) expect(sitemap).toContain(`${SITE_ORIGIN}${doc.url}`);
    expect(sitemap).not.toContain("404");
    // Every published document changed when suite v2.2 shipped, so `lastmod`
    // is the content date, not the standard's earlier publication date.
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((match) => match[1]);
    expect(lastmods).toEqual(PUBLISHED_PAGE_URLS.map(() => SUITE_RELEASE_DATE));
    expect(sitemap).not.toContain(`<lastmod>${STANDARD_DATE}</lastmod>`);
  });
});
