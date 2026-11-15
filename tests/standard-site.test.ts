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
  FRONT_PAGE,
  LICENSE_NAME,
  LICENSE_URL,
  PUBLISHED_PAGE_URLS,
  PUBLISHED_STANDARDS,
  SITE_DATE,
  SITE_ORIGIN,
  SITE_VERSION_LINE,
  STANDARD_DOCS,
  STANDARD_VERSION_LINE,
  STANDARDS,
  type StandardDoc,
  type StandardEdition,
  TRADEMARK_URL,
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
  AIUC1_FAMILY_SIZES,
  assertFamilyBands,
  assertScopePrinted,
  familyPhrase,
  loadScopeCounts,
  parseScopeCounts,
  renderedFamilyCounts,
} from "../scripts/standard-scope";

const tempDirs: string[] = [];
let outDir: string;
let result: ReturnType<typeof buildStandardSite>;
let pageByUrl: Map<string, string>;

const AGENT = STANDARDS.find((standard) => standard.key === "agent") as StandardEdition;
const SHOPFRONT = STANDARDS.find((standard) => standard.key === "shopfront") as StandardEdition;
const ALL_DOCS = PUBLISHED_STANDARDS.flatMap((standard) => standard.docs);
const EDITION_BY_URL = new Map(
  PUBLISHED_STANDARDS.flatMap((standard) =>
    standard.docs.map((doc) => [doc.url, standard] as const),
  ),
);
const SITE_SOURCE = "docs/standard/agent/mappings.md";

function editionOf(url: string): StandardEdition {
  const edition = EDITION_BY_URL.get(url);
  if (!edition) throw new Error(`No standard publishes ${url}`);
  return edition;
}

function fileFor(url: string): string {
  return url === "/" ? "index.html" : url === "/404" ? "404.html" : `${url.slice(1)}.html`;
}

/** A Markdown source outside the repository, for a document a test rewrites. */
function tempDoc(name: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "tare-standard-doc-"));
  tempDirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, contents, "utf8");
  return path;
}

/** One standard whose document at `url` reads a different source. */
function withSource(standard: StandardEdition, url: string, source: string): StandardEdition {
  if (!standard.docs.some((doc) => doc.url === url)) {
    throw new Error(`No document at ${url} in ${standard.name}, so the rewrite would be a no-op`);
  }
  return {
    ...standard,
    docs: standard.docs.map((doc) => (doc.url === url ? { ...doc, source } : doc)),
  };
}

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "tare-standard-"));
  tempDirs.push(outDir);
  result = buildStandardSite({ outDir });
  pageByUrl = new Map(
    result.pages.map((url) => [url, readFileSync(join(outDir, fileFor(url)), "utf8")]),
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

/** The dated line the page at `url` prints: its edition's, or the site's. */
function lineFor(url: string): string {
  return url === "/" || url === "/404" ? SITE_VERSION_LINE : editionOf(url).versionLine;
}

function dateFor(url: string): string {
  return url === "/" || url === "/404" ? SITE_DATE : editionOf(url).date;
}

/** The dated line as the frame prints it: the date wrapped in <time>. */
function datedLineFor(url: string): string {
  const date = dateFor(url);
  return lineFor(url).replace(date, `<time datetime="${date}">${date}</time>`);
}

describe("the dated record", () => {
  const asPage = (html: string, standard: StandardEdition = AGENT, url = "/agent"): Page => ({
    url,
    file: url === "/" ? "index.html" : `${url.slice(1)}.html`,
    html,
    anchors: new Set<string>(),
    standard,
  });
  // The shipped frame wraps the date in <time>; `plainHead` is the shape the
  // negative cases use so the date-as-<time> gate can still be exercised.
  const head = (standard: StandardEdition = AGENT): string =>
    `<span class="running-version">${standard.versionLine.replace(standard.date, `<time datetime="${standard.date}">${standard.date}</time>`)}</span>`;
  const plainHead = (standard: StandardEdition = AGENT): string =>
    `<span class="running-version">${standard.versionLine}</span>`;
  const stamp = (date: string): string => `<time datetime="${date}">${date}</time>`;
  const sitemapFor = (url = "/agent", date = AGENT.date): string =>
    `<urlset><url><loc>${SITE_ORIGIN}${url}</loc><lastmod>${date}</lastmod></url></urlset>`;
  const llms = PUBLISHED_STANDARDS.map((standard) => `Version: ${standard.versionLine}`).join("\n");
  const ld = (dates: { published?: string; modified?: string } = {}): string =>
    `<script type="application/ld+json">${JSON.stringify({
      datePublished: dates.published ?? AGENT.date,
      dateModified: dates.modified ?? AGENT.date,
    })}</script>`;

  it("derives one line from one name, version and date", () => {
    expect(STANDARD_VERSION_LINE).toBe(`Tare Agent Standard v1.0 · published ${AGENT.date}`);
    expect(STANDARD_VERSION_LINE).not.toMatch(/suite/i);
    expect(SITE_VERSION_LINE).toBe(`Tare Standard · published ${SITE_DATE}`);
  });

  it("passes only when every surface prints the derived record", () => {
    expect(() =>
      assertDatedRecord([asPage(head() + stamp(AGENT.date) + ld())], {
        sitemap: sitemapFor(),
        llms,
      }),
    ).not.toThrow();
  });

  it("rejects a page without the derived running head", () => {
    expect(() =>
      assertDatedRecord([asPage("<html><body>no head</body></html>")], {
        sitemap: sitemapFor(),
        llms,
      }),
    ).toThrow(/running head/);
  });

  it("rejects a page that prints another standard's line", () => {
    expect(() =>
      assertDatedRecord([asPage(plainHead(SHOPFRONT) + stamp(AGENT.date) + ld())], {
        sitemap: sitemapFor(),
        llms,
      }),
    ).toThrow(/running head/);
  });

  it("dates a page by its own edition when two editions carry different days", () => {
    const later: StandardEdition = {
      ...SHOPFRONT,
      date: "2026-12-01",
      versionLine: `${SHOPFRONT.name} ${SHOPFRONT.version} · published 2026-12-01`,
    };
    const html = head(later);
    const rightLd = ld({ published: later.date, modified: later.date });
    const wrongLd = ld({ published: SHOPFRONT.date, modified: SHOPFRONT.date });
    const indexes = {
      sitemap: sitemapFor("/shopfront", later.date),
      llms: `Version: ${later.versionLine}`,
    };
    const shopfrontPage = (body: string) => asPage(body, later, "/shopfront");

    // Equal dates on the committed pair cannot catch a leaked day; the gate is
    // exercised here with two editions whose days differ.
    expect(() =>
      assertDatedRecord([shopfrontPage(html + stamp(later.date) + wrongLd)], indexes, [later]),
    ).toThrow(/structured/);
    expect(() =>
      assertDatedRecord(
        [shopfrontPage(html + stamp(later.date) + rightLd)],
        { sitemap: sitemapFor("/shopfront", SHOPFRONT.date), llms: indexes.llms },
        [later],
      ),
    ).toThrow(/sitemap/);
    expect(() =>
      assertDatedRecord(
        [shopfrontPage(html + stamp(later.date) + rightLd)],
        { sitemap: indexes.sitemap, llms: `Version: ${SHOPFRONT.versionLine}` },
        [later],
      ),
    ).toThrow(/llms/);
  });

  it("carries the date as a <time> in the running head", () => {
    expect(head()).toContain(`<time datetime="${AGENT.date}">${AGENT.date}</time>`);
    // A line without the <time> wrapper is not the frame the build prints.
    expect(() =>
      assertDatedRecord([asPage(plainHead() + ld())], { sitemap: sitemapFor(), llms }),
    ).toThrow(/running head/);
  });

  it("rejects a sitemap that dates the document by another day", () => {
    expect(() =>
      assertDatedRecord([asPage(head() + stamp(AGENT.date) + ld())], {
        sitemap: sitemapFor("/agent", "2026-11-12"),
        llms,
      }),
    ).toThrow(/sitemap dates/);
  });

  it("rejects a sitemap that lists a page this build does not write", () => {
    expect(() =>
      assertDatedRecord([asPage(head() + stamp(AGENT.date) + ld())], {
        sitemap: sitemapFor("/missing"),
        llms,
      }),
    ).toThrow(/does not write/);
  });

  it("rejects an agent index without each standard's derived line", () => {
    expect(() =>
      assertDatedRecord([asPage(head() + stamp(AGENT.date) + ld())], {
        sitemap: sitemapFor(),
        llms: `Version: ${STANDARD_VERSION_LINE}`,
      }),
    ).toThrow(/dated line for Tare Shopfront Standard/);
  });

  it("rejects structured data that dates the record another day", () => {
    const wrong = ld({ modified: "2026-11-12" });
    expect(() =>
      assertDatedRecord([asPage(head() + stamp(AGENT.date) + wrong)], {
        sitemap: sitemapFor(),
        llms,
      }),
    ).toThrow(/structured/);
  });

  it("keeps the standard's name and version in the record the guard checks", () => {
    for (const standard of PUBLISHED_STANDARDS) {
      expect(standard.versionLine).toContain(standard.name);
      expect(standard.versionLine).toContain(standard.version);
    }
  });
});

describe("the licence and the status of the document", () => {
  it("links the reuse terms from every page and names them in the colophon", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      expect(html, url).toContain(`<link rel="license" href="${LICENSE_URL}">`);
      expect(html, url).toContain(LICENSE_NAME);
      expect(html, url).toContain(ERRATA_URL);
      const status =
        url === "/"
          ? "Status: this site publishes the standards listed at its contents"
          : `Status: this is the first published edition of ${editionOf(url).name}.`;
      expect(html, url).toContain(status);
    }
  });

  it("publishes the licence in the structured data", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      const raw = page(url).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      const data = JSON.parse(raw ?? "{}") as { license?: unknown };
      expect(data.license, url).toBe(LICENSE_URL);
    }
  });

  it("permits reuse with attribution and reserves the marks", () => {
    const html = page("/");
    expect(html).toContain("share it and adapt it with attribution");
    expect(html).toContain("the marks are reserved");
    expect(html).toContain(TRADEMARK_URL);
    expect(html).not.toContain("derivatives are not permitted");
  });
});

describe("the frozen edition", () => {
  it("publishes 2026-11-14 beside the live pages", () => {
    const source = join(process.cwd(), "standard-site", "editions", "2026-11-14");
    expect(existsSync(join(source, "index.html"))).toBe(true);
    expect(existsSync(join(outDir, "editions", "2026-11-14", "index.html"))).toBe(true);
    for (const url of PUBLISHED_PAGE_URLS) {
      const file = url === "/" ? "index.html" : `${url.slice(1)}.html`;
      expect(existsSync(join(source, file)), url).toBe(true);
    }
  });
});

describe("the published page set", () => {
  it("is exactly the intended list", () => {
    const files = readdirSync(outDir, { recursive: true })
      .map(String)
      // The frozen edition is a copy of a release, not a page this build
      // publishes; it is checked by its own test below.
      .filter((file) => file.endsWith(".html") && !file.startsWith("editions/"))
      .sort();

    expect(files).toEqual([
      "404.html",
      "accessibility.html",
      "agent.html",
      "agent/changelog.html",
      "agent/grades.html",
      "agent/jobs.html",
      "agent/protocol.html",
      "agent/scope.html",
      "agent/settled.html",
      "index.html",
      "shopfront.html",
      "shopfront/capabilities.html",
      "shopfront/changelog.html",
      "shopfront/evidence.html",
      "shopfront/jobs.html",
      "shopfront/levels.html",
      "shopfront/scope.html",
    ]);
    expect(STANDARD_DOCS.map((doc) => doc.url)).toEqual([
      "/agent",
      "/agent/jobs",
      "/agent/grades",
      "/agent/scope",
      "/agent/settled",
      "/agent/changelog",
      "/agent/protocol",
    ]);
    expect(SHOPFRONT.docs.map((doc) => doc.url)).toEqual([
      "/shopfront",
      "/shopfront/levels",
      "/shopfront/capabilities",
      "/shopfront/evidence",
      "/shopfront/jobs",
      "/shopfront/scope",
      "/shopfront/changelog",
    ]);
    expect([...PUBLISHED_PAGE_URLS]).toEqual([
      "/",
      ...STANDARD_DOCS.map((doc) => doc.url),
      ...SHOPFRONT.docs.map((doc) => doc.url),
    ]);
    expect(result.pages).toEqual([...PUBLISHED_PAGE_URLS, "/404", "/accessibility"]);
  });

  it("accounts for every Markdown file in docs/standard", () => {
    for (const standard of PUBLISHED_STANDARDS) {
      const all = readdirSync(join(process.cwd(), "docs/standard", standard.key))
        .filter((file) => file.endsWith(".md"))
        .map((file) => `docs/standard/${standard.key}/${file}`)
        .sort();
      expect(all, standard.key).toEqual([...standard.docs.map((doc) => doc.source)].sort());
    }
    // Nothing sits loose at docs/standard/: every page belongs to a published
    // standard. Regular files only, so a stray draft of any extension fails here
    // and a future shelf inside a directory does not.
    const loose = readdirSync(join(process.cwd(), "docs/standard"), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    expect(loose).toEqual([]);
  });

  it("does not publish a draft or the attack pages", () => {
    const sources = ALL_DOCS.map((doc) => doc.source);
    expect(sources.some((source) => source.includes("draft"))).toBe(false);
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

  it("does not publish a standard whose publication switch is off", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    const hiddenDoc: StandardDoc = {
      ...(SHOPFRONT.docs[0] as StandardDoc),
      url: "/hidden",
    };
    const hidden: StandardEdition = {
      ...SHOPFRONT,
      name: "Hidden Standard",
      base: "/hidden",
      versionLine: "Hidden Standard v1.0 · published 2026-11-14",
      claim: "A standard the site does not publish.",
      citeUrl: "/hidden#the-claim",
      docs: [hiddenDoc],
      published: false,
    };
    const built = buildStandardSite({
      outDir: scratch,
      standards: [...PUBLISHED_STANDARDS, hidden],
    });

    expect(built.pages).not.toContain("/hidden");
    expect(existsSync(join(scratch, "hidden.html"))).toBe(false);
    expect(readFileSync(join(scratch, "llms.txt"), "utf8")).not.toContain("Hidden Standard");
    expect(readFileSync(join(scratch, "sitemap.xml"), "utf8")).not.toContain("/hidden");
  });

  it("fails the build when a standard publishes no changelog", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    const changelog = AGENT.docs.find((doc) => doc.nav === "Changelog");
    if (!changelog) throw new Error("The agent standard has no changelog");
    const sansChangelog: StandardEdition = {
      ...AGENT,
      // Keep the document for the 404 recovery list; stop calling it a
      // changelog so the feed gate is the first thing that notices.
      docs: AGENT.docs.map((doc) => (doc === changelog ? { ...doc, nav: "Changes" } : doc)),
    };
    expect(() =>
      buildStandardSite({ outDir: scratch, standards: [sansChangelog, SHOPFRONT] }),
    ).toThrow(/publishes no changelog/);
  });

  it("orders a multi-entry feed newest first and links each dated anchor", () => {
    const directory = mkdtempSync(join(tmpdir(), "tare-changelog-"));
    tempDirs.push(directory);
    const source = join(directory, "changelog-two.md");
    writeFileSync(
      source,
      "# Changelog\n\n## 2026-11-01 — Older edition\n\nOlder prose.\n\n## 2026-11-14 — Newer edition\n\nNewer prose.\n",
      "utf8",
    );
    const changelog = AGENT.docs.find((doc) => doc.nav === "Changelog");
    if (!changelog) throw new Error("The agent standard has no changelog");
    const twoEditions: StandardEdition = {
      ...AGENT,
      docs: AGENT.docs.map((doc) => (doc === changelog ? { ...doc, source } : doc)),
    };
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    buildStandardSite({ outDir: scratch, standards: [twoEditions, SHOPFRONT] });

    const xml = readFileSync(join(scratch, "agent/changelog.xml"), "utf8");
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1] ?? "");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toContain("2026-11-14 — Newer edition");
    expect(entries[1]).toContain("2026-11-01 — Older edition");
    expect(entries[0]).toContain("#2026-11-14-newer-edition");
    expect(entries[1]).toContain("#2026-11-01-older-edition");
    expect(xml).toContain("<updated>2026-11-14T00:00:00Z</updated>");
  });

  it("fails the build when a dated heading uses the wrong dash", () => {
    const directory = mkdtempSync(join(tmpdir(), "tare-changelog-"));
    tempDirs.push(directory);
    const source = join(directory, "changelog-dash.md");
    writeFileSync(source, "# Changelog\n\n## 2026-12-01 – Title\n\nBody.\n", "utf8");
    const changelog = AGENT.docs.find((doc) => doc.nav === "Changelog");
    if (!changelog) throw new Error("The agent standard has no changelog");
    const wrongDash: StandardEdition = {
      ...AGENT,
      docs: AGENT.docs.map((doc) => (doc === changelog ? { ...doc, source } : doc)),
    };
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    expect(() => buildStandardSite({ outDir: scratch, standards: [wrongDash, SHOPFRONT] })).toThrow(
      /dated but not/,
    );
  });

  it("fails the build when a changelog has no dated heading", () => {
    const directory = mkdtempSync(join(tmpdir(), "tare-changelog-"));
    tempDirs.push(directory);
    const source = join(directory, "changelog.md");
    writeFileSync(source, "# Changelog\n\nUndated prose.\n", "utf8");
    const changelog = AGENT.docs.find((doc) => doc.nav === "Changelog");
    if (!changelog) throw new Error("The agent standard has no changelog");
    const undated: StandardEdition = {
      ...AGENT,
      docs: AGENT.docs.map((doc) => (doc === changelog ? { ...doc, source } : doc)),
    };
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    expect(() => buildStandardSite({ outDir: scratch, standards: [undated, SHOPFRONT] })).toThrow(
      /no dated/,
    );
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

    expect(() =>
      buildStandardSite({
        outDir: scratch,
        standards: [{ ...AGENT, docs: [missing] }],
      }),
    ).toThrow(/Published document is missing/);
  });
});

describe.each(ALL_DOCS)("the published document $source", (doc) => {
  const standard = editionOf(doc.url);
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

  it("prints the edition it belongs to", () => {
    expect(html()).toContain(
      `<span class="running-version">${standard.versionLine.replace(standard.date, `<time datetime="${standard.date}">${standard.date}</time>`)}</span>`,
    );
    expect(html()).toContain(`<time datetime="${standard.date}">${standard.date}</time>`);
  });
});

describe("the shopfront's capability count", () => {
  /** The lead cell of every table row between two heading ids on a page. */
  function labelsBetween(html: string, from: string, to: string): string[] {
    const start = html.indexOf(`id="${from}"`);
    const end = html.indexOf(`id="${to}"`, start);
    expect(start, from).toBeGreaterThan(-1);
    expect(end, to).toBeGreaterThan(start);
    return [...html.slice(start, end).matchAll(/<td><strong>([^<]+)<\/strong><\/td>/g)].map(
      (match) => match[1] ?? "",
    );
  }

  it("prints four capabilities and two cross-cutting checks, never five of either", () => {
    const html = page("/shopfront");
    expect(labelsBetween(html, "the-four-capabilities", "the-two-cross-cutting-checks")).toEqual([
      "Find",
      "Act",
      "Confirm",
      "Recover",
    ]);
    expect(labelsBetween(html, "the-two-cross-cutting-checks", "who-this-is-for")).toEqual([
      "Admit",
      "Disclose",
    ]);
  });

  it("counts the same way on the capabilities page and the scope page", () => {
    const capabilities = plainText(page("/shopfront/capabilities"));
    expect(capabilities).toMatch(/Two checks run across all four [^.]*Admit[^.]*Disclose/);
    // The introduction used to name disclose alone, which is how the count drifted.
    expect(capabilities).not.toContain("Disclose runs across all four");

    const scope = plainText(page("/shopfront/scope"));
    expect(scope).toContain("Four capabilities and two cross-cutting checks");
    expect(scope).not.toContain("one cross-cutting check");
  });
});

describe("the chooser at the root", () => {
  it("states the site and links both standards with their claims, versions and dates", () => {
    const html = page("/");
    expect(html).toContain(`<title>${FRONT_PAGE.title}</title>`);
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/">`);
    expect(html).toContain(
      SITE_VERSION_LINE.replace(SITE_DATE, `<time datetime="${SITE_DATE}">${SITE_DATE}</time>`),
    );
    expect(html).toContain("The Code of Points for AI agents and the surfaces they use.");
    for (const standard of PUBLISHED_STANDARDS) {
      expect(html, standard.key).toContain(`href="${standard.base}"`);
      expect(html, standard.key).toContain(standard.name);
      expect(html, standard.key).toContain(standard.claim);
      expect(html, standard.key).toContain(
        `<span class="standard-version">${standard.version}</span> · published <time datetime="${standard.date}">${standard.date}</time>`,
      );
    }
    expect(html).not.toMatch(/noindex/i);
  });

  it("publishes each standard's entry and its six documents, not the whole site", () => {
    const html = page("/");
    const start = html.indexOf('<section class="standards"');
    const body = html.slice(start, html.indexOf("</section>", start));
    const links = [...body.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1] ?? "");
    const expected = PUBLISHED_STANDARDS.flatMap((standard) => [
      standard.base,
      ...standard.docs.filter((doc) => doc.url !== standard.base).map((doc) => doc.url),
    ]);
    expect(links).toEqual(expected);
    expect(links).toHaveLength(14);
  });
});

describe("the scope page", () => {
  it("keeps the scope section readable and linkable", () => {
    const html = page("/agent/scope");
    const text = plainText(html);

    expect(html).toContain('id="scope-what-this-suite-does-and-does-not-test"');
    expect(text).toContain("Scope — what this suite does and does not test");
    expect(text).toContain("6 of 50");
    expect(text).toContain("0 is a fact about the suite, a hole we are not hiding.");
    expect(text).toContain("44 of the 50 requirements have no row.");
    expect(text).toContain("A Data & Privacy (0 of 9)");
    expect(text).toContain("B Security (0 of 10)");
    expect(text).toContain("E Accountability (0 of 16)");
    expect(text).toContain("F Society (0 of 2)");
  });

  it("renders the AIUC-1 scope table with one row per named requirement", () => {
    const html = page("/agent/scope");
    const section = html.slice(html.indexOf("scope-what-this-suite-does-and-does-not-test"));
    const rows = [...section.matchAll(/<tr>/g)].length;
    expect(rows).toBeGreaterThanOrEqual(6);
    expect(section).toContain("Prevent harmful outputs");
    expect(section).toContain("Prevent hallucinated outputs");
  });

  it("draws the scope beside the Family table it counts", () => {
    const html = page("/agent/scope");
    const cells = html.match(/class="tally-cell/g) ?? [];
    const filled = html.match(/class="tally-cell tally-cell--with/g) ?? [];
    expect(cells).toHaveLength(50);
    expect(filled).toHaveLength(6);
    // The figure is glued to the Family table: the nearest table before it is
    // the Family table, not the job-by-job crosswalk that precedes it.
    const tallyAt = html.indexOf('class="tally"');
    const lastTable = html.lastIndexOf("<table", tallyAt);
    const nearest = html.slice(lastTable, tallyAt);
    expect(nearest).toContain('<th scope="col">Family</th>');
    expect(nearest).toContain('<th scope="col">AIUC-1 requirement</th>');
    expect(nearest).not.toContain('<th scope="col">Scenario</th>');
    expect(tallyAt).toBeLessThan(html.indexOf('id="what-this-mapping-does-not-prove"'));
    // Six family bands, with the four zero families visible as empty bands.
    const labels = [...html.matchAll(/class="tally-band-label">([\s\S]*?)<\/p>/g)].map((match) =>
      plainText(match[1] ?? ""),
    );
    expect(labels).toHaveLength(6);
    expect(labels[0]).toContain("A Data & Privacy 0 of 9");
    expect(labels[1]).toContain("B Security 0 of 10");
    expect(labels[2]).toContain("C Safety 4 of 10");
    expect(labels[3]).toContain("D Reliability 2 of 3");
    expect(labels[4]).toContain("E Accountability 0 of 16");
    expect(labels[5]).toContain("F Society 0 of 2");
    expect(plainText(html)).toContain("6 of 50");
    expect(plainText(html)).toContain("four in Safety and two in Reliability");
  });
});

describe("the accessibility statement", () => {
  it("publishes one site-level page and links it from every page", () => {
    const html = page("/accessibility");
    expect(html).toContain('<main id="main" class="statement">');
    expect(html).toContain("<h1>Accessibility</h1>");
    // The site-level page carries the same frame facts as the standard pages.
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/accessibility">`);
    expect(html).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/accessibility">`);
    expect(html).toContain(
      '<meta property="og:image" content="https://tarestandard.org/assets/og.png">',
    );
    expect(html).toContain('<span class="running-section">Accessibility</span>');
    expect(html).toContain('<a class="skip" href="#main">Skip to the contents</a>');
    expect(html).toContain("WCAG 2.2 Level AA");
    expect(html).toContain(`Reviewed <time datetime="${SITE_DATE}">${SITE_DATE}</time>`);
    expect(html).toContain("https://github.com/tarestandard/standard/issues");
    // It is a footer link on every page, not a fourth top-level nav item:
    // the chooser's first screen stays for the two-standard decision.
    expect(html).toContain('<a href="/accessibility">Accessibility</a>');
    // One WebPage, not a second WebSite claim for the same site.
    expect(html).toContain('"@type":"WebPage"');
    expect(html).not.toContain('"@type":"WebSite"');
    for (const url of pageByUrl.keys()) {
      expect(page(url), url).toContain('<a href="/accessibility">Accessibility</a>');
    }
    expect(readFileSync(join(outDir, "sitemap.xml"), "utf8")).toContain(
      `${SITE_ORIGIN}/accessibility`,
    );
    expect(readFileSync(join(outDir, "llms.txt"), "utf8")).toContain(
      `${SITE_ORIGIN}/accessibility`,
    );
    // The prose is published in full beside the page, with the same review
    // date the page prints — the Markdown's "printed above" sentence is true.
    const published = readFileSync(join(outDir, "accessibility.md"), "utf8");
    expect(published.startsWith(`> Reviewed ${SITE_DATE}.`)).toBe(true);
    expect(
      published.endsWith(readFileSync(join(process.cwd(), "docs/site/accessibility.md"), "utf8")),
    ).toBe(true);
    expect(html).toContain('<a href="/accessibility.md">Source (Markdown)</a>');
  });

  it("records a target, a check, a limitation and a way to report", () => {
    const text = plainText(page("/accessibility"));
    for (const phrase of [
      "The target is WCAG 2.2 Level AA.",
      "How the site is checked",
      "Known limitations",
      "Reporting a barrier",
      "Every report is read.",
    ]) {
      expect(text).toContain(phrase);
    }
  });
});

describe("the changelog feeds", () => {
  it("publishes one dated Atom feed per standard and links it from the page", () => {
    const feeds = [
      { url: "/agent/changelog", file: "agent/changelog.xml", name: "Tare Agent Standard" },
      {
        url: "/shopfront/changelog",
        file: "shopfront/changelog.xml",
        name: "Tare Shopfront Standard",
      },
    ];
    for (const { url, file, name } of feeds) {
      const xml = readFileSync(join(outDir, file), "utf8");
      expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
      expect(xml).toContain(`<title>${name} — changes</title>`);
      expect(xml).toContain(
        `<link rel="self" type="application/atom+xml" href="${SITE_ORIGIN}${url}.xml"/>`,
      );
      expect(xml).toContain(`<link rel="alternate" type="text/html" href="${SITE_ORIGIN}${url}"/>`);
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
      expect(entries.length, file).toBeGreaterThan(0);
      // The feed's updated stamp is the newest dated heading, not a typed date.
      const doc = ALL_DOCS.find((candidate) => candidate.url === url);
      if (!doc) throw new Error(`No document for ${url}`);
      const changelog = readFileSync(join(process.cwd(), doc.source), "utf8");
      const dates = [...changelog.matchAll(/^## (\d{4}-\d{2}-\d{2}) — /gm)]
        .map((match) => match[1] ?? "")
        .sort();
      expect(xml).toContain(`<updated>${dates.at(-1)}T00:00:00Z</updated>`);
      const entryDates = entries.map(
        (entry) => /<updated>(\d{4}-\d{2}-\d{2})T/.exec(entry[1] ?? "")?.[1] ?? "",
      );
      for (let index = 1; index < entryDates.length; index += 1) {
        const previous = entryDates[index - 1];
        const current = entryDates[index];
        expect(
          previous !== undefined && current !== undefined && previous >= current,
          `${file} newest first`,
        ).toBe(true);
      }
      for (const entry of entries) {
        const link = /<link rel="alternate" type="text\/html" href="([^"]+)"/.exec(entry[1] ?? "");
        expect(link, file).not.toBeNull();
        const href = link?.[1] ?? "";
        expect(href.startsWith(`${SITE_ORIGIN}${url}`), href).toBe(true);
        expect(entry[1]).toContain('<summary type="text">');
        // The dated heading is the anchor: a feed entry that loses it has
        // quietly stopped pointing at the change it announces.
        expect(href, file).toContain("#");
        const fragment = decodeURIComponent(href.split("#")[1] ?? "");
        expect(page(url), `${file} #${fragment}`).toContain(`id="${fragment}"`);
      }
      const html = page(url);
      expect(html).toContain(
        `<link rel="alternate" type="application/atom+xml" title="${name} — changes" href="${url}.xml">`,
      );
      expect(html).toContain("Subscribe to changes (Atom)");
      expect(readFileSync(join(outDir, "llms.txt"), "utf8")).toContain(`${SITE_ORIGIN}${url}.xml`);
    }
    // A feed is a file, not a page: it is not in the page set or the sitemap.
    expect([...pageByUrl.keys()]).not.toContain("/agent/changelog.xml");
    expect(readFileSync(join(outDir, "sitemap.xml"), "utf8")).not.toContain(".xml");
  });
});

describe("the citation copy control", () => {
  it("offers one button per citation target and a script that can be blocked", () => {
    const html = page("/agent");
    expect(html).toContain('<script src="/assets/copy.js" defer></script>');
    const buttons = [
      ...html.matchAll(
        /<button class="copy-button" type="button" data-copy="([^"]+)" data-copy-label="([^"]+)">/g,
      ),
    ];
    expect(buttons.map((match) => match[2])).toEqual(["Citation", "URL"]);
    for (const match of buttons) {
      expect(html).toContain(`id="${match[1]}"`);
    }
    expect(html).toContain('role="status" aria-live="polite"');
    // Without the script the citation remains a selectable string.
    expect(html).toContain('class="cite-line"');
    const script = readFileSync(join(outDir, "assets", "copy.js"), "utf8");
    const source = readFileSync(join(process.cwd(), "standard-site", "copy.js"), "utf8");
    expect(script).toBe(source);
    expect(script).toContain("navigator.clipboard.writeText");
    expect(script).toContain('document.execCommand("copy")');
    expect(script).not.toContain("import ");
    expect(script).not.toContain("require(");
  });
});

describe("the published numerals", () => {
  it("derives the scope split, the no-row count and the sentence from the Family table", () => {
    const counts = loadScopeCounts();
    expect(counts.total).toBe(50);
    expect(counts.covered).toBe(6);
    expect(counts.noRow).toBe(44);
    expect(counts.zeroFamilies).toBe(4);
    expect(counts.families).toEqual([
      { letter: "C", name: "Safety", count: 4 },
      { letter: "D", name: "Reliability", count: 2 },
    ]);

    // The split's numerals are the table's, not a second typing of them.
    expect(familyPhrase(counts)).toBe("four in Safety and two in Reliability");

    // The authored prose is gated against the same parse by assertScopePrinted.
    expect(() =>
      assertScopePrinted({
        scopeHtml: page("/agent/scope"),
        markdown: readFileSync(join(process.cwd(), SITE_SOURCE), "utf8"),
        counts,
      }),
    ).not.toThrow();
  });

  it("accounts for all fifty requirements in six families, and matches the sizes the page prints", () => {
    const counts = loadScopeCounts();
    const total = AIUC1_FAMILY_SIZES.reduce((sum, family) => sum + family.size, 0);
    expect(total).toBe(counts.total);
    expect(AIUC1_FAMILY_SIZES.map((family) => family.letter)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);

    // Every family name is printed in the page's own table or prose; the
    // constant must not drift from the words the reader sees.
    const markdown = readFileSync(join(process.cwd(), SITE_SOURCE), "utf8");
    for (const family of AIUC1_FAMILY_SIZES) {
      expect(markdown, family.letter).toContain(`${family.letter} ${family.name}`);
      if (family.letter === "C" || family.letter === "D") continue;
      expect(markdown, family.letter).toContain(
        `${family.letter} ${family.name} (0 of ${family.size})`,
      );
    }
  });

  it("refuses a family band the tally cannot place", () => {
    const counts = loadScopeCounts();
    expect(() => assertFamilyBands(counts)).not.toThrow();
    expect(() =>
      assertFamilyBands({
        ...counts,
        families: [{ letter: "G", name: "Other", count: 1 }],
      }),
    ).toThrow(/names G/);
    expect(() =>
      assertFamilyBands({
        ...counts,
        families: [{ letter: "C", name: "Safety", count: 11 }],
      }),
    ).toThrow(/11 rows/);
    expect(() => assertFamilyBands({ ...counts, covered: 5, families: counts.families })).toThrow(
      /sum to 6/,
    );
  });

  it("reads a changed Family table into a changed split, not a stale sentence", () => {
    const markdown = readFileSync(join(process.cwd(), SITE_SOURCE), "utf8");
    const withFifthSafetyRow = markdown.replace(
      "| D Reliability | D001 Prevent hallucinated outputs |",
      "| C Safety | C006 Output vulnerabilities | HFD-S22 | observed |\n| D Reliability | D001 Prevent hallucinated outputs |",
    );
    const counts = parseScopeCounts(withFifthSafetyRow);

    expect(counts.covered).toBe(7);
    expect(counts.noRow).toBe(43);
    expect(counts.families).toEqual([
      { letter: "C", name: "Safety", count: 5 },
      { letter: "D", name: "Reliability", count: 2 },
    ]);
    expect(familyPhrase(counts)).toBe("five in Safety and two in Reliability");
    expect(counts.noRow).toBe(43);
  });

  it("counts distinct requirement ids and refuses a duplicated row", () => {
    const markdown = readFileSync(join(process.cwd(), SITE_SOURCE), "utf8");
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
      "| none | C001 Risk taxonomy | HFD-S22 | observed |\n";
    expect(() => parseScopeCounts(markdown)).toThrow(/row without a family/);
  });

  it("refuses a scanned Family table with no tbody", () => {
    expect(() =>
      renderedFamilyCounts(
        "<table><thead><tr><th>Family</th><th>AIUC-1 requirement</th></tr></thead></table>",
      ),
    ).toThrow(/no <tbody>/);
  });

  it("fails the build when the page prints a split the table contradicts", () => {
    const counts = loadScopeCounts();
    const markdown = readFileSync(join(process.cwd(), SITE_SOURCE), "utf8").replace(
      "44 of the 50 requirements have no row",
      "43 of the 50 requirements have no row",
    );

    expect(() => assertScopePrinted({ scopeHtml: page("/agent/scope"), markdown, counts })).toThrow(
      /does not print the scope derived from its Family table/,
    );
  });

  it("fails the build when the page's typed family split drifts", () => {
    const counts = loadScopeCounts();
    const markdown = readFileSync(join(process.cwd(), SITE_SOURCE), "utf8").replace(
      "four in Safety and two in Reliability",
      "three in Safety and three in Reliability",
    );

    expect(() => assertScopePrinted({ scopeHtml: page("/agent/scope"), markdown, counts })).toThrow(
      /four in Safety and two in Reliability/,
    );
  });

  it("fails the build when the rendered Family table disagrees with the parse", () => {
    const counts = loadScopeCounts();
    const scope = page("/agent/scope").replace("<td>C Safety</td>", "<td>D Reliability</td>");

    expect(() =>
      assertScopePrinted({
        scopeHtml: scope,
        markdown: readFileSync(join(process.cwd(), SITE_SOURCE), "utf8"),
        counts,
      }),
    ).toThrow(/\/agent\/scope Family table does not match the mappings parse/);
  });

  it("derives the scope metadata from the same table", () => {
    const counts = loadScopeCounts();
    const scopeDoc = AGENT.docs.find((doc) => doc.url === "/agent/scope");
    expect(scopeDoc?.description).toContain(
      `${counts.covered} of ${counts.total} AIUC-1 requirements`,
    );
    expect(scopeDoc?.summary).toContain(`${counts.covered} of ${counts.total} AIUC-1 requirements`);
  });
});

describe("the published instrument", () => {
  it("pins the published rule to the code constants it mirrors", () => {
    const html = page("/agent/grades");
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
    // the number the published instrument applies.
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
    const text = plainText(page("/agent/grades"));
    expect(text).toContain("18-turn judge brevet (2026-11)");
    expect(text).toContain("72%");
    expect(text).toContain("2026-12 panel's cutover");
    expect(text).toContain("43-turn set");
    expect(text).toContain("different denominators");
    expect(text).not.toContain("current 18-turn calibration set");
  });

  it("states that the protocol is not a result and fixes one sample size", () => {
    const text = plainText(page("/agent/protocol"));
    expect(text).toContain("Sample (10 bots)");
    expect(text).toContain("at least 4 of the 10 bots");
    expect(text).toContain("This page is the protocol, not a result");
    expect(text).toContain("No dated result of the test is published");
    expect(text).not.toContain("8–10 bots");
  });

  it("keeps the scoring-rules claim now that the rule is published", () => {
    expect(page("/agent/jobs")).toContain("and the scoring rules");
    expect(plainText(page("/agent/grades"))).toContain("How a score is computed");
  });
});

describe("the indexes and the changelogs", () => {
  it("publishes llms.txt listing both standards and every document's source", () => {
    const index = readFileSync(join(outDir, "llms.txt"), "utf8");
    expect(index).toContain("# Tare Standard");
    for (const standard of PUBLISHED_STANDARDS) {
      expect(index).toContain(`## ${standard.name}`);
      expect(index).toContain(`Version: ${standard.versionLine}`);
      for (const doc of standard.docs) {
        expect(index).toContain(`${SITE_ORIGIN}${doc.url}`);
        expect(index).toContain(`${SITE_ORIGIN}${doc.url}.md`);
      }
    }
    expect(index).toContain("https://tarestandard.com");
    expect(index).toContain("https://github.com/tarestandard/standard");
    expect(index).toContain("https://github.com/tarestandard/standard/issues/new/choose");
  });

  it("prints one version and one date per page", () => {
    // The gate that would have caught the reset's leftovers: the colophon, the
    // cite sentence and the meta descriptions still named a suite release and
    // the old standard name. A reader cites what these pages say.
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      expect(html, url).not.toMatch(/\bsuite v\d/);
      expect(html, url).not.toContain("Tare Standard v1.0");
      expect(html, url).toContain(`<span class="running-version">${datedLineFor(url)}</span>`);
    }
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

  it("links the public repository from the footer", () => {
    expect(page("/agent/scope")).toContain(
      '<a href="https://github.com/tarestandard/standard">Repository</a>',
    );
  });
});

describe("provenance without access", () => {
  it("checks every page the build published, not a hand-kept list", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      expect(pageByUrl.has(url), url).toBe(true);
    }
    const built = [...pageByUrl.keys()].filter((url) => url !== "/404");
    expect(built.sort()).toEqual([...PUBLISHED_PAGE_URLS, "/accessibility"].sort());
  });

  it("prints no reference a reader cannot open", () => {
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      const text = plainText(html);
      // A file path, an ADR number, a repository document name or a relative
      // link into a private tree is a dead reference on a public page.
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
    const grades = plainText(page("/agent/grades"));
    // The claim is a sentence in the body now, not a 90-character banner, but
    // it is still on the page and still says what the page does.
    expect(grades).toContain("The rule this file states is the rule the code computes.");
    expect(grades).toContain("The implementation is not published.");
  });

  it("names the public suite as the source of the job ids", () => {
    expect(plainText(page("/agent/scope"))).toContain("is the source of the job ids");
  });
});

describe("links, claims and the error page", () => {
  it("resolves every internal link and anchor", () => {
    const urls = new Set(pageByUrl.keys());
    const sources = new Set([
      ...ALL_DOCS.map((doc) => `${doc.url.slice(1)}.md`),
      "accessibility.md",
      "standard.json",
    ]);
    const feeds = new Set(["agent/changelog.xml", "shopfront/changelog.xml"]);
    const anchorsByUrl = new Map([...pageByUrl].map(([url, html]) => [url, ids(html)]));

    for (const [url, html] of pageByUrl) {
      for (const href of hrefs(html)) {
        if (href.startsWith("/")) {
          const [path = "", hash = ""] = href.split("#");
          if (sources.has(path.replace(/^\//, ""))) continue;
          if (feeds.has(path.replace(/^\//, ""))) continue;
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

  it("serves each document's source Markdown from the site, not a repository link", () => {
    for (const doc of ALL_DOCS) {
      const file = `${doc.url.slice(1)}.md`;
      const served = readFileSync(join(outDir, file), "utf8");
      expect(served, file).toBe(readFileSync(join(process.cwd(), doc.source), "utf8"));
      expect(page(doc.url)).toContain(`href="${doc.url}.md"`);
    }

    // A published page links to this repository on GitHub and nothing else:
    // any other repository URL is a tree a reader cannot open.
    for (const [url, html] of pageByUrl) {
      expect(html, url).not.toMatch(/https:\/\/github\.com\/(?!tarestandard\/standard\b)/);
    }
    // A raw source path on the front page would be a link a reader cannot use;
    // an external policy document is linked by its full URL and is not one.
    const front = page("/").replace(/https:\/\/github\.com\/[^"<\s]+/g, "");
    expect(front).not.toContain(".md");
  });

  it("ships security headers with the site", () => {
    const headers = readFileSync(join(outDir, "_headers"), "utf8");
    expect(headers).toContain("Strict-Transport-Security: max-age=31536000");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("Referrer-Policy: strict-origin-when-cross-origin");
    expect(headers).toContain("Permissions-Policy:");
    expect(headers).toContain("X-Frame-Options: DENY");
  });

  it("cites the frozen edition and names the release file on every page", () => {
    for (const doc of ALL_DOCS) {
      const html = page(doc.url);
      expect(html, doc.url).toContain("Frozen edition");
      expect(html, doc.url).toContain(`editions/${editionOf(doc.url).date}`);
    }
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      expect(html, url).toContain('href="/standard.json"');
      expect(html, url).toContain('href="/editions/2026-11-14"');
    }
  });

  it("fails the build when an authored root-relative link has no page", () => {
    const source = tempDoc("levels.md", "# Temp levels\n\nSee [the level](/shopfront/level).\n");
    const standards = [AGENT, withSource(SHOPFRONT, "/shopfront/levels", source)];
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);

    expect(() => buildStandardSite({ outDir: scratch, standards })).toThrow(
      /Internal link does not resolve/,
    );
  });

  it("fails the build when an authored root-relative anchor has no target", () => {
    const source = tempDoc("levels.md", "# Temp levels\n\nSee [the jobs](/agent/jobs#nope).\n");
    const standards = [AGENT, withSource(SHOPFRONT, "/shopfront/levels", source)];
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);

    expect(() => buildStandardSite({ outDir: scratch, standards })).toThrow(
      /Internal anchor does not resolve/,
    );
  });

  it("fails the build when a register prints an id from the other standard", () => {
    const shopfrontSource = tempDoc(
      "jobs.md",
      "# Temp register\n\n| Id | The job |\n|---|---|\n| HFD-S01 | Wrong family |\n",
    );
    const agentSource = tempDoc(
      "jobs.md",
      "# Temp register\n\n| Id | The job |\n|---|---|\n| HFD-F01 | Wrong family |\n",
    );
    const shopfrontScratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    const agentScratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(shopfrontScratch, agentScratch);

    expect(() =>
      buildStandardSite({
        outDir: shopfrontScratch,
        standards: [AGENT, withSource(SHOPFRONT, "/shopfront/jobs", shopfrontSource)],
      }),
    ).toThrow(/HFD-S01.*looks like HFD-F01/);
    expect(() =>
      buildStandardSite({
        outDir: agentScratch,
        standards: [withSource(AGENT, "/agent/jobs", agentSource), SHOPFRONT],
      }),
    ).toThrow(/HFD-F01.*looks like HFD-S01/);
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
        { "llms.txt": `- [Jobs](${SITE_ORIGIN}/agent/jobs)` },
        new Set(["agent/jobs.html"]),
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
    for (const url of PUBLISHED_PAGE_URLS) {
      const html = page(url);
      expect(html, url).toContain("The standard is public. The scan is a service.");
      expect(html, url).toContain("It grants no status and no accreditation.");
      expect(html, url).toContain(datedLineFor(url));
    }
  });

  it("serves a real 404 page with both standards' navigation", () => {
    const html = page("/404");
    expect(html).toContain("<title>Page not found · Tare Standard</title>");
    expect(plainText(html)).toContain("This page is not in the Code of Points.");
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toMatch(/noindex/i);
    expect(html.match(/class="not-found-group"/g)).toHaveLength(2);
    for (const standard of PUBLISHED_STANDARDS) {
      expect(html, standard.key).toContain(`href="${standard.base}"`);
      for (const doc of standard.docs) expect(html).toContain(`href="${doc.url}"`);
    }
    // The six old root paths each get one explicit move line.
    const movedStart = html.indexOf('class="not-found-moved"');
    const movedSection = html.slice(movedStart, html.indexOf("</section>", movedStart));
    const moved = [...movedSection.matchAll(/<code>([^<]+)<\/code>/g)].map(
      (match) => match[1] ?? "",
    );
    expect(moved).toEqual(["/jobs", "/grades", "/scope", "/settled", "/changelog", "/protocol"]);
    const section = html.slice(html.indexOf('class="not-found"'), html.indexOf("</main>"));
    expect([...section.matchAll(/<a\b/g)]).toHaveLength(21);
    expect(html).toContain('href="/"');
  });

  it("fails the build when the 404 has no agent edition to recover", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tare-standard-"));
    tempDirs.push(scratch);
    expect(() => buildStandardSite({ outDir: scratch, standards: [SHOPFRONT] })).toThrow(
      /404 recovery list needs the agent standard/,
    );
  });

  it("never prints a document count on the 404", () => {
    const text = plainText(page("/404"));
    expect(text).toContain("The standards publish their documents.");
    expect(text).not.toMatch(
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:published\s+)?documents\b/i,
    );
  });

  it("writes a sitemap for the citable pages only, each dated by its edition", () => {
    const sitemap = readFileSync(join(outDir, "sitemap.xml"), "utf8");
    expect(sitemap).toContain(`${SITE_ORIGIN}/`);
    for (const doc of ALL_DOCS) expect(sitemap).toContain(`${SITE_ORIGIN}${doc.url}`);
    expect(sitemap).not.toContain("404");
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((match) => match[1]);
    expect(lastmods).toEqual([...PUBLISHED_PAGE_URLS.map((url) => dateFor(url)), SITE_DATE]);
  });
});

describe("the machine-readable release", () => {
  it("serves standard.json exactly as the repository states it", () => {
    const served = readFileSync(join(outDir, "standard.json"), "utf8");
    expect(served).toBe(readFileSync(join(process.cwd(), "standard.json"), "utf8"));
    const release = JSON.parse(served) as { name: string; standards: unknown[] };
    expect(release.name).toBe("Tare Standard");
    expect(release.standards).toHaveLength(STANDARDS.length);
  });

  it("names the release in llms.txt", () => {
    expect(readFileSync(join(outDir, "llms.txt"), "utf8")).toContain(
      `${SITE_ORIGIN}/standard.json`,
    );
  });
});
