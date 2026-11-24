/**
 * The site's two standards and the documents they publish.
 *
 * `STANDARDS` is the model: each edition's name, version, publication date, URL
 * base and document list. `STANDARD_DOCS` and `SHOPFRONT_DOCS` are the
 * publication decision — adding a file to `docs/standard/<standard>/` does not
 * publish it, and the build fails if an entry is missing or does not render.
 * `tests/standard-site.test.ts` pins the resulting page set.
 */

import { CHECKS, STEPS } from "./standard-numbers";
import { loadScopeCounts } from "./standard-scope";

export const SITE_ORIGIN = "https://tarestandard.org";
/** The standard's public source repository and issue tracker. */
export const PUBLIC_REPO_URL = "https://github.com/tarestandard/standard";
/** The published standard's reuse terms: quote and share, no derivatives. */
export const LICENSE_NAME = "CC BY 4.0";
export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const TRADEMARK_URL = "https://github.com/tarestandard/standard/blob/main/TRADEMARKS.md";
/** Where a reader reports an error in the published text. */
export const ERRATA_URL = `${PUBLIC_REPO_URL}/issues`;
/** The standard's name. The family is "Tare"; this document is the agent one. */
export const STANDARD_NAME = "Tare Agent Standard";
export const STANDARD_VERSION = "v1.0";
/**
 * The day this standard was first published. One standard, one date: the
 * scanner's own suite version is the implementer's business and is not printed
 * as if it were a second edition of this document.
 */
export const STANDARD_DATE = "2026-11-14";
/** The frame's one dated line, derived from the two constants above. */
export const STANDARD_VERSION_LINE = `${STANDARD_NAME} ${STANDARD_VERSION} · published ${STANDARD_DATE}`;

/**
 * The scope denominator the metadata prints, parsed from the Family table the
 * /agent/scope page renders. A suite change that moves the table moves this
 * string; it is never typed twice.
 */
const SCOPE = loadScopeCounts();

export type StandardDoc = {
  /** Path from the repository root. */
  source: string;
  /** Stable, short, human URL. No trailing slash. */
  url: string;
  /** The label in the site navigation. */
  nav: string;
  /** The `<title>` and contents-table name. */
  title: string;
  /** The meta description. */
  description: string;
  /** One line that says what the document settles, used by the chooser and llms.txt. */
  summary: string;
};

/** The agent standard's documents, title page first. Order is the contents order. */
export const STANDARD_DOCS: readonly StandardDoc[] = [
  {
    source: "docs/standard/agent/index.md",
    url: "/agent",
    nav: "Standard",
    title: "The Tare Agent Standard",
    description:
      "What the Tare Agent Standard tests: the 29 hotel front-desk jobs, how a scan scores them, how a finding is graded, and what the scan can settle.",
    summary: "What this standard is, the claim it makes, and the pages it publishes.",
  },
  {
    source: "docs/standard/agent/hotel-frontdesk-scenarios-v22.md",
    url: "/agent/jobs",
    nav: "Jobs",
    title: "Hotel front-desk jobs",
    description:
      "The 29 hotel front-desk jobs in the Tare Agent Standard v1.0: the must and must-not, the gate capability, the policy anchor and the scoring rules.",
    summary:
      "The 29 scripted front-desk jobs, including four attack jobs, their required elements, gate capabilities and policy anchors.",
  },
  {
    source: "docs/standard/agent/finding-grades.md",
    url: "/agent/grades",
    nav: "Grades",
    title: "Finding grades",
    description:
      "How the Tare Agent Standard grades a failed job critical, major or minor — and what a grade is not.",
    summary:
      "How one missed job becomes a critical, major or minor finding, and the line a grade does not cross.",
  },
  {
    source: "docs/standard/agent/mappings.md",
    url: "/agent/scope",
    nav: "Scope",
    title: "Framework mapping and scope",
    description: `The framework map behind the Tare Agent Standard — AIHA Appendix C, OWASP Agentic 2026, NIST AI RMF and the EU AI Act — with the suite's scope printed as ${SCOPE.covered} of ${SCOPE.total} AIUC-1 requirements.`,
    summary: `The job-by-job framework map, and the suite's scope: ${SCOPE.covered} of ${SCOPE.total} AIUC-1 requirements, with the zero families named.`,
  },
  {
    source: "docs/standard/agent/what-the-scan-settles.md",
    url: "/agent/settled",
    nav: "Settled",
    title: "What the scan settles",
    description: `How much of the Tare Agent Standard a scan settles from the transcript automatically: ${CHECKS.settled} of ${CHECKS.total} check questions and ${STEPS.settled} of ${STEPS.total} required steps, with the rest classed — and why no single percentage is printed.`,
    summary:
      "The count of what a machine settles from the transcript, with every check and step classed and the reason there is no single percentage.",
  },
  {
    source: "docs/standard/agent/changelog.md",
    url: "/agent/changelog",
    nav: "Changelog",
    title: "Changelog",
    description:
      "The dated record of what the Tare Agent Standard published: the first public edition, v1.0, and the day it was published.",
    summary: "Every release, dated, with what it changed and what it did not.",
  },
  {
    source: "docs/standard/agent/discrimination-test-protocol.md",
    url: "/agent/protocol",
    nav: "Protocol",
    title: "Discrimination test protocol",
    description:
      "The protocol that decides whether the Tare Agent Standard separates a good hotel agent from a bad one before the standard is built on it.",
    summary:
      "The test that decides whether the suite discriminates: the sample, the six first runs, and the pass criteria for the test itself.",
  },
];

/**
 * The site publishes standards, not "the standard". One entry per edition: the
 * name a reader cites, the version and date it was published, the URL base its
 * documents hang off, and the one-line claim the chooser prints. `published:
 * false` keeps a standard's documents in the repository without putting them on
 * the site; both standards are published today.
 */
export type StandardKey = "agent" | "shopfront";

export type StandardEdition = {
  key: StandardKey;
  /** What a reader cites. */
  name: string;
  version: string;
  /** The day this edition was published, ISO. */
  date: string;
  /** The dated line every page of this standard prints. */
  versionLine: string;
  /** URL prefix for its documents; "" means the site root. */
  base: string;
  published: boolean;
  /** The one-sentence claim the chooser prints. */
  claim: string;
  /** Where "How to cite" lands for this standard: a section of its own text. */
  citeUrl: string;
  docs: readonly StandardDoc[];
};

const AGENT: StandardEdition = {
  key: "agent",
  name: STANDARD_NAME,
  version: STANDARD_VERSION,
  date: STANDARD_DATE,
  versionLine: STANDARD_VERSION_LINE,
  base: "/agent",
  published: true,
  claim:
    "What a bot does when a guest talks to it: 29 published hotel front-desk jobs, scored E and D on a dated transcript, with every miss graded.",
  citeUrl: "/agent/scope#how-to-cite-this",
  docs: STANDARD_DOCS,
};

export const SHOPFRONT_NAME = "Tare Shopfront Standard";
export const SHOPFRONT_VERSION = "v1.0";
export const SHOPFRONT_DATE = "2026-11-14";
export const SHOPFRONT_VERSION_LINE = `${SHOPFRONT_NAME} ${SHOPFRONT_VERSION} · published ${SHOPFRONT_DATE}`;

/** The shopfront standard's documents, title page first. */
export const SHOPFRONT_DOCS: readonly StandardDoc[] = [
  {
    source: "docs/standard/shopfront/index.md",
    url: "/shopfront",
    nav: "Standard",
    title: "The Tare Shopfront Standard",
    description:
      "What a business exposes to an agent: the four capabilities, the ladder, the evidence it can be read with, and the claim the standard makes.",
    summary: "What this standard is, the claim it makes, and what it refuses.",
  },
  {
    source: "docs/standard/shopfront/levels.md",
    url: "/shopfront/levels",
    nav: "Levels",
    title: "Levels and grades",
    description:
      "The ladder from Level 1 findable to Level 5 delegable, the grade printed beside it, and why a surface that refuses an agent has no level at all.",
    summary: "The five levels, the A–F grade, and the pair printed together.",
  },
  {
    source: "docs/standard/shopfront/capabilities.md",
    url: "/shopfront/capabilities",
    nav: "Capabilities",
    title: "The four capabilities",
    description:
      "Find, act, confirm and recover — the test that decides each one — with admit and disclose as cross-cutting checks.",
    summary: "What each capability is, how it is tested, and what it is not.",
  },
  {
    source: "docs/standard/shopfront/evidence.md",
    url: "/shopfront/evidence",
    nav: "Evidence",
    title: "What a scan can capture",
    description:
      "Observable, inferred and not captured; the visitor layer; the consent boundary; and the rules for receipts, admission and the agent's authority.",
    summary: "The three evidence classes and the boundaries behind them.",
  },
  {
    source: "docs/standard/shopfront/jobs.md",
    url: "/shopfront/jobs",
    nav: "Jobs",
    title: "Hotel shopfront jobs",
    description:
      "The 22 jobs of the first shelf — 7 find, 5 act, 5 confirm, 5 recover — with what the surface must expose and the anchor each family borrows.",
    summary: "The hotel shelf: 22 jobs across the four families.",
  },
  {
    source: "docs/standard/shopfront/scope.md",
    url: "/shopfront/scope",
    nav: "Scope",
    title: "Scope and anchors",
    description:
      "What the standard covers, what it refuses, and the dated state of the drafts it borrows from — UCP, AP2, MCP, aipref and Schema.org.",
    summary: "The edge of the instrument, with the anchors dated.",
  },
  {
    source: "docs/standard/shopfront/changelog.md",
    url: "/shopfront/changelog",
    nav: "Changelog",
    title: "Changelog",
    description:
      "The dated record of what the Tare Shopfront Standard has published, and the rules this edition states as current text.",
    summary: "Every release of this standard, dated.",
  },
];

const SHOPFRONT: StandardEdition = {
  key: "shopfront",
  name: SHOPFRONT_NAME,
  version: SHOPFRONT_VERSION,
  date: SHOPFRONT_DATE,
  versionLine: SHOPFRONT_VERSION_LINE,
  base: "/shopfront",
  published: true,
  claim:
    "What a business exposes to an agent: a level, a grade and a job family, printed together and never separately.",
  citeUrl: "/shopfront/scope#how-to-cite-this-standard",
  docs: SHOPFRONT_DOCS,
};

/** Every standard the site knows about, published or not. */
export const STANDARDS: readonly StandardEdition[] = [AGENT, SHOPFRONT];

/** The ones whose pages exist today. */
export const PUBLISHED_STANDARDS: readonly StandardEdition[] = STANDARDS.filter(
  (standard) => standard.published,
);

/**
 * The day the site's newest edition was published. The chooser prints it; each
 * standard's own pages print their edition's date instead.
 */
/**
 * The newest ISO date in a list. ISO dates sort lexicographically, so the
 * newest edition is the last one; an empty list is a site with nothing to date.
 */
export function latestDate(dates: readonly string[]): string {
  const newest = [...dates].sort().at(-1);
  if (newest === undefined) {
    throw new Error("The site publishes no standard, so it has no publication date.");
  }
  return newest;
}

export const SITE_DATE = latestDate(PUBLISHED_STANDARDS.map((standard) => standard.date));

/** The line the site-level pages print. Each standard's pages print its own. */
export const SITE_VERSION_LINE = `Tare Standard · published ${SITE_DATE}`;

/** Every published page, the chooser first. The 404 is built but never listed. */
export const PUBLISHED_PAGE_URLS: readonly string[] = [
  "/",
  ...PUBLISHED_STANDARDS.flatMap((standard) => standard.docs.map((doc) => doc.url)),
  // The notes (#788): the one page of dated observations. It is a site page,
  // not a document of either standard, and it prints the site's dated line.
  "/notes",
];

export const FRONT_PAGE = {
  url: "/",
  title: "Tare Standard — the published standards",
  description:
    "Two published standards from Tare: the Agent Standard for what a bot does in a conversation, and the Shopfront Standard for what a business exposes to an agent. Versioned, dated and free to read.",
} as const;

/**
 * The site's accessibility statement, authored as Markdown so a correction is
 * a prose edit, not a page rebuild. It is site-level: it covers both standards
 * and the scan service's own record separately. The build supplies the review
 * date from `SITE_DATE`, so the page cannot go stale on its own.
 */
export const ACCESSIBILITY_PAGE = {
  url: "/accessibility",
  file: "accessibility.html",
  source: "docs/site/accessibility.md",
  title: "Accessibility · Tare Standard",
  heading: "Accessibility",
  description:
    "How the published standards at tarestandard.org target WCAG 2.2 Level AA: what is checked, what is known to fall short, and where to report a barrier.",
} as const;
