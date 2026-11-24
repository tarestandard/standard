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
import { atomNotesFeed, loadNotes, type NoteEntry } from "./notes";
import {
  ACCESSIBILITY_PAGE,
  ERRATA_URL,
  FRONT_PAGE,
  LICENSE_NAME,
  LICENSE_URL,
  PUBLIC_REPO_URL,
  PUBLISHED_PAGE_URLS,
  PUBLISHED_STANDARDS,
  SHOPFRONT_DATE,
  SHOPFRONT_VERSION,
  SITE_DATE,
  SITE_ORIGIN,
  SITE_VERSION_LINE,
  STANDARD_DATE,
  STANDARD_VERSION,
  STANDARDS,
  type StandardDoc,
  type StandardEdition,
  TRADEMARK_URL,
} from "./standard-docs";
import {
  AIUC1_FAMILY_SIZES,
  assertFamilyBands,
  assertScopePrinted,
  loadScopeCounts,
  spellCount,
} from "./standard-scope";

/**
 * Render the published standards from `docs/standard/` into static assets.
 *
 * One build publishes both standards plus the chooser at `/`, each page carrying
 * the name, version and publication date of the edition it belongs to. The
 * generated site is not committed. `npm run build:standard` writes it to
 * `standard-site/dist/`, and `npm run check` runs this before the dry-run so a
 * document that does not render fails the gate. The Worker is static assets
 * only; no Markdown renderer ships to the edge.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The notes (#788): the one page of dated observations the site publishes. */
const NOTES_URL = "/notes";
const DEFAULT_OUT_DIR = join(REPO_ROOT, "standard-site", "dist");
const STYLESHEET = join(REPO_ROOT, "standard-site", "site.css");
const COPY_SCRIPT = join(REPO_ROOT, "standard-site", "copy.js");
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Narrow:wght@500;600;700&family=Roboto+Mono:wght@400;500;700&display=swap";
const FORBIDDEN = /\b(certified|compliant|guarantee(?:s|d)?)\b/i;
const TABLE_SEPARATOR = /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/m;
/** A table wider than the reading column only folds out at five columns or more. */
const WIDE_TABLE_COLUMNS = 5;
/** Four-column tables whose last column is prose: they fold out on their own. */
const PROSE_TABLE_VARIANTS = new Set(["coverage-glance", "checks", "levels", "anchors"]);
/**
 * One social card per surface: a neutral title card for the chooser and the
 * 404, and one card per edition for its documents. The alt text describes the
 * card that is actually attached, not the site's default.
 */
const OG_IMAGES = {
  site: {
    file: "standard-site/assets/og.png",
    url: `${SITE_ORIGIN}/assets/og.png`,
    alt: "Tare Standard — two published standards, the Agent Standard and the Shopfront Standard. Versioned, dated and free to read.",
  },
  agent: {
    file: "standard-site/assets/og-agent.png",
    url: `${SITE_ORIGIN}/assets/og-agent.png`,
    alt: `Tare Agent Standard ${STANDARD_VERSION} · published ${STANDARD_DATE} — the published Code of Points for AI agents.`,
  },
  shopfront: {
    file: "standard-site/assets/og-shopfront.png",
    url: `${SITE_ORIGIN}/assets/og-shopfront.png`,
    alt: `Tare Shopfront Standard ${SHOPFRONT_VERSION} · published ${SHOPFRONT_DATE} — the published standard for the surface a business exposes to an agent.`,
  },
} as const;

function ogImage(
  standard: StandardEdition | undefined,
): (typeof OG_IMAGES)[keyof typeof OG_IMAGES] {
  return standard ? OG_IMAGES[standard.key] : OG_IMAGES.site;
}
/** The 29-job register's four v2.2 attack jobs are its last four rows (#238). */
const REGISTER_ROWS = 29;
const AGENT_JOBS_URL = "/agent/jobs";
const AGENT_SCOPE_URL = "/agent/scope";

/** The published id shape a register's Id column must print, per standard. */
type IdRules = { pattern: RegExp; hint: string };
const REGISTER_IDS: Record<StandardEdition["key"], IdRules> = {
  // The agent register's ids carry the shelf letter: S for a guest job, X for
  // one of the four attack jobs.
  agent: { pattern: /^HFD-[SX]\d{2}$/, hint: "HFD-S01 or HFD-X01" },
  // The shopfront register's ids carry the capability the job tests.
  shopfront: { pattern: /^HFD-[FACR]\d{2}$/, hint: "HFD-F01, HFD-A01, HFD-C01 or HFD-R01" },
};
const REGISTER_ATTACK_ROWS = 4;

type Heading = { depth: number; id: string; text: string; number: string | null };

/** The register's v2.2 group row, once a table has rendered one. */
type RegisterGroup = { id: string; label: string; afterId: string };

export type Page = {
  url: string;
  file: string;
  html: string;
  anchors: Set<string>;
  /** The edition whose name, version and date the page prints; absent at site level. */
  standard?: StandardEdition;
};

export type BuildResult = {
  outDir: string;
  pages: string[];
  files: string[];
};

export type BuildOptions = {
  outDir?: string;
  /** Test hook: publish a different set of standards. Defaults to the committed set. */
  standards?: readonly StandardEdition[];
};

export function buildStandardSite(options: BuildOptions = {}): BuildResult {
  const outDir = resolve(options.outDir ?? DEFAULT_OUT_DIR);
  if (outDir === REPO_ROOT || outDir === dirname(REPO_ROOT)) {
    throw new Error(`Refusing to build the standard into ${outDir}`);
  }

  const ogNames = Object.values(OG_IMAGES).map((image) => image.file.split("/").pop() as string);
  if (new Set(ogNames).size !== ogNames.length) {
    throw new Error("Two social cards would be written to the same asset name.");
  }
  for (const image of Object.values(OG_IMAGES)) {
    const source = join(REPO_ROOT, image.file);
    if (!existsSync(source)) {
      throw new Error(
        `The social card is missing: ${relative(REPO_ROOT, source)}. ` +
          "Regenerate it with the committed composition before publishing.",
      );
    }
  }

  const css = readFileSync(STYLESHEET, "utf8");
  const standards = (options.standards ?? STANDARDS).filter((standard) => standard.published);
  const docs = standards.flatMap((standard) => standard.docs);
  const docsBySource = new Map(docs.map((doc) => [resolve(REPO_ROOT, doc.source), doc]));
  // One parse of the Family table drives the scope page's own reported counts,
  // the figure drawn beside that table and the build gate, so no numeral is
  // typed twice.
  const scope = loadScopeCounts();
  assertFamilyBands(scope);
  // The rail's current-section mark needs one selector per section: CSS
  // cannot compare `:target` with a link's href. Generate them from the same
  // heading ids the rail renders, and append them to the one stylesheet.
  const targetRules: string[] = [];

  const pages: Page[] = [];
  for (const standard of standards) {
    for (const doc of standard.docs) {
      pages.push(
        renderDocPage({
          doc,
          standard,
          docsBySource,
          targetRules,
          // The scope figure belongs beside the Family table it counts, not on
          // a title page that another standard would have to share.
          afterTable:
            doc.url === AGENT_SCOPE_URL && standard.key === "agent" ? scopeTally(scope) : "",
        }),
      );
    }
  }

  // The notes (#788): dated observations from the scans behind the standard.
  // The changelog records what the standard published; this records what we
  // found applying it, which is the thing a writer or an answer engine can
  // quote. Pushed before link validation and before the 404, because the
  // footer links it and the page set is ordered as the sitemap is.
  const notes = loadNotes();
  pages.push(renderNotes(standards, notes));

  pages.unshift(renderChooser(standards));
  pages.push(renderNotFound(standards));
  pages.push(renderAccessibility());

  // Feeds are files, not pages; the changelog's visible "Subscribe" link is
  // validated against the file this build will write, not the page set.
  const feedFiles = new Set([
    ...standards.flatMap((standard) => {
      const changelog = changelogDoc(standard);
      return changelog ? [`${changelog.url.slice(1)}.xml`] : [];
    }),
    "accessibility.md",
    "notes.xml",
  ]);
  validateLinks(
    pages,
    new Set([...docs.map((doc) => `${doc.url.slice(1)}.md`), "standard.json"]),
    feedFiles,
  );
  validateClaims(pages);
  const scopePage = pages.find((page) => page.url === AGENT_SCOPE_URL);
  if (!scopePage) {
    throw new Error(
      `The published set has no ${AGENT_SCOPE_URL} page, so the scope counts cannot be checked`,
    );
  }
  const scopeDoc = docs.find((doc) => doc.url === AGENT_SCOPE_URL);
  if (!scopeDoc) {
    throw new Error(
      `No published document owns ${AGENT_SCOPE_URL}, so the scope prose cannot be read`,
    );
  }
  assertScopePrinted({
    scopeHtml: scopePage.html,
    markdown: readFileSync(resolve(REPO_ROOT, scopeDoc.source), "utf8"),
    counts: scope,
  });
  const jobsPage = pages.find((page) => page.url === AGENT_JOBS_URL);
  if (!jobsPage) {
    throw new Error(
      `The published set has no ${AGENT_JOBS_URL} page, so the register's ids cannot be checked`,
    );
  }
  assertRegisterIds(jobsPage.html, scopePage.html);
  for (const page of pages) {
    // A published page may link to this repository on GitHub and nothing else:
    // any other github.com URL is a link into a tree a reader cannot open.
    const outside = page.html.match(/https:\/\/github\.com\/(?!tarestandard\/standard\b)[^"'\s<]+/);
    if (outside !== null) {
      throw new Error(
        `A published page links to a repository outside tarestandard/standard ` +
          `(${page.file}): ${outside[0]}; publish the document or render the ` +
          "reference as text.",
      );
    }
  }

  // One Atom feed per standard, built from the dated headings of its changelog.
  // The feed links the same anchors the page renders; a heading that no longer
  // matches its slug fails the build instead of publishing a dead link.
  const feeds = standards.map((standard) => {
    const changelog = changelogDoc(standard);
    if (!changelog) {
      throw new Error(`The ${standard.name} publishes no changelog, so it has no feed.`);
    }
    const page = pages.find((candidate) => candidate.url === changelog.url);
    if (!page) {
      throw new Error(
        `The ${standard.name} changelog page did not render, so its feed has no anchors.`,
      );
    }
    const entries = changelogEntries(standard);
    if (entries.length === 0) {
      throw new Error(
        `The ${standard.name} changelog has no dated "## YYYY-MM-DD — title" entry; ` +
          "the feed would be empty or undated.",
      );
    }
    return {
      file: `${changelog.url.slice(1)}.xml`,
      xml: atomFeed(standard, changelog, entries, page.anchors),
    };
  });
  // The notes feed carries the observations, not the editions: a consumer that
  // subscribes to the standard's changes is not asking to be told what we found
  // in the field, and the two must not be merged.
  feeds.push({ file: "notes.xml", xml: atomNotesFeed(notes) });

  // Build the two indexes and validate every URL they emit against the files
  // this build is about to write, before the output directory is touched. A
  // URL with no file is the `/settled` class of bug: published, advertised and
  // never deployed, and it must not leave a half-written directory behind.
  // The notes page is a site surface, like the chooser: its dated record is
  // the site's own date, and each entry prints its own day inside the page.
  const sitemap = sitemapXml(standards, [{ url: NOTES_URL, date: SITE_DATE }]);
  const llms = llmsTxt(standards);
  if (!existsSync(COPY_SCRIPT)) {
    throw new Error("The citation copy control is missing: standard-site/copy.js");
  }
  const copyScript = readFileSync(COPY_SCRIPT, "utf8");
  const planned = new Set<string>([
    ...pages.map((page) => page.file),
    ...docs.map((doc) => `${doc.url.slice(1)}.md`),
    ...feeds.map((feed) => feed.file),
    "assets/copy.js",
    "accessibility.md",
    "standard.json",
  ]);
  assertEmittedUrlsResolve(outDir, { "sitemap.xml": sitemap, "llms.txt": llms }, planned);
  // The dated record: each page prints the edition it belongs to, and the site
  // pages print the newest edition's date. Check every surface that prints it
  // before anything is written, so a hardcoded line cannot drift back in.
  assertDatedRecord(pages, { sitemap, llms }, standards);

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

  for (const feed of feeds) {
    write(outDir, feed.file, feed.xml);
    files.push(feed.file);
  }

  write(
    outDir,
    "accessibility.md",
    `> Reviewed ${SITE_DATE}. This statement covers the published standards at tarestandard.org and this site's own pages.\n\n` +
      readFileSync(resolve(REPO_ROOT, ACCESSIBILITY_PAGE.source), "utf8"),
  );
  files.push("accessibility.md");

  // The Workers static assets runtime reads `_headers` from the root of the
  // output and applies it to every response; it is a file, never a page.
  write(outDir, "_headers", readFileSync(join(REPO_ROOT, "standard-site", "_headers"), "utf8"));
  files.push("_headers");
  write(outDir, "assets/site.css", `${css}${generatedTargetRules(targetRules)}`);
  write(outDir, "assets/copy.js", copyScript);
  files.push("assets/copy.js");
  write(outDir, "favicon.svg", FAVICON);
  write(outDir, "robots.txt", robotsTxt());
  write(outDir, "sitemap.xml", sitemap);
  write(outDir, "llms.txt", llms);
  // The machine-readable release is a file, not a page: a consumer pins one
  // URL instead of parsing the pages (README, "Version"). Refuse to publish
  // bytes that are not the release the tests check.
  const releaseJson = readFileSync(join(REPO_ROOT, "standard.json"), "utf8");
  const release = JSON.parse(releaseJson) as { name?: unknown; standards?: unknown };
  if (release.name !== "Tare Standard" || !Array.isArray(release.standards)) {
    throw new Error(
      "standard.json is not the release: it must name Tare Standard and list its standards.",
    );
  }
  write(outDir, "standard.json", releaseJson);
  files.push("standard.json");
  for (const image of Object.values(OG_IMAGES)) {
    copyFileSync(
      join(REPO_ROOT, image.file),
      join(outDir, "assets", image.file.split("/").pop() as string),
    );
    files.push(`assets/${image.file.split("/").pop()}`);
  }
  files.push("assets/site.css", "favicon.svg", "robots.txt", "sitemap.xml", "llms.txt");

  copyEditions(outDir, files);

  return {
    outDir,
    pages: pages.map((page) => page.url),
    files: files.sort(),
  };
}

type DocPageOptions = {
  doc: StandardDoc;
  /** The edition whose name, version and date the page prints. */
  standard: StandardEdition;
  docsBySource: Map<string, StandardDoc>;
  targetRules: string[];
  /** A figure the page owns, rendered directly after its Family table. */
  afterTable?: string;
};

function renderDocPage({
  doc,
  standard,
  docsBySource,
  targetRules,
  afterTable = "",
}: DocPageOptions): Page {
  const sourcePath = resolve(REPO_ROOT, doc.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`Published document is missing: ${doc.source}`);
  }

  const markdown = readFileSync(sourcePath, "utf8");
  const idRules: IdRules | undefined = REGISTER_IDS[standard.key];
  if (idRules === undefined) {
    throw new Error(
      `No register id rules are registered for the "${standard.key}" standard. ` +
        "Add its published id shape to REGISTER_IDS before serving its register.",
    );
  }
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
  // A page owns at most one scope figure, even if its document gains a second
  // table with the same head: two `#tally-caption` ids would be a duplicate.
  let scopeFigureDrawn = false;

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
    // quoted as `#job-7` and a mapped scenario as `#hfd-s01` (no renumbering).
    const ids = token.rows.map((row) => {
      const cell = row[0];
      if (!cell) return null;
      const text = plainText(this.parser.parseInline(cell.tokens));
      const base = rowAnchorId(headers[0], text, idRules);
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
    // just wrote (a register that prints `HFD-X0x` in its first cell is grouped
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
        const groupId = "attack-jobs";
        const count = spellCount(attackRow.count);
        const groupLabel = `The ${count} attack jobs`;
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
    // Every wide table is a labelled, focusable region. The cue is rendered
    // only for a table that carries the fold-out min-width (720px); a table
    // that fits, or a three-column rule table that cannot overflow, must not
    // promise a scroll the reader cannot make. It is not aria-hidden, so the
    // promise is announced as well as seen.
    const region = [...headings]
      .reverse()
      .find((heading) => heading.depth === 2 || heading.depth === 3);
    const regionLabel = [label ? `${label} table` : "Table", region ? region.text : ""]
      .filter((part) => part !== "")
      .join(" — ");
    // The region stays keyboard-reachable for any table that could overflow at
    // a phone width; the cue follows the fold-out modifier alone.
    const scrollable = wide || token.header.length >= 3;
    const hintClass = variant === null ? "table-hint" : `table-hint table-hint--${variant}`;
    const hint = wide ? `<p class="${hintClass}">Scroll → for the rest of the table</p>\n` : "";
    const wrapper = `${hint}<div class="${classes}" role="region" aria-label="${escapeHtml(
      regionLabel,
    )}"${scrollable ? ' tabindex="0"' : ""}>${html}</div>\n`;
    // The scope figure is drawn from the same parse as the Family table, so the
    // pair travels as one block: beside the table from 1360, under it below.
    if (!scopeFigureDrawn && afterTable !== "" && headers.includes("AIUC-1 requirement")) {
      scopeFigureDrawn = true;
      return `<div class="scope-pair">\n${wrapper}${afterTable}</div>\n`;
    }
    return wrapper;
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

  // /agent/settled already owns `#cite-this` on its own "Cite this" heading, so
  // the citation block there takes the next id rather than duplicating the
  // anchor. No existing id moves, and "Cite this" always lands on the block.
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

  const metaLine = `<p class="doc-meta-line">${versionLineHtml(
    standard,
  )} <a href="${doc.url}.md">Source (Markdown)</a></p>`;
  // /agent/settled already owns `#cite-this` on its own "Cite this" heading, so
  // the block there takes the next id rather than duplicating the anchor. No
  // existing id moves, and "Cite this" always lands on the block itself.
  const citeLine = citationBlock(doc, standard, citeId);
  // The changelog is the only document with a feed; the link is in the head
  // for a feed reader and beside the citation for a reader.
  const feed =
    doc.nav === "Changelog"
      ? { href: `${doc.url}.xml`, title: `${standard.name} — changes` }
      : undefined;
  const feedLink = feed
    ? `<p class="doc-feed"><a href="${feed.href}">Subscribe to changes (Atom)</a></p>`
    : "";
  const decorated = insertAfterTitle(body, [metaLine, citeLine, feedLink, mobileToc]);
  const margin = `<aside class="margin" aria-label="Citation">
      <p class="margin-citation">${versionLineHtml(standard)}</p>
      <p class="margin-links"><a href="${standard.citeUrl}">How to cite</a><br><a href="${doc.url}.md">Source (Markdown)</a></p>
    </aside>`;

  // On the standard's own title page the rail's "Part of" is the site, not the
  // page itself; every other document belongs to the standard that publishes it.
  const partOf =
    doc.url === standard.base
      ? { url: "/", label: "Tare Standard" }
      : { url: standard.base, label: standard.name };
  const article = `<main id="main">
  <div class="doc-shell">
    <aside class="rail">
      ${tocHtml}
      <dl class="doc-meta">
        <div><dt>Part of</dt><dd><a href="${partOf.url}">${escapeHtml(partOf.label)}</a></dd></div>
        <div class="doc-meta-time"><dt>Published</dt><dd><time datetime="${standard.date}">${standard.date}</time></dd></div>
        <div><dt>Source</dt><dd><a href="${doc.url}.md">Markdown</a></dd></div>
      </dl>
    </aside>
    <article class="document">
${decorated}
      <p class="doc-end"><span>End of document</span> <a href="${standard.base}">Contents</a> · <a href="${standard.citeUrl}">How to cite</a></p>
    </article>
    ${margin}
  </div>
</main>`;

  return {
    url: doc.url,
    file: `${doc.url.slice(1)}.html`,
    anchors,
    standard,
    html: pageShell({
      title: `${doc.title} · Tare Standard`,
      description: doc.description,
      canonical: `${SITE_ORIGIN}${doc.url}`,
      currentUrl: doc.url,
      ogType: "article",
      doc,
      standard,
      feed,
      body: article,
    }),
  };
}

/** The edition's dated line with the date wrapped in `<time>`. */
function versionLineHtml(standard: StandardEdition): string {
  return `${escapeHtml(standard.name)} ${escapeHtml(standard.version)} · published <time datetime="${
    standard.date
  }">${standard.date}</time>`;
}

/**
 * One ruled, selectable citation at the end of a document (#231).
 *
 * The line is a single paragraph of text, styled `user-select: all`, so one
 * click selects it whole; a small copy control copies it when JavaScript is
 * available, and the same text is selectable when it is not. Every URL stays
 * visible as text on screen. No accessed date is printed: the build
 * does not observe one, and inventing it would be a false fact.
 */
function citationBlock(doc: StandardDoc, standard: StandardEdition, id: string): string {
  // A URL stays one string when copied, and may break after a slash: a phone
  // cannot hold a long URL on one line, and breaking mid-slug is worse than
  // breaking at a path boundary. The frozen-edition URL joins this block when
  // the first edition is frozen; until one exists, there is nothing to cite but
  // the live page.
  const linkUrl = (url: string) => escapeHtml(url).replaceAll("/", "/<wbr>");
  const canonical = `${SITE_ORIGIN}${doc.url}`;
  const sentenceId = `${id}-sentence`;
  const urlId = `${id}-url`;
  // One apparatus, at the top of the document: the sentence and every URL it
  // could be read as. The frozen edition link used to live only in the wide
  // screen margin, so a phone reader could not reach the dated version at all.
  return `<details class="doc-cite" id="${escapeHtml(id)}">
        <summary>Cite this</summary>
        <div class="cite-body">
          <p class="cite-line" id="${sentenceId}">${escapeHtml(standard.name)} ${escapeHtml(
            standard.version,
          )} · ${escapeHtml(doc.title)} · published <time datetime="${standard.date}">${
            standard.date
          }</time>.</p>
          <p class="cite-url"><span class="cite-url-label">This page</span> <span class="citation-url" id="${urlId}">${linkUrl(
            canonical,
          )}</span></p>
          <p class="cite-url"><span class="cite-url-label">Frozen edition</span> <span class="citation-url">${linkUrl(
            `${SITE_ORIGIN}/editions/${standard.date}${doc.url}`,
          )}</span></p>
          <p class="copy-row">
            <button class="copy-button" type="button" data-copy="${sentenceId}" data-copy-label="Citation">Copy citation</button>
            <button class="copy-button" type="button" data-copy="${urlId}" data-copy-label="URL">Copy URL</button>
            <span class="copy-status" role="status" aria-live="polite" aria-atomic="true"></span>
          </p>
        </div>
      </details>`;
}

/**
 * The scope as a figure: one ruled cell for each of AIUC-1's live requirements,
 * filled where the suite publishes a job that can speak to it, grouped in the
 * six family bands so the four at zero are visible as empty bands.
 *
 * The number is the site's most important claim and it was once set as prose in
 * every place it appeared. The bands show the 44 holes as plainly as the six
 * cells, and the figure is drawn from the same parse as the table it sits under.
 * No script and no chart library: fifty spans in six grids.
 *
 * The cells are counted, not ranked: the build knows how many requirements a
 * published job can speak to, not which cells of AIUC-1's own list they are, so
 * the first `covered` cells in a family fill and the caption says so.
 */
function scopeTally(scope: ReturnType<typeof loadScopeCounts>): string {
  const coveredByFamily = new Map(scope.families.map((family) => [family.letter, family.count]));
  const bands = AIUC1_FAMILY_SIZES.map((family) => {
    const covered = coveredByFamily.get(family.letter) ?? 0;
    const cells = Array.from({ length: family.size }, (_unused, index) => {
      const filled = index < covered;
      return `<span class="tally-cell${filled ? " tally-cell--with" : ""}"></span>`;
    }).join("");
    return `<div class="tally-band">
        <p class="tally-band-label"><span class="tally-band-letter">${family.letter}</span> ${escapeHtml(
          family.name,
        )} <span class="tally-band-count">${covered} of ${family.size}</span></p>
        <div class="tally-grid" aria-hidden="true">${cells}</div>
      </div>`;
  }).join("\n      ");

  return `<figure class="tally" aria-labelledby="tally-caption">
      <div class="tally-bands">
      ${bands}
      </div>
      <figcaption id="tally-caption" class="tally-caption">
        <span class="tally-count">${scope.covered} of ${scope.total}</span>
        AIUC-1 live requirements with a published job, in AIUC-1's six families. The cells are counted, not ranked.
      </figcaption>
    </figure>`;
}

function renderChooser(standards: readonly StandardEdition[]): Page {
  const entries = standards
    .map((standard) => {
      const documents = standard.docs.filter((doc) => doc.url !== standard.base);
      const docs = documents
        .map((doc) => `<li><a href="${doc.url}">${escapeHtml(doc.nav)}</a></li>`)
        .join("");
      return `<li class="standard-entry">
        <a class="standard-entry-link" href="${standard.base}">
          <span class="standard-name">${escapeHtml(standard.name)}</span>
          <span class="standard-claim">${escapeHtml(standard.claim)}</span>
          <span class="standard-meta"><span class="standard-version">${escapeHtml(
            standard.version,
          )}</span> · published <time datetime="${standard.date}">${standard.date}</time></span>
        </a>
        <p class="standard-docs-label">${spellCount(documents.length)} documents</p>
        <ul class="standard-docs">${docs}</ul>
      </li>`;
    })
    .join("\n      ");

  const body = `<main id="main" class="front">
  <article class="title-page">
    <header class="title-block">
      <h1>Tare Standard</h1>
      <p class="standfirst">The Code of Points for AI agents and the surfaces they use.</p>
    </header>
    <dl class="edition" aria-label="The site">
      <div><dt>Standards</dt><dd>${standards.length}</dd></div>
      <div><dt>Published</dt><dd><time datetime="${SITE_DATE}">${SITE_DATE}</time></dd></div>
      <div><dt>Access</dt><dd>Free to read</dd></div>
    </dl>
  </article>

  <section class="standards" aria-labelledby="standards">
    <h2 id="standards">The published standards</h2>
    <ol class="standard-index">
      ${entries}
    </ol>
  </section>

  <section class="site-note" aria-label="About this site">
    <p class="intro">Two published standards. One reads what a bot does when a guest talks to it; the other reads what a business exposes to an agent that never opens the page. Each is versioned, dated and free to read; the scan that applies them is a service at <a href="https://tarestandard.com">tarestandard.com</a>.</p>
    <p class="intro-note">The standards are public. A scan is one dated observation against one of them, not a status.</p>
  </section>
</main>`;

  return {
    url: FRONT_PAGE.url,
    file: "index.html",
    anchors: new Set(["main", "standards"]),
    html: pageShell({
      title: FRONT_PAGE.title,
      description: FRONT_PAGE.description,
      canonical: `${SITE_ORIGIN}/`,
      currentUrl: "/",
      ogType: "website",
      standards,
      body,
    }),
  };
}

function renderNotes(standards: readonly StandardEdition[], notes: readonly NoteEntry[]): Page {
  const entries = notes
    .map(
      (note) => `<article class="note" id="${note.date}">
      <header class="note-head">
        <time datetime="${note.date}">${note.date}</time>
        <h2>${escapeHtml(note.title)}</h2>
      </header>
      <div class="note-body">${note.html}</div>
    </article>`,
    )
    .join("\n      ");

  const body = `<main id="main" class="front">
  <article class="title-page">
    <header class="title-block">
      <h1>Notes</h1>
      <p class="standfirst">Dated observations from the scans behind the standard.</p>
    </header>
    <p class="intro">Each entry is one thing we ran, the day we ran it, and what the transcript or the capture contained — including the runs that captured nothing. These are findings, not scores: nothing here prints a band, and no property is named without its consent.</p>
    <p class="intro-note">Subscribe: <a href="/notes.xml">Atom feed</a>. The standard itself is at <a href="/">the front page</a>.</p>
  </article>

  <section class="notes" aria-labelledby="notes">
    <h2 id="notes">The record</h2>
    ${entries}
  </section>
</main>`;

  return {
    url: NOTES_URL,
    file: "notes.html",
    anchors: new Set(["main", ...notes.map((note) => note.date)]),
    html: pageShell({
      title: "Notes — Tare Standard",
      description:
        "Dated observations from the scans behind Tare Standard: what the bots did, what the pages exposed, and the runs that captured nothing.",
      canonical: `${SITE_ORIGIN}${NOTES_URL}`,
      currentUrl: NOTES_URL,
      ogType: "website",
      standards,
      section: "Notes",
      feed: { title: "Tare Standard — notes", href: `${NOTES_URL}.xml` },
      body,
    }),
  };
}

function renderNotFound(standards: readonly StandardEdition[]): Page {
  const groups = standards
    .map((standard) => {
      const docs = standard.docs
        .filter((doc) => doc.url !== standard.base)
        .map((doc) => `<li><a href="${doc.url}">${escapeHtml(doc.nav)}</a></li>`)
        .join("");
      return `<section class="not-found-group" aria-labelledby="not-found-${standard.key}">
        <h2 id="not-found-${standard.key}"><a href="${standard.base}">${escapeHtml(
          standard.name,
        )}</a><span class="not-found-version">${escapeHtml(
          standard.version,
        )} · published ${standard.date}</span></h2>
        <ul class="not-found-docs">${docs}</ul>
      </section>`;
    })
    .join("\n      ");

  // The agent standard lived at the root before the split. Name the six old
  // paths explicitly and prove each still has a live document, so a later
  // document cannot be presented as moved when it never was.
  const agent = standards.find((standard) => standard.key === "agent");
  if (!agent) {
    throw new Error(
      "The 404 recovery list needs the agent standard's old root paths; the build publishes none.",
    );
  }
  const OLD_AGENT_PATHS = ["/jobs", "/grades", "/scope", "/settled", "/changelog", "/protocol"];
  const movedItems = OLD_AGENT_PATHS.map((oldPath) => {
    const url = `${agent.base}${oldPath}`;
    const doc = agent.docs.find((candidate) => candidate.url === url);
    if (!doc) {
      throw new Error(`The 404 lists ${oldPath} as moved, but ${url} is not a published document.`);
    }
    return `<li><code>${escapeHtml(oldPath)}</code> <span aria-hidden="true">→</span> <a href="${escapeHtml(
      url,
    )}">${escapeHtml(url)}</a></li>`;
  });
  const moved = `<ul>${movedItems.join("")}</ul>`;

  const body = `<main id="main" class="front">
  <div class="not-found">
    <h1><span class="not-found-code">404</span> This page is not in the Code of Points.</h1>
    <p>The standards publish their documents. The old contents moved when the site began publishing two.</p>
    <div class="not-found-groups">
      ${groups}
    </div>
    <section class="not-found-moved" aria-labelledby="not-found-moved">
      <h2 id="not-found-moved">Moved from the old contents</h2>
      ${moved}
    </section>
    <p class="not-found-home"><a href="/">Contents</a></p>
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
      standards,
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
  /** The edition whose name, version and date the page prints; absent at site level. */
  standard?: StandardEdition;
  /** The set a site-level page's navigation lists. Defaults to the committed set. */
  standards?: readonly StandardEdition[];
  /** The running head's left slot; defaults from the page kind. */
  section?: string;
  /** An Atom feed for this page, when the document publishes changes. */
  feed?: { href: string; title: string };
  body: string;
};

function pageShell({
  title,
  description,
  canonical,
  currentUrl,
  ogType,
  doc,
  standard,
  standards = PUBLISHED_STANDARDS,
  section: sectionLabel,
  feed,
  body,
}: ShellOptions): string {
  const canonicalTag = canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "";
  const robotsTag = canonical ? `<meta name="robots" content="index,follow">` : "";
  const ogUrl = canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : "";
  // The running head's left slot is the section, as a printed page would set
  // it; the edition's dated line stays on the right.
  const section = sectionLabel ?? (doc ? doc.title : currentUrl === "/" ? "Contents" : "Not found");
  const versionLine = standard ? standard.versionLine : SITE_VERSION_LINE;
  const pageDate = standard ? standard.date : SITE_DATE;
  const og = ogImage(standard);
  const structuredData = jsonLd({ title, description, canonical, currentUrl, doc, standard });
  const feedTag = feed
    ? `<link rel="alternate" type="application/atom+xml" title="${escapeHtml(
        feed.title,
      )}" href="${escapeHtml(feed.href)}">`
    : "";
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
<meta property="og:image" content="${og.url}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(og.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${og.url}">
<meta name="twitter:image:alt" content="${escapeHtml(og.alt)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${escapeHtml(FONT_URL)}" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
${feedTag}
${structuredData}
</head>
<body>
<a class="skip" href="#main">Skip to the contents</a>
<header class="masthead">
  <div class="masthead-inner">
    <a class="wordmark" href="/">
      <span class="wordmark-name">Tare Standard</span>
      <span class="wordmark-sub">Code of Points</span>
    </a>
    ${siteNav(standard, currentUrl, standards)}
  </div>
  <div class="running-head">
    <span class="running-section">${escapeHtml(section)}</span>
    <span class="running-version">${datedLine(versionLine, pageDate)}</span>
  </div>
</header>
${body}
${colophon(standard, doc)}
<script src="/assets/copy.js" defer></script>
</body>
</html>
`;
}

function jsonLd({
  title,
  description,
  canonical,
  currentUrl,
  doc,
  standard,
}: {
  title: string;
  description: string;
  canonical: string | null;
  currentUrl: string | null;
  doc?: StandardDoc;
  standard?: StandardEdition;
}): string {
  if (!canonical) return "";
  const publisher = {
    "@type": "Organization",
    name: "Tare Standard",
    url: `${SITE_ORIGIN}/`,
  };
  const data =
    doc && standard
      ? {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          name: doc.title,
          headline: doc.title,
          description: doc.description,
          url: canonical,
          datePublished: standard.date,
          dateModified: standard.date,
          version: standard.version,
          license: LICENSE_URL,
          publisher,
          isBasedOn: PUBLIC_REPO_URL,
        }
      : currentUrl !== null && currentUrl !== "/"
        ? {
            // A site-level page that is not the chooser (the accessibility
            // statement) is one WebPage, not a second WebSite claim.
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: title,
            description,
            url: canonical,
            datePublished: SITE_DATE,
            dateModified: SITE_DATE,
            license: LICENSE_URL,
            publisher,
            isBasedOn: PUBLIC_REPO_URL,
          }
        : {
            // A site that publishes two editions has no single version to state;
            // its date is the newest edition's, and each document names its own.
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Tare Standard",
            description,
            url: canonical,
            datePublished: SITE_DATE,
            dateModified: SITE_DATE,
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
  // Four-column reference tables with prose columns: the phone cannot hold
  // them, so they fold out and scroll with a cue instead of shredding words.
  if (headers[0] === "Level" && headers[1] === "What an agent can complete") return "levels";
  if (headers[0] === "Anchor" && headers[1] === "What it is") return "anchors";
  return null;
}

/**
 * The register's first column, before and after it printed the suite's own ids.
 * `Id` is the current header; `#` is kept so a labelled register still anchors.
 */
function isRegisterHead(header: string | undefined): boolean {
  return header === "Id" || header === "#";
}

function rowAnchorId(header: string | undefined, cell: string, idRules: IdRules): string | null {
  const text = cell.trim();
  if (text === "" || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(text)) return null;
  if (header === "#" && /^\d+$/.test(text)) return `job-${text}`;
  // The register prints the suite's published id, so the row anchor and the
  // scenario's anchor on /scope are the same string: `HFD-S17` → `#hfd-s17`.
  if (header === "Id") {
    // The register's first column is the suite's published identifier. A value
    // that is not one is a typo the reader would meet as a dead citation, so it
    // fails the build rather than losing its anchor quietly.
    if (!idRules.pattern.test(text)) {
      throw new Error(
        `The register prints "${text}" in its Id column; a published id looks like ${idRules.hint}.`,
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
 * rows whose id starts `HFD-X`. The row-count fallback stays for a register that
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
      return cell && text(cell.tokens).startsWith("HFD-X") ? index : -1;
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
 * published label (`1` → `job-1`, `HFD-S01` → `hfd-s01`); nothing is renumbered.
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

/** Put the title apparatus (metadata, citation, contents) directly after the h1. */
function insertAfterTitle(body: string, fragments: readonly string[]): string {
  const titleEnd = body.indexOf("</h1>");
  if (titleEnd === -1) return body;
  const cut = titleEnd + "</h1>".length;
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

function siteNav(
  standard: StandardEdition | undefined,
  currentUrl: string | null,
  standards: readonly StandardEdition[],
): string {
  // A standard's pages carry that standard's own contents plus the way back to
  // the chooser; the site pages list the standards, because they belong to none.
  const items = standard
    ? [
        { url: "/", label: "Contents" },
        ...standard.docs.map((doc) => ({
          url: doc.url,
          label: doc.url === standard.base ? "Overview" : doc.nav,
        })),
      ]
    : [
        { url: "/", label: "Contents" },
        ...standards.map((edition: StandardEdition) => ({
          url: edition.base,
          label: edition.name.replace(/^Tare /, ""),
        })),
      ];
  const links = items
    .map(({ url, label }) => {
      const current = url === currentUrl ? ` aria-current="page"` : "";
      return `<a href="${url}"${current}>${escapeHtml(label)}</a>`;
    })
    .join("\n      ");
  return `<nav class="site-nav" aria-label="${
    standard ? "The standard" : "The published standards"
  }">
      ${links}
    </nav>`;
}

/**
 * The dated line is one string a reader can copy, but the line has to wrap on a
 * phone. Wrap the date in `<time>` so the line breaks between words and never
 * inside the date (`2026-` / `11-14`).
 */
function datedLine(line: string, date: string): string {
  if (!line.includes(date)) {
    throw new Error(`The dated line "${line}" does not contain the edition date "${date}".`);
  }
  return escapeHtml(line).replace(date, `<time datetime="${date}">${date}</time>`);
}

function colophon(standard?: StandardEdition, doc?: StandardDoc): string {
  const contents = standard ? standard.base : "/";
  const changelog = standard
    ? (standard.docs.find((candidate) => candidate.nav === "Changelog")?.url ?? standard.base)
    : "/";
  const status = standard
    ? `Status: this is the first published edition of ${escapeHtml(
        standard.name,
      )}. Maintained by the Tare project; a correction that leaves what a job tests unchanged is recorded in the <a href="${changelog}">Changelog</a>, and an error can be reported at <a href="${ERRATA_URL}">the issue tracker</a>.`
    : `Status: this site publishes the standards listed at its contents, each with its own version and its own date. An error in one of them can be reported at <a href="${ERRATA_URL}">the issue tracker</a>.`;
  return `<footer class="colophon">
  <div class="colophon-inner">
    <div>
      <p class="colophon-wordmark">Tare Standard</p>
      <p class="colophon-split">The standard is public. The scan is a service. <a href="https://tarestandard.com">tarestandard.com</a> runs it.</p>
    </div>
    <div>
      <p class="colophon-claims">This site publishes what each standard tests and what a scan observed. It grants no status and no accreditation.</p>
      <p class="colophon-status">${status}</p>
      <p class="colophon-licence">Published under <a href="${LICENSE_URL}">${LICENSE_NAME}</a>: share it and adapt it with attribution; the marks are reserved — see the <a href="${TRADEMARK_URL}">trademark policy</a>.</p>
      <p class="colophon-version">${datedLine(
        standard ? standard.versionLine : SITE_VERSION_LINE,
        standard ? standard.date : SITE_DATE,
      )}</p>
      <p class="colophon-links"><a href="${contents}">Contents</a>${
        doc ? ` · <a href="${doc.url}.md">Source (Markdown)</a>` : ""
      } · <a href="/editions/${SITE_DATE}">Frozen edition</a> · <a href="/standard.json">Release (JSON)</a> · <a href="/notes">Notes</a> · <a href="${ACCESSIBILITY_PAGE.url}">Accessibility</a> · <a href="${PUBLIC_REPO_URL}">Repository</a>${
        standard ? ` · <a href="${standard.citeUrl}">How to cite</a>` : ""
      }</p>
    </div>
  </div>
</footer>`;
}

function resolveHref(
  href: string,
  doc: StandardDoc,
  docsBySource: Map<string, StandardDoc>,
): string | null {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return href;
  // A root-relative link is a URL the site owns. `validateLinks` resolves it
  // against the page set this build writes, so a link to another standard's
  // page is a legal cross-reference and a link to nothing still fails.
  if (href.startsWith("/")) return href;

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
  // Existing but unpublished: render as text, never as a link into an
  // unpublished file.
  return null;
}

function validateLinks(
  pages: Page[],
  sourceFiles: Set<string>,
  staticFiles: ReadonlySet<string>,
): void {
  const byUrl = new Map(pages.map((page) => [page.url, page]));

  for (const page of pages) {
    for (const match of page.html.matchAll(/<a\b[^>]*\bhref="(\/[^"]*)"/g)) {
      const href = match[1] ?? "";
      const [path = "", hash = ""] = href.split("#");
      // A source download or a feed has no page and no anchors of its own.
      if (sourceFiles.has(path.replace(/^\//, ""))) continue;
      if (staticFiles.has(path.replace(/^\//, ""))) continue;
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
 * following `HFD-S17` from the mapping to the register lands on another job —
 * which is the one failure a standard's identifiers exist to prevent.
 *
 * Both pages anchor a row by its published id, so the emitted anchors are the
 * list to compare, and comparing them also proves the ids are linkable.
 */
export function assertRegisterIds(jobsHtml: string, scopeHtml: string): void {
  const anchors = (html: string): string[] =>
    [...html.matchAll(/<tr id="(hfd-[sx]\d+)"/g)].map((match) => match[1] ?? "");
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
 * Each page prints the edition it belongs to, in its running head and its
 * structured data; the site pages print the newest edition's date. The sitemap
 * dates every page it lists, and llms.txt prints each edition's derived line. A
 * hardcoded line, a stale date or one standard's date smuggled into another's
 * frame fails the build.
 */
export function assertDatedRecord(
  pages: readonly Page[],
  indexes: { sitemap: string; llms: string },
  standards: readonly StandardEdition[] = PUBLISHED_STANDARDS,
): void {
  const lineFor = (page: Page) => page.standard?.versionLine ?? SITE_VERSION_LINE;
  const dateFor = (page: Page) => page.standard?.date ?? SITE_DATE;
  for (const page of pages) {
    const line = lineFor(page);
    const date = dateFor(page);
    const runningHead = `<span class="running-version">${datedLine(line, date)}</span>`;
    if (!page.html.includes(runningHead)) {
      throw new Error(
        `The running head on ${page.file} does not print the derived line "${line}".`,
      );
    }
    const raw = page.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    if (raw === undefined) continue; // the 404 publishes no canonical record
    const data = JSON.parse(raw) as { datePublished?: unknown; dateModified?: unknown };
    if (data.datePublished !== date || data.dateModified !== date) {
      throw new Error(
        `The structured data on ${page.file} dates the record ` +
          `${String(data.datePublished)}/${String(data.dateModified)}; expected ` +
          `${date}/${date}.`,
      );
    }
  }

  // The sitemap lists the chooser and every document once, each dated by the
  // edition that publishes it. The 404 is built and never listed.
  const expected = new Map(
    pages.filter((page) => page.url !== "/404").map((page) => [page.url, dateFor(page)]),
  );
  const entries = [
    ...indexes.sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g),
  ];
  if (entries.length !== expected.size) {
    throw new Error(
      `The sitemap lists ${entries.length} pages; this build writes ${expected.size}.`,
    );
  }
  for (const match of entries) {
    const loc = match[1] ?? "";
    const path = loc.replace(SITE_ORIGIN, "") || "/";
    const date = expected.get(path);
    if (date === undefined) {
      throw new Error(`The sitemap publishes ${loc}, which this build does not write.`);
    }
    if ((match[2] ?? "") !== date) {
      throw new Error(`The sitemap dates ${loc} ${match[2]}; the page prints ${date}.`);
    }
  }

  for (const standard of standards) {
    if (!indexes.llms.includes(`Version: ${standard.versionLine}`)) {
      throw new Error(`llms.txt does not print the dated line for ${standard.name}.`);
    }
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
 * The site-level accessibility statement.
 *
 * The prose is Markdown (`docs/site/accessibility.md`) so a correction is an
 * edit, not a page rebuild. The build supplies the review date from `SITE_DATE`
 * and the page wears the same frame as the standards: same masthead, running
 * head, typography and colophon. It is one page, not one per standard.
 */
function renderAccessibility(): Page {
  const source = resolve(REPO_ROOT, ACCESSIBILITY_PAGE.source);
  if (!existsSync(source)) {
    throw new Error(`The accessibility statement is missing: ${ACCESSIBILITY_PAGE.source}`);
  }
  const markdown = readFileSync(source, "utf8");
  const body = new Marked({ gfm: true }).parse(markdown, { async: false });
  if (typeof body !== "string" || body.trim() === "") {
    throw new Error(`The accessibility statement rendered nothing: ${ACCESSIBILITY_PAGE.source}`);
  }
  const canonical = `${SITE_ORIGIN}${ACCESSIBILITY_PAGE.url}`;
  const main = `<main id="main" class="statement">
  <article class="document">
    <h1>${escapeHtml(ACCESSIBILITY_PAGE.heading)}</h1>
    <p class="statement-meta">This statement covers the published standards at <a href="/">tarestandard.org</a>. Reviewed <time datetime="${SITE_DATE}">${SITE_DATE}</time>. <a href="/accessibility.md">Source (Markdown)</a>.</p>
${body}
  </article>
</main>`;
  return {
    url: ACCESSIBILITY_PAGE.url,
    file: ACCESSIBILITY_PAGE.file,
    anchors: new Set(["main"]),
    html: pageShell({
      title: ACCESSIBILITY_PAGE.title,
      description: ACCESSIBILITY_PAGE.description,
      canonical,
      currentUrl: ACCESSIBILITY_PAGE.url,
      ogType: "article",
      section: "Accessibility",
      body: main,
    }),
  };
}

type ChangelogEntry = { date: string; title: string; slug: string; summary: string };

/** The document that records a standard's dated editions. */
function changelogDoc(standard: StandardEdition): StandardDoc | undefined {
  return standard.docs.find((doc) => doc.nav === "Changelog");
}

/** Markdown to one line of text, for a feed summary. Not a renderer. */
function markdownToText(markdown: string): string {
  return markdown
    .replace(/^```[\s\S]*?```$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The dated `## YYYY-MM-DD — title` headings of a changelog, newest first.
 * A changelog with no dated heading fails the build: an undated feed is worse
 * than no feed, because a reader cannot tell what changed or when.
 */
function changelogEntries(standard: StandardEdition): ChangelogEntry[] {
  const doc = changelogDoc(standard);
  if (!doc) return [];
  const markdown = readFileSync(resolve(REPO_ROOT, doc.source), "utf8");
  const lines = markdown.split("\n");
  const entries: ChangelogEntry[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    // A dated heading with the wrong dash is a silent dropped release; name it.
    if (/^## \d{4}-\d{2}-\d{2}(?! — )/.test(line)) {
      throw new Error(
        `The changelog heading "${line}" is dated but not "## YYYY-MM-DD — title"; ` +
          "the feed would silently skip the release.",
      );
    }
    const match = /^## (\d{4}-\d{2}-\d{2}) — (.+)$/.exec(line);
    if (!match) continue;
    const [, date = "", title = ""] = match;
    const body: string[] = [];
    for (let next = index + 1; next < lines.length && !/^## /.test(lines[next] ?? ""); next += 1) {
      body.push(lines[next] ?? "");
    }
    const cleanTitle = title.trim();
    entries.push({
      date,
      title: cleanTitle,
      // The rendered heading's id is the slug of the whole heading line,
      // including its date; the feed must link that id, not the title alone.
      slug: slugify(`${date} — ${cleanTitle}`),
      summary: markdownToText(body.join("\n")).slice(0, 600),
    });
  }
  return entries.sort((left, right) => right.date.localeCompare(left.date));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * One Atom feed per standard. One entry per dated changelog heading; the entry
 * links the heading's own anchor, and a heading whose anchor the page no longer
 * renders fails the build, so a rename cannot publish a dead link.
 */
function atomFeed(
  standard: StandardEdition,
  doc: StandardDoc,
  entries: readonly ChangelogEntry[],
  anchors: ReadonlySet<string>,
): string {
  const feedUrl = `${SITE_ORIGIN}${doc.url}.xml`;
  const pageUrl = `${SITE_ORIGIN}${doc.url}`;
  const updated = `${entries[0]?.date ?? standard.date}T00:00:00Z`;
  const items = entries
    .map((entry) => {
      if (!anchors.has(entry.slug)) {
        throw new Error(
          `The changelog entry "${entry.date} — ${entry.title}" renders no #${entry.slug} anchor; ` +
            "the feed would link the page instead of the change.",
        );
      }
      const url = `${pageUrl}#${entry.slug}`;
      return `  <entry>
    <title>${escapeXml(`${entry.date} — ${entry.title}`)}</title>
    <id>${escapeXml(url)}</id>
    <link rel="alternate" type="text/html" href="${escapeXml(url)}"/>
    <updated>${entry.date}T00:00:00Z</updated>
    <summary type="text">${escapeXml(entry.summary)}</summary>
  </entry>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <title>${escapeXml(`${standard.name} — changes`)}</title>
  <subtitle>The dated record of what this standard has published.</subtitle>
  <id>${escapeXml(feedUrl)}</id>
  <updated>${updated}</updated>
  <link rel="self" type="application/atom+xml" href="${escapeXml(feedUrl)}"/>
  <link rel="alternate" type="text/html" href="${escapeXml(pageUrl)}"/>
  <author><name>Tare Standard</name><uri>${SITE_ORIGIN}/</uri></author>
  <rights>${escapeXml(LICENSE_NAME)}</rights>
${items}
</feed>
`;
}

/**
 * `llms.txt`, the plain-text index an agent reads first: what each standard is,
 * where each document lives, and the Markdown source beside each page.
 */
function llmsTxt(standards: readonly StandardEdition[]): string {
  const sections = standards
    .map((standard) => {
      const documents = standard.docs
        .map(
          (doc) =>
            `- [${doc.title}](${SITE_ORIGIN}${doc.url}): ${doc.summary} Source: ${SITE_ORIGIN}${doc.url}.md`,
        )
        .join("\n");
      const changelog = standard.docs.find((doc) => doc.nav === "Changelog");
      const changes = changelog
        ? `\n\nChanges: ${SITE_ORIGIN}${changelog.url}.xml (Atom, one entry per dated edition)`
        : "";
      return `## ${standard.name}

Version: ${standard.versionLine}

${documents}${changes}`;
    })
    .join("\n\n");
  return `# Tare Standard

> The published standards from Tare: the Agent Standard for what a bot does in a conversation, and the Shopfront Standard for what a business exposes to an agent. Each is versioned, dated and free to read. A scan is a dated observation against one standard; it is not an accreditation.

${sections}

## The site

- [Accessibility](${SITE_ORIGIN}${ACCESSIBILITY_PAGE.url}): the site's accessibility statement — the WCAG 2.2 AA target, how the site is checked, known limitations, and where to report a barrier.

## The release

- [Machine-readable release](${SITE_ORIGIN}/standard.json): one file — the version, the date, both standards, the counts, the thresholds, the levels and the grades.

## The service

- [Tare scan](${SITE_ORIGIN.replace("tarestandard.org", "tarestandard.com")}): run one scan against a bot and get a dated result. The standards are public; the scan is the service.

## The record

- [Standard repository](${PUBLIC_REPO_URL}): every release as a tag, the full text, and the public issue tracker.
- [Propose a change](${PUBLIC_REPO_URL}/issues/new/choose): a correction, a scenario proposal, or a scope question.
`;
}

function sitemapXml(
  standards: readonly StandardEdition[],
  extra: readonly { url: string; date: string }[] = [],
): string {
  const entries = [
    { url: FRONT_PAGE.url, date: SITE_DATE },
    ...standards.flatMap((standard) =>
      standard.docs.map((doc) => ({ url: doc.url, date: standard.date })),
    ),
    ...extra,
    { url: ACCESSIBILITY_PAGE.url, date: SITE_DATE },
  ]
    .map(
      ({ url, date }) => `  <url><loc>${SITE_ORIGIN}${url}</loc><lastmod>${date}</lastmod></url>`,
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
    `Built ${PUBLISHED_STANDARDS.length} standards at ${result.outDir} ` +
      `(${result.pages.length} pages; contents ${published})`,
  );
}
