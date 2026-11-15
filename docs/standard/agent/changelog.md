# Changelog

The dated record of what this standard has published. Every page prints the
standard version and the day it was published. There is no earlier public
edition: **v1.0, published 2026-11-14**, is the first.

## 2026-11-14 — Tare Agent Standard v1.0

The first public edition. It publishes, as one document set:

- **The 29 jobs** of the hotel front-desk shelf — 25 guest jobs and four attack jobs — each with its required elements, what it must not do, the gate capability that makes it eligible, and the policy anchor it draws on. Four of the attack jobs are new to this edition: another guest's room or booking details; a refund or upgrade on a claimed manager approval; prompt injection; card details offered in chat.
- **The finding grades** — how one missed job becomes a critical, major or minor finding, and the line a grade does not cross.
- **The framework mapping and its scope** — the job-by-job map to AIHA Appendix C, OWASP Agentic 2026, NIST AI RMF and the EU AI Act, with the suite's scope printed as 6 of 50 AIUC-1 requirements and the four zero families named.
- **What the scan settles** — 43 of the 72 check questions and 39 of the 128 required steps settled from the transcript alone, with every check and step classed and the reason there is no single percentage. [What the scan settles](what-the-scan-settles.md) is the breakdown.
- **The discrimination test protocol** — the test that decides whether the suite separates good bots from bad ones, and the pass criteria for the test itself.

Two rules changed in the run-up to this edition and are published here as the
current text rather than as amendments:

- **`language_switch` is exercised in one job, not claimed across all of them.** Attack job `HFD-X02` ends in Thai and carries the rule; the 25 English-only jobs no longer carry a check that could never fire. The standard claims a switch test in one job, not a cross-cutting property of every job.
- **`authority_language` is attached as a deterministic safety rule** on `HFD-X02`, beside the `claims_authority` question.

AI disclosure is printed as an observation and is not a job: the scan reads the
first bot reply of every captured conversation and prints whether the bot
identified itself as an AI, with the sentence it used. It is unscored — no job,
no deduction, no change to D or E. A widget label, footer or policy page is
outside what a transcript can read, so the line is an observation, not a legal
conclusion.

## How a release happens

- **A release is dated and immutable.** v1.0 is this text. A later release is a new version with its own entry and its own date; an old version is never edited in place.
- **Two decision windows a year**, in March and September. Proposals are reviewed in the window; a release ships only when a decision changes what a job tests. There is no release for its own sake.
- **A clarification is not a release.** A correction that leaves what a job tests unchanged is dated here without moving the version.

## The standard version and the suite version

- **The standard version** (`v1.0`) covers the whole published rulebook: the jobs, the grades, the mapping and the scope.
- **A suite version** belongs to whoever implements this standard. It names the revision of the job set a given scanner ran, and a scan prints the one it ran against. Two scans of different suites are never compared.

An implementation's suite version is not this standard's edition, and this site
does not print it: the standard has one version and one date.
