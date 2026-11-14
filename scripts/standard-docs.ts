/**
 * The published standard's table of contents.
 *
 * One entry per Markdown document that ships to `tarestandard.org`. Adding a
 * file to `docs/standard/` does not publish it: this list is the publication
 * decision, and the build fails if an entry is missing or does not render.
 * `tests/standard-site.test.ts` pins the resulting page set.
 */

import { CHECKS, STEPS } from "./standard-numbers";
import { loadScopeCounts } from "./standard-scope";

export const SITE_ORIGIN = "https://tarestandard.org";
/** The standard's public record; the source repository is private. */
export const PUBLIC_REPO_URL = "https://github.com/tarestandard/standard";
/** The published standard's reuse terms: quote and share, no derivatives. */
export const LICENSE_NAME = "CC BY-ND 4.0";
export const LICENSE_URL = "https://creativecommons.org/licenses/by-nd/4.0/";
/** Where a reader reports an error in the published text. */
export const ERRATA_URL = `${PUBLIC_REPO_URL}/issues`;
export const STANDARD_VERSION = "v1.0";
export const SUITE_VERSION = "v2.2";
export const PROTOCOL_VERSION = "v1";
/** The day the standard's first public edition (v1.0) was published. */
export const STANDARD_DATE = "2026-11-12";
/** The day suite v2.2 shipped; the content date of every page published with it. */
export const SUITE_RELEASE_DATE = "2026-11-13";
/**
 * The frame's one dated line. The standard's publication and the suite's
 * release are two facts, derived from two constants so neither can drift:
 * a reader copying the line never dates v2.2 a day before it shipped.
 */
export const STANDARD_VERSION_LINE = `Tare Standard ${STANDARD_VERSION} · published ${STANDARD_DATE} · suite ${SUITE_VERSION} · released ${SUITE_RELEASE_DATE}`;
/**
 * The same dated line with each date wrapped in `<time>`, for the margin where
 * the machine-readable dates matter. Its text content is `STANDARD_VERSION_LINE`.
 */
export const STANDARD_VERSION_LINE_HTML =
  `Tare Standard ${STANDARD_VERSION} · published ` +
  `<time datetime="${STANDARD_DATE}">${STANDARD_DATE}</time> · suite ${SUITE_VERSION} · released ` +
  `<time datetime="${SUITE_RELEASE_DATE}">${SUITE_RELEASE_DATE}</time>`;

/**
 * The scope denominator the metadata prints, parsed from the Family table the
 * /scope page renders. A suite change that moves the table moves this string;
 * it is never typed twice.
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
  /** One line in the front page's contents table. */
  summary: string;
  /** The document's own version label in the margin rail. */
  version: string;
};

/** The only Markdown files that publish. Order is the contents order. */
export const STANDARD_DOCS: readonly StandardDoc[] = [
  {
    source: "docs/standard/hotel-frontdesk-scenarios-v22.md",
    url: "/jobs",
    nav: "Jobs",
    title: "Hotel front-desk scenario suite",
    description:
      "The 29 hotel front-desk jobs in the Tare Standard v1.0 suite v2.2: the must and must-not, the gate capability, the policy anchor and the scoring rules.",
    summary:
      "The 29 scripted front-desk jobs, including four attack jobs, their required elements, gate capabilities and policy anchors.",
    version: `Suite ${SUITE_VERSION}`,
  },
  {
    source: "docs/standard/finding-grades.md",
    url: "/grades",
    nav: "Grades",
    title: "Finding grades",
    description:
      "How the Tare Standard grades a failed job critical, major or minor — and what a grade is not.",
    summary:
      "How one missed job becomes a critical, major or minor finding, and the line a grade does not cross.",
    version: `Standard ${STANDARD_VERSION}`,
  },
  {
    source: "docs/standard/mappings.md",
    url: "/scope",
    nav: "Scope",
    title: "Framework mapping and scope",
    description: `The framework map behind the Tare Standard — AIHA Appendix C, OWASP Agentic 2026, NIST AI RMF and the EU AI Act — with the suite's scope printed as ${SCOPE.covered} of ${SCOPE.total} AIUC-1 requirements.`,
    summary: `The job-by-job framework map, and the suite's scope: ${SCOPE.covered} of ${SCOPE.total} AIUC-1 requirements, with the zero families named.`,
    version: `Suite ${SUITE_VERSION}`,
  },
  {
    source: "docs/standard/what-the-scan-settles.md",
    url: "/settled",
    nav: "Settled",
    title: "What the scan settles",
    description: `How much of the Tare Standard's suite a scan settles from the transcript automatically: ${CHECKS.settled} of ${CHECKS.total} check questions and ${STEPS.settled} of ${STEPS.total} required steps, with the rest classed — and why no single percentage is printed.`,
    summary:
      "The count of what a machine settles from the transcript, with every check and step classed and the reason there is no single percentage.",
    version: `Suite ${SUITE_VERSION}`,
  },
  {
    source: "docs/standard/changelog.md",
    url: "/changelog",
    nav: "Changelog",
    title: "Changelog",
    description:
      "The dated record of what the Tare Standard published: the first public edition of v1.0 and the suite it names.",
    summary:
      "Every release, dated, with what it changed and what it did not: the two version numbers and when they moved.",
    version: `Standard ${STANDARD_VERSION}`,
  },
  {
    source: "docs/standard/discrimination-test-protocol.md",
    url: "/protocol",
    nav: "Protocol",
    title: "Discrimination test protocol",
    description:
      "The protocol that decides whether the Tare Standard suite separates a good hotel agent from a bad one before the standard is built on it.",
    summary:
      "The test that decides whether the suite discriminates: the sample, the six first runs, and the pass criteria for the test itself.",
    version: `Protocol ${PROTOCOL_VERSION}`,
  },
];

/** Every published page, including the front page and the error page. */
export const PUBLISHED_PAGE_URLS = ["/", ...STANDARD_DOCS.map((doc) => doc.url)] as const;

export const FRONT_PAGE = {
  url: "/",
  title: "Tare Standard — the published Code of Points",
  description:
    "The Tare Standard: 29 published hotel front-desk jobs, the rules that score them, the finding grades and the suite's scope. Versioned, dated and free to read.",
} as const;
