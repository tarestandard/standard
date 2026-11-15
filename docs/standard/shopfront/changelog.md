# Changelog

The dated record of what this standard has published. Every page prints the standard's version and the day it was published. There is no earlier public edition: **v1.0, published 2026-11-14**, is the first.

## 2026-11-14 — Tare Shopfront Standard v1.0

The first public edition. It publishes, as one document set:

- **The 22 hotel shopfront jobs** across four families — 7 find, 5 act, 5 confirm, 5 recover — each with what the surface must expose, the evidence class that settles it, and the anchor it borrows its shape from.
- **The ladder** — Level 1 findable through Level 5 delegable — with the rule that the level is the last link that works end to end, and the grade A–F printed beside it and never alone.
- **The four capabilities** — find, act, confirm, recover — with the tests that decide each one, and the two cross-cutting checks: **admit** (is an agent let in, layer by layer) and **disclose** (what the surface says to one).
- **The evidence classes** — observable, inferred and not captured — with the visitor layer, the consent boundary and the private-receipt rule.
- **The scope and its anchors** — what the standard covers, what it refuses, and the dated state of the drafts it borrows from.

Three rules are published here as the current text rather than as amendments:

- **Level 5 is defined and not awarded in this edition.** The only protocol that could evidence it — the UCP lodging booking draft with the AP2 mandates extension — is draft, and UCP's own rule forbids exposing a pre-release implementation through public discovery. A reading may print Levels 1 to 4; a surface claiming Level 5 is citing a draft.
- **Admission is recorded per agent type.** The same surface can admit a browser-driving agent and refuse a scripted client: in the November 2026 survey four of ten New York surfaces refused a scripted request at the edge, and three of those four let a browser through. A reading therefore names the agent that asked, and a scripted block is never printed as a business refusing agents.
- **Recovery's default surface is the confirmation email, and the step after the link decides it.** A manage link that opens the booking directly is agent-friendly and a bearer credential; one that lands on a sign-in may still be agent-completable when the step is an emailed code or a signed-in social login, and is not completable when it is an SMS. The reading records the step, the credential it wants, and whether that credential is inside the agent's authority envelope.
- **A private receipt is a finding, not a capture failure.** A confirmation that exists but cannot be read by a program is recorded as `missing` in confirm and caps the reading at Level 2. It is never recorded as `not captured`, because `not captured` means the scan could not look.

The first edition also records what the November 2026 research found and what it changes: no hotel booking engine publishes an anonymous rate and availability feed, so the level a scan can award on its own is built on the visitor layer, and the levels above it require the property's test account or a partner credential.

## 2026-11-15 — clarification, no version change

The capability count is stated the same way on every page: **four capabilities** — find, act, confirm, recover — and **two cross-cutting checks**, admit and disclose. This edition already published both checks as cross-cutting; three pages counted them inconsistently. The front page listed admit as a fifth row in the capability table, the capabilities page named only disclose in its introduction, and the scope page said "one cross-cutting check". No job, level or grade changes.

## How a release happens

- **A release is dated and immutable.** v1.0 is this text. A later release is a new version with its own entry and its own date; an old version is never edited in place.
- **Two decision windows a year**, in March and September. Proposals are reviewed in the window; a release ships only when a decision changes what a job tests. There is no release for its own sake.
- **A clarification is not a release.** A correction that leaves what a job tests unchanged is dated here without moving the version.

## The standard version and an implementation's version

- **The standard's version** (`v1.0`) covers the whole published rulebook: the jobs, the levels, the grades, the evidence and the scope.
- **A scanner's own version** belongs to whoever implements this standard. It names the revision of the job set a given scan ran, and a scan prints the one it ran against. Two scans of different implementations are never compared.

A scanner's version is not this standard's edition, and this site does not print it: the standard has one version and one date.
