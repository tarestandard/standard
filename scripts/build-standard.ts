import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Tokens } from "marked";
import { Marked, Renderer } from "marked";
import {
  ERRATA_URL,
  FRONT_PAGE,
  LICENSE_NAME,
  LICENSE_URL,
  PUBLIC_REPO_URL,
  PUBLISHED_PAGE_URLS,
  SITE_ORIGIN,
  STANDARD_DATE,
  STANDARD_DOCS,
  STANDARD_VERSION,
  STANDARD_VERSION_LINE,
  STANDARD_VERSION_LINE_HTML,
  type StandardDoc,
  SUITE_RELEASE_DATE,
  SUITE_VERSION,
} from "./standard-docs";
import {
  assertScopeSplit,
  loadScopeCounts,
  scopeHeading,
  scopeSentence,
  spellCount,
} from "./standard-scope";

/**
 * Render the published standard from `docs/standard/` into static assets.
 *
 * The generated site is not committed. `npm run build:standard` writes it to
 * `standard-site/dist/`, and `npm run check` runs this before the dry-run so a
 * document that does not render fails the gate. The Worker is static assets
 * only; no Markdown renderer ships to the edge.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_DIR = join(REPO_ROOT, "standard-site", "dist");
const STYLESHEET = join(REPO_ROOT, "standard-site", "site.css");
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Narrow:wght@500;600;700&family=Roboto+Mono:wght@400;500;700&display=swap";
const FORBIDDEN = /\b(certified|compliant|guarantee(?:s|d)?)\b/i;
const TABLE_SEPARATOR = /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/m;
/** A table wider than the reading column only folds out at five columns or more. */
const WIDE_TABLE_COLUMNS = 5;
/** Four-column tables whose last column is prose: they fold out on their own. */
const PROSE_TABLE_VARIANTS = new Set(["coverage-glance", "checks"]);
const OG_IMAGE_SOURCE = join(REPO_ROOT, "standard-site", "assets", "og.png");
const OG_IMAGE_URL = `${SITE_ORIGIN}/assets/og.png`;
const OG_IMAGE_ALT = `Tare Standard — the published Code of Points for AI agents. ${STANDARD_VERSION_LINE}.`;
/** The 29-job register's four v2.2 attack jobs are its last four rows (#238). */
const REGISTER_ROWS = 29;
const REGISTER_ATTACK_ROWS = 4;

type Heading = { depth: number; id: string; text: string; number: string | null };

/** The register's v2.2 group row, once a table has rendered one. */
type RegisterGroup = { id: string; label: string; afterId: string };

export type Page = {
  url: string;
  file: string;
  html: string;
  anchors: Set<string>;
};

export type BuildResult = {
  outDir: string;
  pages: string[];
  files: string[];
};

export type BuildOptions = {
  outDir?: string;
  /** Test hook: publish a different list. Defaults to the committed manifest. */
  docs?: readonly StandardDoc[];
};

export function buildStandardSite(options: BuildOptions = {}): BuildResult {
  const outDir = resolve(options.outDir ?? DEFAULT_OUT_DIR);
  if (outDir === REPO_ROOT || outDir === dirname(REPO_ROOT)) {
    throw new Error(`Refusing to build the standard into ${outDir}`);
  }

  if (!existsSync(OG_IMAGE_SOURCE)) {
    throw new Error(
      `The social card is missing: ${relative(REPO_ROOT, OG_IMAGE_SOURCE)}. ` +
        "Regenerate it with the committed composition before publishing.",
    );
  }

  const css = readFileSync(STYLESHEET, "utf8");
  const docs = options.docs ?? STANDARD_DOCS;
  const docsBySource = new Map(docs.map((doc) => [resolve(REPO_ROOT, doc.source), doc]));
  // One parse of the Family table drives the front page's sentence, the scope
  // page's metadata and the build gate, so no numeral is typed twice.
  const scope = loadScopeCounts();
  // The rail's current-section mark needs one selector per section: CSS
  // cannot compare `:target` with a link's href. Generate them from the same
  // heading ids the rail renders, and append them to the one stylesheet.
  const targetRules: string[] = [];

  const pages: Page[] = [];
  for (const doc of docs) {
    pages.push(renderDocPage(doc, docsBySource, targetRules));
  }

  const index = renderFrontPage(docs, scope);
  pages.unshift(index);
  pages.push(renderNotFound(docs));

  validateLinks(pages, new Set(docs.map((doc) => `${doc.url.slice(1)}.md`)));
  validateClaims(pages);
  const scopePage = pages.find((page) => page.url === "/scope");
  if (!scopePage) {
    throw new Error(
      "The published set has no /scope page, so the scope sentence cannot be checked against it",
    );
  }
  assertScopeSplit({ indexHtml: index.html, scopeHtml: scopePage.html, counts: scope });
  const jobsPage = pages.find((page) => page.url === "/jobs");
  if (!jobsPage) {
    throw new Error("The published set has no /jobs page, so the register's ids cannot be checked");
  }
  assertRegisterIds(jobsPage.html, scopePage.html);
  for (const page of pages) {
    if (page.html.includes("github.com/gnoparus")) {
      throw new Error(
        `A published page links into the private repository (${page.file}); ` +
          "publish the document or render the reference as text.",
      );
    }
  }

  // Build the two indexes and validate every URL they emit against the files
  // this build is about to write, before the output directory is touched. A
  // URL with no file is the `/settled` class of bug: published, advertised and
  // never deployed, and it must not leave a half-written directory behind.
  const sitemap = sitemapXml(docs);
  const llms = llmsTxt(docs);
  const planned = new Set<string>([
    ...pages.map((page) => page.file),
    ...docs.map((doc) => `${doc.url.slice(1)}.md`),
  ]);
  assertEmittedUrlsResolve(outDir, { "sitemap.xml": sitemap, "llms.txt": llms }, planned);
  // The dated record: publication and release are two facts from two
  // constants. Check every surface that prints them before anything is
  // written, so a hardcoded line cannot drift back in.
  assertDatedRecord(pages, { sitemap, llms });

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const files: string[] = [];
  for (const page of pages) {
    write(outDir, page.file, page.html);
    files.push(page.file);
  }
  // The source Markdown is public alongside the page it renders (#130). The
  // repository is private, so a repository link would 404 for every reader.
  for (const doc of docs) {
    const source = readFileSync(resolve(REPO_ROOT, doc.source), "utf8");
    write(outDir, `${doc.url.slice(1)}.md`, source);
    files.push(`${doc.url.slice(1)}.md`);
  }

  write(outDir, "assets/site.css", `${css}${generatedTargetRules(targetRules)}`);
  write(outDir, "favicon.svg", FAVICON);
  write(outDir, "robots.txt", robotsTxt());
  write(outDir, "sitemap.xml", sitemap);
  write(outDir, "llms.txt", llms);
  copyFileSync(OG_IMAGE_SOURCE, join(outDir, "assets", "og.png"));
  files.push(
    "assets/site.css",
    "assets/og.png",
    "favicon.svg",
    "robots.txt",
    "sitemap.xml",
    "llms.txt",
  );

  copyEditions(outDir, files);

  return {
    outDir,
    pages: pages.map((page) => page.url),
    files: files.sort(),
  };
}

function renderDocPage(
  doc: StandardDoc,
  docsBySource: Map<string, StandardDoc>,
  targetRules: string[],
): Page {
  const sourcePath = resolve(REPO_ROOT, doc.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`Published document is missing: ${doc.source}`);
  }

  const markdown = readFileSync(sourcePath, "utf8");
  const headings: Heading[] = [];
  const rowAnchors = new Set<string>();
  const usedIds = new Set<string>();
  const renderer = new Renderer();
  // Clause numbers are per document: h2 = 1..N, h3 = N.M under its h2. The
  // visible number is a span before the heading text and is hidden from the
  // accessible name, so `#how-a-score-is-computed` and the heading's words are
  // exactly what they were before the numbers (#234).
  let clauseH2 = 0;
  let clauseH3 = 0;
  // The table renderer writes this while `marked` parses; a holder keeps the
  // write visible to the code that builds the rail after the parse.
  const registerGroup: { current: RegisterGroup | null } = { current: null };

  renderer.heading = function (this: Renderer, { tokens, depth }: Tokens.Heading) {
    const html = this.parser.parseInline(tokens);
    const text = plainText(html);
    const id = uniqueSlug(text, usedIds);
    let number: string | null = null;
    if (depth === 2) {
      clauseH2 += 1;
      clauseH3 = 0;
      number = String(clauseH2);
    } else if (depth === 3 && clauseH2 > 0) {
      clauseH3 += 1;
      number = `${clauseH2}.${clauseH3}`;
    }
    headings.push({ depth, id, text, number });
    const clause = number === null ? "" : `<span class="clause">${number}</span> `;
    return `<h${depth} id="${escapeHtml(id)}">${clause}${html}</h${depth}>\n`;
  };

  renderer.tablecell = function (this: Renderer, token: Tokens.TableCell) {
    const html = Renderer.prototype.tablecell.call(this, token);
    return token.header ? html.replace("<th", '<th scope="col"') : html;
  };

  renderer.table = function (this: Renderer, token: Tokens.Table) {
    const headers = token.header.map((cell) => plainText(this.parser.parseInline(cell.tokens)));
    const label = isRegisterHead(headers[0]) ? headers[1] : headers[0];
    const variant = tableVariant(headers);
    // A prose column earns the fold-out even at four columns: a sentence set
    // as a 140px ribbon is a layout failure, not a narrow table.
    const wide =
      token.header.length >= WIDE_TABLE_COLUMNS || PROSE_TABLE_VARIANTS.has(variant ?? "");
    // A row whose first cell is an id becomes a self-link, so a job can be
    // quoted as `#job-7` and a mapped scenario as `#v2-s01` (no renumbering).
    const ids = token.rows.map((row) => {
      const cell = row[0];
      if (!cell) return null;
      const text = plainText(this.parser.parseInline(cell.tokens));
      const base = rowAnchorId(headers[0], text);
      return base === null ? null : uniqueSlug(base, usedIds);
    });
    for (const id of ids) {
      if (id !== null) rowAnchors.add(id);
    }
    let html = Renderer.prototype.table.call(this, token);
    html = addBreakOpportunities(html);
    html = applyRowAnchors(html, ids);
    // The register becomes one block per job at the phone width, so every cell
    // carries its own column label: the head is hidden there, and a row of
    // unlabelled values would be a list of fragments.
    if (variant === "register") html = labelRegisterCells(html, headers);
    // The v2.2 release is four attack jobs at the end of the 29-job register.
    // The table numbers its rows, so detect the group by the row ids the build
    // just wrote (a register that prints `V2-A0x` in its first cell is grouped
    // the same way). The row order, ids and self-links are untouched (#238).
    const attackRow = registerAttackRow(
      token,
      headers,
      (cells) => plainText(this.parser.parseInline(cells)),
      doc.source,
    );
    if (attackRow !== null) {
      const sectionId = [...headings].reverse().find((heading) => heading.depth === 2)?.id;
      if (sectionId) {
        const groupId = `suite-${slugify(SUITE_VERSION)}`;
        const count = spellCount(attackRow.count);
        const groupLabel = `Suite ${SUITE_VERSION} — ${count} attack jobs`;
        const grouped = insertRegisterGroup(
          html,
          attackRow.index,
          token.header.length,
          groupId,
          groupLabel,
        );
        // Register the group only when the row really landed: a rail link or a
        // :target rule for an id that is not in the page is a dead reference.
        if (grouped !== null) {
          html = grouped;
          rowAnchors.add(groupId);
          registerGroup.current = { id: groupId, label: groupLabel, afterId: sectionId };
        }
      }
    }
    const classes = [
      "table-scroll",
      wide ? "table-scroll--wide" : "",
      variant === null ? "" : `table--${variant}`,
    ]
      .filter((name) => name !== "")
      .join(" ");
    // Every wrapper is a labelled, focusable region, so a keyboard user can
    // always reach the content if it does overflow at some width. The cue is
    // only rendered for a table that carries a min-width (it fits the column at
    // 1440 and scrolls below 1040); it is not aria-hidden, so the promise is
    // announced as well as seen.
    // A table that can overflow at a phone width is a region worth reaching:
    // five or more columns always can, a four-column one may, and a two-column
    // rule table never does. The cue follows the same test, so the promise and
    // the affordance are never separated.
    const scrollable = wide || token.header.length >= 3;
    const hintClass = variant === null ? "table-hint" : `table-hint table-hint--${variant}`;
    const hint = scrollable ? `<p class="${hintClass}">Scroll → for the full table</p>\n` : "";
    return `${hint}<div class="${classes}" role="region" aria-label="${escapeHtml(
      label ? `${label} table` : "Table",
    )}"${scrollable ? ' tabindex="0"' : ""}>${html}</div>\n`;
  };

  renderer.link = function (this: Renderer, { href, title, tokens }: Tokens.Link) {
    const text = this.parser.parseInline(tokens);
    const target = resolveHref(href, doc, docsBySource);
    if (target === null) {
      // An internal reference the site does not publish. Keep the words, drop
      // the anchor: the repository is private, so its blob URL answers 404.
      return `<span class="internal-ref">${text}</span>`;
    }
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<a href="${escapeHtml(target)}"${titleAttr}>${text}</a>`;
  };

  const marked = new Marked({ gfm: true });
  marked.use({ renderer });
  const body = marked.parse(markdown, { async: false });
  if (typeof body !== "string" || body.trim() === "") {
    throw new Error(`Published document rendered nothing: ${doc.source}`);
  }

  const h1s = headings.filter((heading) => heading.depth === 1);
  if (h1s.length !== 1) {
    throw new Error(
      `Published document must have exactly one h1: ${doc.source} (found ${h1s.length})`,
    );
  }

  const sourceH2s = markdown.match(/^## .+$/gm)?.length ?? 0;
  const renderedH2s = headings.filter((heading) => heading.depth === 2).length;
  if (sourceH2s !== renderedH2s) {
    throw new Error(
      `Published document did not render every section: ${doc.source} (${renderedH2s}/${sourceH2s})`,
    );
  }

  if (TABLE_SEPARATOR.test(markdown) && !body.includes("<table>")) {
    throw new Error(`Published document has a table that did not render: ${doc.source}`);
  }
  if (tablePipesRemain(body)) {
    throw new Error(`Published document left a raw table in the output: ${doc.source}`);
  }

  // /settled already owns `#cite-this` on its own "Cite this" heading, so the
  // citation block there takes the next id rather than duplicating the anchor.
  // No existing id moves, and "Cite this" always lands on the block itself.
  const citeId = usedIds.has("cite-this") ? "cite-this-block" : "cite-this";
  const anchors = new Set([
    "main",
    ...headings.map((heading) => heading.id),
    ...rowAnchors,
    ...(registerGroup.current ? [registerGroup.current.id] : []),
    citeId,
  ]);
  const toc = headings.filter((heading) => heading.depth === 2);
  // The rail carries the clause number as a § reference; the heading itself
  // prints the bare number. The v2.2 attack group sits under the register's
  // section as a nested line, because the table is not a clause (#234/#238).
  const tocLinks = toc
    .map((heading) => {
      const number = heading.number === null ? "" : `§${escapeHtml(heading.number)}`;
      const clause = number === "" ? "" : `<span class="clause">${number}</span> `;
      const group =
        registerGroup.current && registerGroup.current.afterId === heading.id
          ? `\n            <li class="toc-group"><a href="#${escapeHtml(
              registerGroup.current.id,
            )}">${escapeHtml(registerGroup.current.label)}</a></li>`
          : "";
      return `<li><a href="#${escapeHtml(heading.id)}">${clause}${escapeHtml(
        heading.text,
      )}</a></li>${group}`;
    })
    .join("\n            ");
  const tocHtml =
    toc.length > 0
      ? `<nav class="toc" aria-label="On this page">
          <p class="rail-title">On this page</p>
          <ol class="toc-list">
            ${tocLinks}
          </ol>
        </nav>`
      : "";
  // The rail is removed at 900px; the same section list stays reachable as a
  // native disclosure under the title, with no script.
  const mobileToc =
    toc.length > 0
      ? `<details class="doc-contents">
        <summary>On this page</summary>
        <nav aria-label="On this page">
          <ol class="doc-contents-list">
            ${tocLinks}
          </ol>
        </nav>
      </details>`
      : "";

  // One selector per section: CSS cannot match a rail href to `:target` by
  // itself, so the build writes the pair out from the heading ids it renders.
  // The register group is a rail target too, so it gets the same mark.
  const railTargets = [
    ...toc.map((heading) => heading.id),
    ...(registerGroup.current ? [registerGroup.current.id] : []),
  ];
  for (const id of railTargets) {
    targetRules.push(
      `.doc-shell:has(#${id}:target) .rail a[href="#${id}"] {\n` +
        "  color: var(--ink);\n  font-weight: 600;\n}",
      `.doc-shell:has(#${id}:target) .rail a[href="#${id}"]::before {\n` +
        '  content: "";\n  display: inline-block;\n  width: 4px;\n  height: 4px;\n' +
        "  margin-right: 8px;\n  background: var(--grn);\n  vertical-align: 0.32em;\n}",
    );
  }

  const metaLine = `<p class="doc-meta-line">${escapeHtml(
    STANDARD_VERSION_LINE,
  )} · <a href="${doc.url}.md">Source (Markdown)</a></p>`;
  // /settled already owns `#cite-this` on its own "Cite this" heading, so the
  // block there takes the next id rather than duplicating the anchor. No
  // existing id moves, and "Cite this" always lands on the block itself.
  const citeLine = citationBlock(doc, citeId);
  const decorated = insertAfterTitle(decorateKicker(body), [metaLine, citeLine, mobileToc]);
  const margin = `<aside class="margin" aria-label="Citation">
      <p class="margin-citation">${STANDARD_VERSION_LINE_HTML}</p>
      <p class="margin-links"><a href="/scope#how-to-cite-this">How to cite</a><br><a href="${doc.url}.md">Source (Markdown)</a>${editionLink(doc)}</p>
    </aside>`;

  const article = `<main id="main">
  <div class="doc-shell">
    <aside class="rail">
      ${tocHtml}
      <dl class="doc-meta">
        <div><dt>Part of</dt><dd><a href="/">Tare Standard</a></dd></div>
        <div class="doc-meta-time"><dt>Published</dt><dd><time datetime="${STANDARD_DATE}">${STANDARD_DATE}</time></dd></div>
        <div class="doc-meta-time"><dt>Suite released</dt><dd><time datetime="${SUITE_RELEASE_DATE}">${SUITE_RELEASE_DATE}</time></dd></div>
        <div><dt>Source</dt><dd><a href="${doc.url}.md">Markdown</a></dd></div>
      </dl>
    </aside>
    <article class="document">
${decorated}
      <p class="doc-end"><span>End of document</span> <a href="/">Contents</a> · <a href="/scope#how-to-cite-this">How to cite</a></p>
    </article>
    ${margin}
  </div>
</main>`;

  return {
    url: doc.url,
    file: `${doc.url.slice(1)}.html`,
    anchors,
    html: pageShell({
      title: `${doc.title} · Tare Standard`,
      description: doc.description,
      canonical: `${SITE_ORIGIN}${doc.url}`,
      currentUrl: doc.url,
      ogType: "article",
      doc,
      body: article,
    }),
  };
}

/**
 * One ruled, selectable citation at the end of a document (#231).
 *
 * The line is a single paragraph of text, styled `user-select: all`, so one
 * click selects it whole; there is no copy button and no script, and the URL
 * stays visible as text when the page prints. No accessed date is printed: the
 * build does not observe one, and inventing it would be a false fact.
 */
function citationBlock(doc: StandardDoc, id: string): string {
  // A dated citation resolves to the frozen edition page, not the live one.
  const frozen = join(
    REPO_ROOT,
    "standard-site",
    "editions",
    SUITE_RELEASE_DATE,
    `${doc.url.slice(1)}.html`,
  );
  // A URL stays one string when copied, and may break after a slash: a phone
  // cannot hold the edition URL on one line, and breaking mid-slug is worse
  // than breaking at a path boundary.
  const linkUrl = (url: string) => escapeHtml(url).replaceAll("/", "/<wbr>");
  const canonical = `${SITE_ORIGIN}${doc.url}`;
  const archived = `${SITE_ORIGIN}/editions/${SUITE_RELEASE_DATE}${doc.url}`;
  const edition = existsSync(frozen)
    ? `<p class="cite-url"><span class="cite-url-label">This edition</span> <span class="citation-url">${linkUrl(
        archived,
      )}</span></p>`
    : "";
  // One apparatus, at the top of the document: the sentence and every URL it
  // could be read as. The frozen edition link used to live only in the wide
  // screen margin, so a phone reader could not reach the dated version at all.
  return `<details class="doc-cite" id="${escapeHtml(id)}">
        <summary>Cite this</summary>
        <div class="cite-body">
          <p class="cite-line">Tare Standard ${STANDARD_VERSION} · ${escapeHtml(
            doc.title,
          )} · hotel front-desk suite ${SUITE_VERSION} · published <time datetime="${STANDARD_DATE}">${STANDARD_DATE}</time> · released <time datetime="${SUITE_RELEASE_DATE}">${SUITE_RELEASE_DATE}</time>.</p>
          <p class="cite-url"><span class="cite-url-label">This page</span> <span class="citation-url">${linkUrl(
            canonical,
          )}</span></p>
          ${edition}
        </div>
      </details>`;
}

/**
 * The scope as a figure: one ruled cell for each of AIUC-1's live requirements,
 * filled where the suite publishes a job that can speak to it.
 *
 * The number is the site's most important claim and it was set as prose in
 * every place it appeared. A tally shows the 44 holes as plainly as the six
 * cells, which is the whole argument of the paragraph beside it. No script and
 * no chart library: fifty spans in a grid.
 *
 * The cells are counted, not ranked: the build knows how many requirements a
 * published job can speak to, not which cells of AIUC-1's own list they are, so
 * the first `covered` cells fill and the caption says so. Naming the six would
 * mean publishing a list the derivation does not hold.
 */
function scopeTally(scope: ReturnType<typeof loadScopeCounts>): string {
  const cells = Array.from({ length: scope.total }, (_unused, index) => {
    const filled = index < scope.covered;
    return `<span class="tally-cell${filled ? " tally-cell--with" : ""}"></span>`;
  }).join("");
  return `<figure class="tally" aria-labelledby="tally-caption">
      <div class="tally-grid" aria-hidden="true">${cells}</div>
      <figcaption id="tally-caption" class="tally-caption">
        <span class="tally-count">${scope.covered} of ${scope.total}</span>
        AIUC-1 live requirements with a published job. ${scope.noRow} have no row; ${spellCount(
          scope.zeroFamilies,
        )} families are at zero. The cells are counted, not ranked.
      </figcaption>
    </figure>`;
}

function renderFrontPage(
  docs: readonly StandardDoc[],
  scope: ReturnType<typeof loadScopeCounts>,
): Page {
  const rows = docs
    .map(
      (doc) => `<tr>
          <td><a href="${doc.url}">${escapeHtml(doc.title)}<span aria-hidden="true"> →</span></a></td>
          <td>${escapeHtml(doc.summary)}</td>
        </tr>`,
    )
    .join("\n        ");

  const body = `<main id="main" class="front">
  <article class="title-page">
    <header class="title-block">
      <h1>Tare Standard</h1>
      <p class="standfirst">The Code of Points for AI agents.</p>
      <p class="intro">An independent standard for testing an AI agent against the work it claims to do. It publishes the jobs, the rules that score them, how a failure is graded, and what the suite can and cannot settle. It is versioned, dated and free to read; the scan that applies it is a service at <a href="https://tarestandard.com">tarestandard.com</a>.</p>
      <p class="intro-note">The standard is public. A scan is one dated observation against it, not a status.</p>
    </header>
    <dl class="edition" aria-label="Edition">
      <div><dt>Standard</dt><dd>${STANDARD_VERSION}</dd></div>
      <div><dt>Suite</dt><dd>${SUITE_VERSION}</dd></div>
      <div><dt>Protocol</dt><dd>v1</dd></div>
      <div><dt>Published</dt><dd><time datetime="${STANDARD_DATE}">${STANDARD_DATE}</time></dd></div>
      <div><dt>Suite released</dt><dd><time datetime="${SUITE_RELEASE_DATE}">${SUITE_RELEASE_DATE}</time></dd></div>
      <div><dt>Access</dt><dd>Free to read</dd></div>
    </dl>
  </article>

  <section class="contents" aria-labelledby="contents">
    <h2 id="contents">Contents</h2>
    <div class="table-scroll" role="region" aria-label="Contents table">
      <table class="contents-table">
        <thead>
          <tr><th scope="col">Document</th><th scope="col">What it settles</th></tr>
        </thead>
        <tbody>
        ${rows}
        </tbody>
      </table>
    </div>
  </section>

  <section class="scope-note" aria-labelledby="scope">
    <div class="scope-argument">
      <h2 id="scope">${escapeHtml(scopeHeading(scope))}</h2>
      <p>${escapeHtml(scopeSentence(scope))} Scope is not coverage, and the denominator is AIUC-1's own count of live requirements.</p>
      <blockquote><p>0 is a fact about the suite, a hole we are not hiding.</p></blockquote>
    </div>
    ${scopeTally(scope)}
    <p class="scope-link"><a href="/scope#scope-what-this-suite-does-and-does-not-test">Read the scope section</a></p>
  </section>

  <section class="cite" aria-labelledby="cite">
    <h2 id="cite">Cite the dated line</h2>
    <p>Cite the standard with its version, the suite version and each date: ${escapeHtml(STANDARD_VERSION_LINE)}. A scan is cited with its scan id, the observation date, the suite version and each judge version; <a href="/scope#how-to-cite-this">the mapping page prints the sentence and the attachments</a>.</p>
  </section>
</main>`;

  return {
    url: FRONT_PAGE.url,
    file: "index.html",
    anchors: new Set(["main", "contents", "scope", "cite"]),
    html: pageShell({
      title: FRONT_PAGE.title,
      description: FRONT_PAGE.description,
      canonical: `${SITE_ORIGIN}/`,
      currentUrl: "/",
      ogType: "website",
      body,
    }),
  };
}

function renderNotFound(docs: readonly StandardDoc[]): Page {
  const links = [
    `<a href="/">Contents</a>`,
    ...docs.map((doc) => `<a href="${doc.url}">${escapeHtml(doc.nav)}</a>`),
  ].join("\n      ");

  const body = `<main id="main" class="front">
  <div class="not-found">
    <h1><span class="not-found-code">404</span> This page is not in the Code of Points.</h1>
    <p>The standard publishes its documents. Start at the contents, or read the scope first to see what the suite can and cannot settle.</p>
    <nav class="not-found-links" aria-label="The published standard">
      ${links}
    </nav>
  </div>
</main>`;

  return {
    url: "/404",
    file: "404.html",
    anchors: new Set(["main"]),
    html: pageShell({
      title: "Page not found · Tare Standard",
      description: "This page is not in the Tare Standard Code of Points.",
      canonical: null,
      currentUrl: null,
      ogType: "website",
      body,
    }),
  };
}

type ShellOptions = {
  title: string;
  description: string;
  canonical: string | null;
  currentUrl: string | null;
  ogType: "website" | "article";
  /** The published document, when the page is one; the colophon links its source. */
  doc?: StandardDoc;
  body: string;
};

function pageShell({
  title,
  description,
  canonical,
  currentUrl,
  ogType,
  doc,
  body,
}: ShellOptions): string {
  const canonicalTag = canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "";
  const robotsTag = canonical ? `<meta name="robots" content="index,follow">` : "";
  const ogUrl = canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : "";
  // The running head's left slot is the section, as a printed page would set
  // it; the version and date stay on the right.
  const section = doc ? doc.title : currentUrl === "/" ? "Contents" : "Not found";
  const structuredData = jsonLd({ description, canonical, doc });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${canonicalTag}
${robotsTag}
<meta name="theme-color" content="#E8E2D2">
<link rel="license" href="${LICENSE_URL}">
<meta property="og:site_name" content="Tare Standard">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
${ogUrl}
<meta property="og:image" content="${OG_IMAGE_URL}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${OG_IMAGE_URL}">
<meta name="twitter:image:alt" content="${escapeHtml(OG_IMAGE_ALT)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${escapeHtml(FONT_URL)}" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
${structuredData}
</head>
<body>
<a class="skip" href="#main">Skip to the standard</a>
<header class="masthead">
  <div class="masthead-inner">
    <a class="wordmark" href="/">
      <span class="wordmark-name">Tare Standard</span>
      <span class="wordmark-sub">Code of Points</span>
    </a>
    ${siteNav(currentUrl)}
  </div>
  <div class="running-head">
    <span class="running-section">${escapeHtml(section)}</span>
    <span class="running-version">${STANDARD_VERSION_LINE}</span>
  </div>
</header>
${body}
${colophon(doc)}
</body>
</html>
`;
}

function jsonLd({
  description,
  canonical,
  doc,
}: {
  description: string;
  canonical: string | null;
  doc?: StandardDoc;
}): string {
  if (!canonical) return "";
  const publisher = {
    "@type": "Organization",
    name: "Tare Standard",
    url: `${SITE_ORIGIN}/`,
  };
  const suiteVersion = {
    "@type": "PropertyValue",
    name: "suiteVersion",
    value: SUITE_VERSION,
  };
  const data = doc
    ? {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        name: doc.title,
        headline: doc.title,
        description: doc.description,
        url: canonical,
        datePublished: STANDARD_DATE,
        dateModified: SUITE_RELEASE_DATE,
        version: STANDARD_VERSION,
        additionalProperty: suiteVersion,
        license: LICENSE_URL,
        publisher,
        isBasedOn: PUBLIC_REPO_URL,
      }
    : {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Tare Standard",
        description,
        url: canonical,
        datePublished: STANDARD_DATE,
        dateModified: SUITE_RELEASE_DATE,
        version: STANDARD_VERSION,
        additionalProperty: suiteVersion,
        license: LICENSE_URL,
        publisher,
        isBasedOn: PUBLIC_REPO_URL,
      };
  // JSON is not HTML: escape `<` so a description can never close the script.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/**
 * The tables that earn a column plan, named by their own headers. The last two
 * are four columns with a prose column, so the plan also earns the fold-out.
 */
function tableVariant(headers: readonly string[]): string | null {
  if (isRegisterHead(headers[0]) && headers[1] === "Scenario") return "register";
  if (headers[0] === "Scenario" && headers[1] === "Job") return "mapping";
  if (headers[0] === "Job" && headers[1] === "Steps") return "coverage";
  if (headers[0] === "Column" && headers[1] === "Rows with a mapping") return "coverage-glance";
  if (headers[0] === "Check" && headers[1] === "Jobs that ask it") return "checks";
  return null;
}

/**
 * The register's first column, before and after it printed the suite's own ids.
 * `Id` is the current header; `#` is kept so a labelled register still anchors.
 */
function isRegisterHead(header: string | undefined): boolean {
  return header === "Id" || header === "#";
}

function rowAnchorId(header: string | undefined, cell: string): string | null {
  const text = cell.trim();
  if (text === "" || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(text)) return null;
  if (header === "#" && /^\d+$/.test(text)) return `job-${text}`;
  // The register prints the suite's published id, so the row anchor and the
  // scenario's anchor on /scope are the same string: `V2-S17` → `#v2-s17`.
  if (header === "Id") {
    // The register's first column is the suite's published identifier. A value
    // that is not one is a typo the reader would meet as a dead citation, so it
    // fails the build rather than losing its anchor quietly.
    if (!/^V2-[SA]\d{2}$/.test(text)) {
      throw new Error(
        `The register prints "${text}" in its Id column; a published id looks like V2-S01 or V2-A01.`,
      );
    }
    return slugify(text) || null;
  }
  if (header === "ID" || header === "Scenario") return slugify(text) || null;
  return null;
}

/** A slash or underscore is a fair break point in a gate token; a hyphen is not. */
function addBreakOpportunities(html: string): string {
  return html.replace(
    /<td([^>]*)>([\s\S]*?)<\/td>/g,
    (_match, attrs: string, content: string) => `<td${attrs}>${breakableText(content)}</td>`,
  );
}

/**
 * Add break opportunities to a cell's prose, never inside `<code>`: a gate
 * token or question id must stay one string. Copy, paste and the published
 * instrument's own tests all read the identifier exactly as written.
 */
function breakableText(html: string): string {
  // Split on code spans and only touch the prose between them: a gate token or
  // question id must stay one string for copy, paste and the published tests.
  return html
    .split(/(<code>[\s\S]*?<\/code>)/)
    .map((part) =>
      part.startsWith("<code>")
        ? part
        : part.replace(
            /(<[^>]+>)|([/_])(?=[A-Za-z0-9])/g,
            (_m, tag: string | undefined, separator: string | undefined) =>
              tag ?? `${separator}<wbr>`,
          ),
    )
    .join("");
}

/**
 * The first row of the v2.2 attack group, or null.
 *
 * The register prints the suite's own ids, so the attack group is the run of
 * rows whose id starts `V2-A`. The row-count fallback stays for a register that
 * still numbers its rows, and nothing is renumbered either way.
 */
function registerAttackRow(
  token: Tokens.Table,
  headers: readonly string[],
  text: (cells: Tokens.TableCell["tokens"]) => string,
  docSource: string,
): { index: number; count: number } | null {
  // Only the v2.2 register carries the attack jobs; a future table with the
  // same headers must not inherit a group label it does not own.
  if (!docSource.endsWith("hotel-frontdesk-scenarios-v22.md")) return null;
  if (!isRegisterHead(headers[0]) || headers[1] !== "Scenario") return null;
  const labelled = token.rows
    .map((row, index) => {
      const cell = row[0];
      return cell && text(cell.tokens).startsWith("V2-A") ? index : -1;
    })
    .filter((index) => index !== -1);
  if (labelled.length > 0) return { index: labelled[0] ?? 0, count: labelled.length };
  if (token.rows.length !== REGISTER_ROWS) return null;
  return { index: token.rows.length - REGISTER_ATTACK_ROWS, count: REGISTER_ATTACK_ROWS };
}

/** Put the ruled group row before the register's first attack row. */
function insertRegisterGroup(
  html: string,
  rowIndex: number,
  columns: number,
  groupId: string,
  label: string,
): string | null {
  const open = html.indexOf("<tbody>");
  const close = html.indexOf("</tbody>", open);
  if (open === -1 || close === -1) return null;
  const body = html.slice(open + "<tbody>".length, close);
  const starts = [...body.matchAll(/<tr\b/g)].map((match) => match.index ?? 0);
  const at = starts[rowIndex];
  if (at === undefined) return null;
  const group =
    `<tr class="register-group" id="${escapeHtml(groupId)}">` +
    `<th colspan="${columns}" scope="colgroup">${escapeHtml(label)}</th></tr>`;
  const inserted = `${body.slice(0, at)}${group}${body.slice(at)}`;
  return `${html.slice(0, open + "<tbody>".length)}${inserted}${html.slice(close)}`;
}

/**
 * Give each id row an anchor and make its id a self-link. The ids come from the
 * published label (`1` → `job-1`, `V2-S01` → `v2-s01`); nothing is renumbered.
 */
function applyRowAnchors(html: string, ids: readonly (string | null)[]): string {
  if (!ids.some((id) => id !== null)) return html;
  const open = html.indexOf("<tbody>");
  const close = html.indexOf("</tbody>", open);
  if (open === -1 || close === -1) return html;
  let index = 0;
  const tbody = html
    .slice(open + "<tbody>".length, close)
    .split(/(?=<tr>)/)
    .map((row) => {
      if (!row.startsWith("<tr>")) return row;
      const id = ids[index++];
      if (!id) return row;
      return row
        .replace(/^<tr>/, `<tr id="${escapeHtml(id)}">`)
        .replace(/<td([^>]*)>([\s\S]*?)<\/td>/, (_match, attrs: string, content: string) =>
          content.includes("<a")
            ? `<td${attrs}>${content}</td>`
            : `<td${attrs}><a class="row-id" href="#${escapeHtml(id)}">${content}</a></td>`,
        );
    })
    .join("");
  return `${html.slice(0, open + "<tbody>".length)}${tbody}${html.slice(close)}`;
}

/**
 * Give each register cell its column label, so the phone layout can print the
 * label above the value when the head is hidden. The head keeps its own
 * `<th>`s: this is a rendering hint, not a second header row.
 */
function labelRegisterCells(html: string, headers: readonly string[]): string {
  const open = html.indexOf("<tbody>");
  const close = html.indexOf("</tbody>", open);
  if (open === -1 || close === -1) return html;
  const body = html
    .slice(open, close)
    .split(/(?=<tr)/)
    .map((row) => {
      let cell = 0;
      return row.replace(/<td(?=[ >])/g, () => {
        const label = headers[cell];
        cell += 1;
        // A cell past the last header (a colspan, a renderer change) would take
        // the wrong label and teach the phone layout a lie; leave it unlabelled.
        return label === undefined ? "<td" : `<td data-label="${escapeHtml(label)}"`;
      });
    })
    .join("");
  return `${html.slice(0, open)}${body}${html.slice(close)}`;
}

/** Mark the standfirst paragraph so it can be targeted by class, not position. */
function decorateKicker(body: string): string {
  const titleEnd = body.indexOf("</h1>");
  if (titleEnd === -1) return body;
  const cut = titleEnd + "</h1>".length;
  const head = body.slice(0, cut);
  const rest = body.slice(cut);
  const match = rest.match(/^(\s*)<p><strong>([\s\S]*?)<\/strong><\/p>/);
  if (!match) return body;
  const inner = match[2] ?? "";
  const modifier = inner.includes("<code>") ? " doc-kicker--code" : "";
  const replacement = `${match[1] ?? ""}<p><strong class="doc-kicker${modifier}">${inner}</strong></p>`;
  return `${head}${replacement}${rest.slice(match[0].length)}`;
}

/** Put the title apparatus (metadata, citation, contents) directly after the h1. */
function insertAfterTitle(body: string, fragments: readonly string[]): string {
  const titleEnd = body.indexOf("</h1>");
  if (titleEnd === -1) return body;
  // The dated line belongs to the title and prints first; the citation
  // apparatus goes under it, not between the title and its own dateline.
  const after = body.slice(titleEnd + "</h1>".length);
  const kicker = after.match(/^\s*<p><strong class="doc-kicker[\s\S]*?<\/strong><\/p>/);
  const cut = kicker
    ? titleEnd + "</h1>".length + (kicker.index ?? 0) + kicker[0].length
    : titleEnd + "</h1>".length;
  const insert = fragments
    .filter((fragment) => fragment !== "")
    .map((fragment) => `\n    ${fragment}`)
    .join("");
  return `${body.slice(0, cut)}${insert}${body.slice(cut)}`;
}

function generatedTargetRules(rules: readonly string[]): string {
  if (rules.length === 0) return "";
  return `\n\n/* Generated at build time: the rail marks the section at :target. */\n${rules.join("\n\n")}\n`;
}

function siteNav(currentUrl: string | null): string {
  const items = [
    { url: "/", label: "Contents" },
    ...STANDARD_DOCS.map((doc) => ({ url: doc.url, label: doc.nav })),
  ];
  const links = items
    .map(({ url, label }) => {
      const current = url === currentUrl ? ` aria-current="page"` : "";
      return `<a href="${url}"${current}>${escapeHtml(label)}</a>`;
    })
    .join("\n      ");
  return `<nav class="site-nav" aria-label="The standard">
      ${links}
    </nav>`;
}

function colophon(doc?: StandardDoc): string {
  return `<footer class="colophon">
  <div class="colophon-inner">
    <div>
      <p class="colophon-wordmark">Tare Standard</p>
      <p class="colophon-split">The standard is public. The scan is a service. <a href="https://tarestandard.com">tarestandard.com</a> runs it.</p>
    </div>
    <div>
      <p class="colophon-claims">This site publishes what the standard tests and what a scan observed. It grants no status and no accreditation.</p>
      <p class="colophon-status">Status: the published edition of Tare Standard v1.0, suite v2.2. Maintained by the Tare project; a correction that leaves what a job tests unchanged is recorded in the <a href="/changelog">Changelog</a>, and an error can be reported at <a href="${ERRATA_URL}">the issue tracker</a>.</p>
      <p class="colophon-licence">Published under <a href="${LICENSE_URL}">${LICENSE_NAME}</a>: share it with attribution and do not publish a modified version; translating it needs permission.</p>
      <p class="colophon-version">${STANDARD_VERSION_LINE}</p>
      <p class="colophon-links"><a href="/">Contents</a>${doc ? ` · <a href="${doc.url}.md">Source (Markdown)</a>` : ""} · <a href="${PUBLIC_REPO_URL}">Repository</a> · <a href="/scope#how-to-cite-this">How to cite</a></p>
    </div>
  </div>
</footer>`;
}

/**
 * The frozen edition of this document, when one exists. The live page is the
 * latest edition; a scan cites the dated one it ran against (#237).
 */
function editionLink(doc: StandardDoc): string {
  const path = join(
    REPO_ROOT,
    "standard-site",
    "editions",
    SUITE_RELEASE_DATE,
    `${doc.url.slice(1)}.html`,
  );
  if (!existsSync(path)) return "";
  return `<br><a href="/editions/${SUITE_RELEASE_DATE}${doc.url}">This edition (${SUITE_RELEASE_DATE})</a>`;
}

function resolveHref(
  href: string,
  doc: StandardDoc,
  docsBySource: Map<string, StandardDoc>,
): string | null {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return href;
  if (href.startsWith("/")) {
    if (href === "/" || href.startsWith("/assets/") || href === "/favicon.svg") return href;
    throw new Error(`Unexpected root-relative link in ${doc.source}: ${href}`);
  }

  const [path, ...hashParts] = href.split("#");
  if (!path) return href;
  const hash = hashParts.length > 0 ? `#${hashParts.join("#")}` : "";
  const target = resolve(REPO_ROOT, dirname(doc.source), path);
  const published = docsBySource.get(target);
  if (published) return `${published.url}${hash}`;

  if (!existsSync(target)) {
    throw new Error(`Broken link in ${doc.source}: ${href}`);
  }

  const relativePath = relative(REPO_ROOT, target).split(sep).join("/");
  if (relativePath.startsWith("..")) {
    throw new Error(`Link escapes the repository in ${doc.source}: ${href}`);
  }
  // Existing but unpublished: render as text, never as a link into the
  // private repository.
  return null;
}

function validateLinks(pages: Page[], sourceFiles: Set<string>): void {
  const byUrl = new Map(pages.map((page) => [page.url, page]));

  for (const page of pages) {
    for (const match of page.html.matchAll(/<a\b[^>]*\bhref="(\/[^"]*)"/g)) {
      const href = match[1] ?? "";
      const [path = "", hash = ""] = href.split("#");
      // A source download has no page and no anchors of its own.
      if (sourceFiles.has(path.replace(/^\//, ""))) continue;
      // A frozen edition is an asset copied after the pages are validated;
      // check the committed file rather than the page set.
      if (path.startsWith("/editions/")) {
        const rel = decodeURIComponent(path.slice("/editions/".length)).replace(/\/$/, "");
        const base = join(REPO_ROOT, "standard-site", "editions", rel);
        if (!existsSync(`${base}.html`) && !existsSync(join(base, "index.html"))) {
          throw new Error(`The edition link ${href} has no frozen page on ${page.file}`);
        }
        continue;
      }
      const target = path === "" ? page : byUrl.get(path);
      if (!target) {
        throw new Error(`Internal link does not resolve on ${page.file}: ${href}`);
      }
      if (hash && !target.anchors.has(decodeURIComponent(hash))) {
        throw new Error(`Internal anchor does not resolve on ${page.file}: ${href}`);
      }
    }

    for (const match of page.html.matchAll(/<a\b[^>]*\bhref="#([^"]*)"/g)) {
      const id = decodeURIComponent(match[1] ?? "");
      if (!page.anchors.has(id)) {
        throw new Error(`Same-page anchor does not resolve on ${page.file}: #${id}`);
      }
    }

    if (/<a\b[^>]*\bhref="(?!https?:|mailto:|tel:|\/)[^"]*\.md(?:[#"]|$)/.test(page.html)) {
      throw new Error(`A Markdown link was not rewritten on ${page.file}`);
    }
  }
}

/**
 * Return the first unquoted claim word in a generated page, or null.
 *
 * The standard is allowed to quote its own prohibition: `finding-grades.md`
 * prints "certified", "compliant" and "guaranteed" as the words it refuses.
 * Those are vocabulary, not a claim. Decode the text, remove quoted spans,
 * then look for the bare claim word. An unquoted `policy-compliant` or
 * `guarantee` still fails.
 */
export function findClaimWord(html: string): string | null {
  const text = plainText(
    decodeEntities(html)
      .replace(/"[^"]*"/g, " ")
      .replace(/“[^”]*”/g, " ")
      .replace(/(?<![\w])'[^']*'(?![\w])/g, " ")
      .replace(/‘[^’]*’/g, " "),
  );
  return text.match(FORBIDDEN)?.[0] ?? null;
}

/**
 * The claims gate for one page. Exported so the failure path is testable
 * without publishing a claim on a real page.
 */
export function assertClaimFree(file: string, html: string): void {
  const match = findClaimWord(html);
  if (match) {
    throw new Error(
      `The claims rule forbids the unquoted claim "${match}" in the published standard ` +
        `(${file}). Quote it as vocabulary or reword it.`,
    );
  }
}

/**
 * The register prints the suite's own ids and the mapping page keys the same
 * rows by them, so the two lists are one list. If they ever drift, a reader
 * following `V2-S17` from the mapping to the register lands on another job —
 * which is the one failure a standard's identifiers exist to prevent.
 *
 * Both pages anchor a row by its published id, so the emitted anchors are the
 * list to compare, and comparing them also proves the ids are linkable.
 */
export function assertRegisterIds(jobsHtml: string, scopeHtml: string): void {
  const anchors = (html: string): string[] =>
    [...html.matchAll(/<tr id="(v2-[sa]\d+)"/g)].map((match) => match[1] ?? "");
  const register = anchors(jobsHtml);
  const mapping = anchors(scopeHtml);
  if (register.length !== REGISTER_ROWS) {
    throw new Error(
      `The register anchors ${register.length} jobs; the suite publishes ${REGISTER_ROWS}.`,
    );
  }
  if (mapping.length !== register.length) {
    throw new Error(
      `The register anchors ${register.length} jobs and the mapping ${mapping.length}: ` +
        "one table gained or lost a row.",
    );
  }
  if (register.join(",") !== mapping.join(",")) {
    const first = register.findIndex((id, index) => id !== mapping[index]);
    throw new Error(
      `The register and the mapping disagree at row ${first + 1}: ` +
        `the register publishes ${register[first] ?? "(none)"}, the mapping ${mapping[first] ?? "(none)"}.`,
    );
  }
}

function validateClaims(pages: Page[]): void {
  for (const page of pages) {
    assertClaimFree(page.file, page.html);
  }
}

/**
 * The URL gate: every tarestandard.org URL a generated index emits must have
 * its file in the output directory. A page the build did not write is a route
 * the deploy cannot serve — the `/settled` failure this gate is named after.
 */
export function assertEmittedUrlsResolve(
  outDir: string,
  sources: Readonly<Record<string, string>>,
  /** The files this build is about to write; when omitted, checked on disk. */
  plannedFiles?: ReadonlySet<string>,
): void {
  const origin = SITE_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${origin}(/[^\\s)"'<>]*)?`, "g");
  for (const [name, contents] of Object.entries(sources)) {
    for (const match of contents.matchAll(pattern)) {
      // A citation link carries an anchor and prose carries a full stop; both
      // address the page, not a different route.
      const path = (match[1] ?? "/").replace(/#.*$/, "").replace(/[.,;:!]+$/, "");
      const relative = path.replace(/^\//, "");
      const candidates = relative === "" ? ["index.html"] : [relative, `${relative}.html`];
      const exists = (candidate: string) =>
        plannedFiles ? plannedFiles.has(candidate) : existsSync(join(outDir, candidate));
      if (!candidates.some(exists)) {
        throw new Error(
          `The ${name} publishes ${SITE_ORIGIN}${path}, but the build writes no ` +
            `${candidates.join(" or ")} in ${outDir}. A URL is emitted only when its page exists.`,
        );
      }
    }
  }
}

/** Publish the frozen editions exactly as committed; they are never rebuilt. */
function copyEditions(outDir: string, files: string[]): void {
  const source = join(REPO_ROOT, "standard-site", "editions");
  if (!existsSync(source)) return;
  cpSync(source, join(outDir, "editions"), { recursive: true });
  for (const entry of readdirSync(join(outDir, "editions"), { recursive: true })) {
    const path = join("editions", String(entry));
    if (path.endsWith(".html") || path.endsWith(".css") || path.endsWith(".md")) {
      files.push(path);
    }
  }
}

function write(outDir: string, file: string, contents: string): void {
  const target = join(outDir, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

/**
 * The dated record, asserted before anything is written.
 *
 * `STANDARD_DATE` is when v1.0 published and `SUITE_RELEASE_DATE` is when suite
 * v2.2 shipped: two facts the frame prints together from two constants. Every
 * page carries the derived line in its running head, its structured data
 * carries `datePublished`/`dateModified` and the suite version, the margin and
 * rail carry both dates as `<time>`, the sitemap dates every document from the
 * release, and the agent index prints the same line. A hardcoded line, a stale
 * date or a swapped pair fails the build here.
 */
export function assertDatedRecord(
  pages: readonly Page[],
  indexes: { sitemap: string; llms: string },
): void {
  const runningHead = `<span class="running-version">${escapeHtml(STANDARD_VERSION_LINE)}</span>`;
  const staleLine = `Tare Standard ${STANDARD_VERSION} · suite ${SUITE_VERSION} · ${STANDARD_DATE}`;
  for (const page of pages) {
    if (!page.html.includes(runningHead)) {
      throw new Error(
        `The running head on ${page.file} does not print the derived line ` +
          `"${STANDARD_VERSION_LINE}".`,
      );
    }
    // The frame, not the prose: the changelog legitimately dates the same
    // release by both the standard's publication and the suite's release.
    const frame = [
      page.html.match(/<div class="running-head">([\s\S]*?)<\/div>/)?.[1] ?? "",
      page.html.match(/<aside class="margin"[\s\S]*?<\/aside>/)?.[0] ?? "",
      page.html.match(/<dl class="doc-meta">[\s\S]*?<\/dl>/)?.[0] ?? "",
    ].join("\n");
    if (frame.includes(staleLine)) {
      throw new Error(
        `The frame on ${page.file} still prints the old compound line "${staleLine}": ` +
          "the standard's publication and the suite's release are two facts.",
      );
    }
    // The same bug in another arrangement: the suite version printed within a
    // short run of the standard's publication date.
    const fused = new RegExp(
      `suite ${SUITE_VERSION.replace(/\./g, "\\.")}[^<\n]{0,80}${STANDARD_DATE}`,
    );
    if (fused.test(frame)) {
      throw new Error(
        `The frame on ${page.file} prints suite ${SUITE_VERSION} within 80 characters ` +
          `of ${STANDARD_DATE}; the suite shipped ${SUITE_RELEASE_DATE}.`,
      );
    }
    if (page.html.includes('<aside class="margin"')) {
      for (const date of [STANDARD_DATE, SUITE_RELEASE_DATE]) {
        if (!page.html.includes(`<time datetime="${date}">${date}</time>`)) {
          throw new Error(
            `The citation on ${page.file} does not carry ${date} as a <time> element.`,
          );
        }
      }
    }
    const raw = page.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    if (raw === undefined) continue; // the 404 publishes no canonical record
    const data = JSON.parse(raw) as {
      datePublished?: unknown;
      dateModified?: unknown;
      additionalProperty?: { value?: unknown };
    };
    if (data.datePublished !== STANDARD_DATE || data.dateModified !== SUITE_RELEASE_DATE) {
      throw new Error(
        `The structured data on ${page.file} dates the record ` +
          `${String(data.datePublished)}/${String(data.dateModified)}; expected ` +
          `${STANDARD_DATE}/${SUITE_RELEASE_DATE}.`,
      );
    }
    if (data.additionalProperty?.value !== SUITE_VERSION) {
      throw new Error(`The structured data on ${page.file} does not carry suite ${SUITE_VERSION}.`);
    }
  }
  const lastmods = [...indexes.sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map(
    (match) => match[1] ?? "",
  );
  if (
    lastmods.length !== PUBLISHED_PAGE_URLS.length ||
    lastmods.some((date) => date !== SUITE_RELEASE_DATE)
  ) {
    throw new Error(
      `The sitemap dates its pages ${lastmods.join(", ")}; every published document ` +
        `changed when suite ${SUITE_VERSION} shipped (${SUITE_RELEASE_DATE}).`,
    );
  }
  if (!indexes.llms.includes(`Version: ${STANDARD_VERSION_LINE}`)) {
    throw new Error("llms.txt does not print the derived dated line.");
  }
}

function tablePipesRemain(html: string): boolean {
  return html.split("\n").some((line) => line.trim().startsWith("|") && line.includes("|"));
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(text: string, used: Set<string>): string {
  const base = slugify(text) || "section";
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function robotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

/**
 * `llms.txt`, the plain-text index an agent reads first: what the standard is,
 * where each document lives, and the Markdown source beside each page.
 */
function llmsTxt(docs: readonly StandardDoc[]): string {
  const documents = docs
    .map(
      (doc) =>
        `- [${doc.title}](${SITE_ORIGIN}${doc.url}): ${doc.summary} Source: ${SITE_ORIGIN}${doc.url}.md`,
    )
    .join("\n");
  return `# Tare Standard

> The published Code of Points for testing an AI agent against hotel front-desk work: 29 jobs, finding grades, the framework mapping and the suite's scope. Versioned, dated and free to read. A scan is a dated observation against this standard; it is not an accreditation.

Version: ${STANDARD_VERSION_LINE}

## Documents

${documents}

## The service

- [Tare scan](${SITE_ORIGIN.replace("tarestandard.org", "tarestandard.com")}): run one scan against a bot and get a dated result. The standard is public; the scan is the service.

## The record

- [Standard repository](${PUBLIC_REPO_URL}): every release as a tag, the full text, and the public issue tracker.
- [Propose a change](${PUBLIC_REPO_URL}/issues/new/choose): a correction, a scenario proposal, or a scope question.
`;
}

function sitemapXml(docs: readonly StandardDoc[]): string {
  const urls = [FRONT_PAGE.url, ...docs.map((doc) => doc.url)];
  // Every published document was last changed when suite v2.2 shipped; the
  // standard's own publication (STANDARD_DATE) is the earlier `datePublished`.
  const entries = urls
    .map(
      (url) =>
        `  <url><loc>${SITE_ORIGIN}${url === "/" ? "/" : url}</loc><lastmod>${SUITE_RELEASE_DATE}</lastmod></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#E8E2D2"/>
  <path d="M12 15h40v8H36v28h-8V23H12z" fill="#20241F"/>
  <rect x="12" y="53" width="40" height="2" fill="#A8321E"/>
</svg>
`;

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const result = buildStandardSite();
  const published = PUBLISHED_PAGE_URLS.join(", ");
  console.log(
    `Built the published standard at ${result.outDir} (${result.pages.length} pages; contents ${published})`,
  );
}
