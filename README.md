# Tare Standard

The published standards: the Tare Agent Standard and the Tare Shopfront Standard,
and the site that publishes them at [tarestandard.org](https://tarestandard.org).

This repository is the source of the published document. The text, the renderer,
the stylesheet, the build gates, the frozen editions and the machine-readable
release all live here, and tarestandard.org deploys from this repository. Its
history begins with v1.0, published 2026-11-14, the first public edition of both
standards.

A clone of it can produce the pages the site serves:

```bash
npm ci
npm run build      # writes standard-site/dist
npm test           # the gates and the page tests
npm run typecheck
```

## What is in here

| Path | What it is |
|---|---|
| `docs/standard/agent/` | The seven documents of the Tare Agent Standard |
| `docs/standard/shopfront/` | The seven documents of the Tare Shopfront Standard |
| `scripts/build-standard.ts` | Markdown → the published pages, and the build gates |
| `scripts/standard-docs.ts` | The two standards, their documents, versions and dates, in one place |
| `scripts/standard-scope.ts` | The scope numerals, derived from the mapping table |
| `scripts/standard-numbers.ts` | The counts the standard prints about its own instrument |
| `scripts/standard-instrument.ts` | The published instrument: pass thresholds, caps, deductions |
| `scripts/editions-apparatus.ts` | Corrects the frozen editions' apparatus, never their content |
| `standard-site/site.css` | The one stylesheet |
| `standard-site/editions/` | The dated editions, served at `/editions/<date>/` |
| `standard.json` | The release a consumer pins against: version, date, both standards, counts, thresholds, levels and grades. Served at `/standard.json` |
| `tests/` | The gates, the page tests and the heading-id fixture |

## The rules this repository enforces

The build fails, rather than publishing, when:

- a **claim** word appears unquoted — the standard never says certified, compliant
  or guaranteed about anything;
- an **internal link** does not resolve to a page that exists;
- a **register id** and the mapping table disagree about which job is which;
- a **dated line** is stale or fuses the standard's date with another edition's;
- an **emitted URL** does not resolve to a file the build wrote.

These are not conventions in a document; they are assertions in the build.

## The record

Every published edition is frozen under `standard-site/editions/<date>/` and served
at `/editions/<date>/` so a citation keeps working after the live pages move on.
Its content is never rebuilt; its apparatus may be corrected, and when it is, the
correction is dated in the archive banner and recorded here.

The first edition in this repository is `2026-11-14`, the first publication of
both standards.

Errata and change proposals go to the [issue tracker](https://github.com/tarestandard/standard/issues).

## Version

The standard is versioned and dated. The current version is printed in the running
head of every page and in the citation block of every document; it is defined once,
in `scripts/standard-docs.ts`. The same release is written to `standard.json` so a
consumer can pin one file instead of parsing the pages, and the site serves that
file at [tarestandard.org/standard.json](https://tarestandard.org/standard.json).

## Release

A release is a commit, a tag and a deploy of that tree. [`docs/releasing.md`](docs/releasing.md)
describes the gate, the smoke test and the rollback. `npm run deploy` builds
`standard-site/dist` and deploys it by hand; the site deploys from this
repository, and there is no second build.

## Licence

[CC BY 4.0](LICENSE). Share it, quote it and adapt it with attribution. The name
and the marks are reserved — see [TRADEMARKS.md](TRADEMARKS.md).
