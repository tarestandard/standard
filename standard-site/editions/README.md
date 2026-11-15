# Published editions

Frozen copies of the standards as they shipped, served at `/editions/<date>/`.
They are not rebuilt: each directory is the output of the build at its release
commit, with root-absolute links rewritten to stay inside the edition and an
archive banner added.

| Edition | Standards | Source | Built with |
|---|---|---|---|
| 2026-11-14 | Tare Agent Standard v1.0, Tare Shopfront Standard v1.0 | the first commit, "Publish Tare Standard v1.0" | `npm run build` |

To add an edition: build the release commit, copy `standard-site/dist` to
`standard-site/editions/<date>/`, rewrite root-absolute `href`/`src` to
`/editions/<date>/...`, add the archive banner, and commit the directory. The
live build copies this directory into the Worker's assets unchanged.
