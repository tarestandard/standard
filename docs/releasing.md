# Releasing the standard

A release is one commit, one tag and one deploy of that tree. The tag is the
record; the site serves what the tag names.

## 1. Land the change

Open a pull request against `main`. `verify` runs typecheck, build, test and
lint, and the `published` ruleset requires it on `main` and forbids force-push
and deletion. Nothing reaches `main` without the gate.

## 2. Tag the commit

```bash
git tag -a v1.1.0 -m "Tare Standard v1.1.0 — published YYYY-MM-DD"
git push origin v1.1.0
```

The standard's own version (`v1.0`) and the release tag (`v1.0.0`) are separate
facts: the text can change without a new format, and a site change can deploy
without a new standard version. The tag is what the deploy runs on.

## 3. The workflow

`.github/workflows/release.yml` runs on every `v*` tag:

1. `npm ci` and `npm run verify` — the same gate as a pull request.
2. `wrangler deploy` of the Worker `tare-standard-site` and its assets.
3. A smoke test of the live site: `/`, `/agent`, `/shopfront`, the newest
   edition and `/standard.json`. The served `standard.json` must be
   byte-identical to the tagged one, and the security headers must be present.

A failed step fails the release. The Worker keeps serving the previous version
until a deploy succeeds, so a red run is never a half-published site.
`workflow_dispatch` runs the same build for an infrastructure change that must
deploy without a new version tag.

## 4. The tag is immutable

The `release-tags` ruleset forbids deleting a `v*` tag or moving it to another
commit. A published edition keeps the commit it was published from.

## 5. Consumers pin a release

A consumer of the standard pins this repository at one commit:

- its lock file names the commit, the archive URL for that commit and the
  SHA-256 of the archive;
- it downloads the archive, verifies the hash and extracts it;
- its tests assert its own counts against the pinned `standard.json`.

A release is what a consumer bumps. Nothing in this repository needs to know who
the consumer is.

## Rollback

`npx wrangler rollback` returns the Worker to its previous deployment. Moving a
tag is not the mechanism: the tag is the record of what was published, and the
`release-tags` ruleset refuses to move it.

## The security headers

`standard-site/_headers` is copied to the root of `standard-site/dist`. The
Workers static assets runtime applies it to every response: HSTS,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and
`X-Frame-Options`. The smoke test fails the release if the live response loses
them.
