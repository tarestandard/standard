# 0001 — The standard is served from this repository

- **Status:** Accepted
- **Date:** 2026-11-15
- **Related:** `.github/workflows/release.yml`, `wrangler.standard.jsonc`, tag `v1.0.0`, [`docs/releasing.md`](../releasing.md)

## Context

The standard is published at [tarestandard.org](https://tarestandard.org): two
document sets, each versioned and dated, and a machine-readable release at
`/standard.json`.

The text, the build, the stylesheet, the tests and the frozen editions are one
artefact. When a standard is read at one address but built and served somewhere
else, there are two copies of the text and two chances to drift.

## Decision

- **This repository is the source of truth** for the published text, the build
  and the deploy. There is no second build.
- **A tag is a release.** Pushing a `v*` tag runs
  `.github/workflows/release.yml`: `npm ci`, `npm run verify`, then
  `wrangler deploy --config wrangler.standard.jsonc`, then a smoke test of the
  live site against the tagged `standard.json`.
- **The Worker and the domain are owned here.** The release workflow deploys
  the `tare-standard-site` Worker and its `tarestandard.org` custom domain,
  using the repository secrets `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`.
- **`verify.yml` is the gate.** Pull requests and pushes to `main` run
  typecheck, build, test and lint; the `published` ruleset requires it and
  forbids force-push and deletion.
- **A published tag is immutable.** The `release-tags` ruleset forbids deleting
  a `v*` tag or moving it to another commit.

## Consequences

- One copy of the text. A correction is a pull request here, reviewed and
  merged here.
- The tag list is the release record, and the commit a tag names is the text
  the site serves. A rollback deploys an earlier tag or runs `wrangler
  rollback`.
- The deploy needs a Cloudflare API token scoped to this account and the
  `tarestandard.org` zone, plus the account id. Rotating the token is an
  operational task, not a code change.
- The security headers are files in this repository (`standard-site/_headers`),
  so a header change is reviewed like any other change.
- [`docs/releasing.md`](../releasing.md) is the process: land, tag, verify,
  deploy, smoke, roll back.
