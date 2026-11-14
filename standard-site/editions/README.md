# Published editions

Frozen copies of the standard as it shipped, served at `/editions/<date>/` and
linked from every live page as "This edition". They are not rebuilt: each
directory is the output of the build at its release commit, with internal links
rewritten to stay inside the edition and an archive banner added.

**Their apparatus is corrected, never their content.** On 2026-11-14 both
editions took the current dated line in their running head and a note in their
banner, via `tsx scripts/editions-apparatus.ts` (idempotent; it touches two
strings per page and nothing else). Before that, the 2026-11-13 edition printed
`Tare Standard v1.0 · suite v2.2 · 2026-11-12` — the fused pair the live build
now refuses — while every live page cited it as the URL to cite. The content,
the markup and the page set are unchanged.

| Edition | Suite | Source commit | Built with |
|---|---|---|---|
| 2026-11-12 | v2.1 | 1a91b4b — "Publish the Code of Points on tarestandard.org (#130)" | `tsx scripts/build-standard.ts` at that commit |
| 2026-11-13 | v2.2 | 32b66d7 — "Release suite v2.2 with the security scenarios and the dead-rule fixes" | `tsx scripts/build-standard.ts` at that commit |

Run `tsx scripts/editions-apparatus.ts` after adding an edition, so the dated
line and the banner note match the rest of the archive.

To add an edition: check out the release commit in a worktree, run
`tsx scripts/build-standard.ts`, copy `standard-site/dist` to
`standard-site/editions/<date>/`, rewrite root-absolute `href`/`src` to
`/editions/<date>/…`, and add the archive banner. The live build copies this
directory into the Worker's assets unchanged.
