# Tare Standard

The published Code of Points: the standard an AI agent is tested against, and the
site that publishes it at [tarestandard.org](https://tarestandard.org).

This repository is the source of the published document — the text, the renderer,
the stylesheet, the build gates and the frozen editions. A clone of it can produce
the pages the site serves:

```bash
npm install
npm run build      # writes standard-site/dist
npm test           # the gates and the page tests
npm run typecheck
```

## What is in here

| Path | What it is |
|---|---|
| `docs/standard/` | The published text, one Markdown file per document |
| `scripts/build-standard.ts` | Markdown → the published pages, and the build gates |
| `scripts/standard-docs.ts` | The document set, versions and dates, in one place |
| `scripts/standard-scope.ts` | The scope numerals, derived from the mapping table |
| `scripts/standard-numbers.ts` | The counts the standard prints about its own instrument |
| `scripts/standard-instrument.ts` | The published instrument: pass thresholds, caps, deductions |
| `scripts/editions-apparatus.ts` | Corrects the frozen editions' apparatus, never their content |
| `standard-site/site.css` | The one stylesheet |
| `standard-site/editions/` | The dated editions, served at `/editions/<date>/` |
| `tests/` | The gates, the page tests and the heading-id fixture |

## The rules this repository enforces

The build fails, rather than publishing, when:

- a **claim** word appears unquoted — the standard never says certified, compliant
  or guaranteed about anything;
- an **internal link** does not resolve to a page that exists;
- a **register id** and the mapping table disagree about which job is which;
- a **dated line** is stale or fuses the standard's date with the suite's;
- an **emitted URL** does not resolve to a file the build wrote.

These are not conventions in a document; they are assertions in the build.

## The record

Every published edition is frozen under `standard-site/editions/<date>/` and served
at `/editions/<date>/` so a citation keeps working after the live pages move on.
Its content is never rebuilt; its apparatus may be corrected, and when it is, the
correction is dated in the archive banner and recorded here.

Errata and change proposals go to the [issue tracker](https://github.com/tarestandard/standard/issues).

## Version

The standard is versioned and dated. The current version is printed in the running
head of every page and in the citation block of every document; it is defined once,
in `scripts/standard-docs.ts`.

## Licence

[CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/). Share it with
attribution; do not publish a modified version. Translating it needs permission.
