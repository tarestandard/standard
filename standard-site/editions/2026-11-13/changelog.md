# Changelog

**Tare Standard v1.0 · suite v2.2 · first public edition, 2026-11-12 · suite v2.2 released 2026-11-13**

This is the dated record of what the standard published. Every page prints the standard version, the suite version and the day it was published; a scan prints the suite version it ran.

## 2026-11-13 — suite v2.2: the security jobs and the dead-rule fixes (release)

A **suite release**, not a clarification: four jobs were added and two deterministic rules changed what they can establish. Suite v2.1 is unchanged and stays loadable; a paid subject pinned to v2.1 keeps running it.

- **Four attack jobs** (V2-A01–V2-A04): another guest's room or booking details; a refund or upgrade on a claimed manager approval; prompt injection; card details offered in chat. Each has a guest script, required elements, the checks it exercises and a fix. They reuse the seven published questions; no judge question was added and no prompt changed, because the panel is keyed by its question set (ADR-0028/0029). A03's instruction leak is judged as a missed required element, not a safety deduction, because no published question asks it.
- **`language_switch` is exercised, not retired.** V2-A02 ends in Thai and carries the rule; the 25 English-only jobs no longer carry a check that could never fire. The standard now claims a switch test in one job, not a cross-cutting property of every job.
- **`authority_language` is attached, not retired.** It is a deterministic safety rule on V2-A02, beside the `claims_authority` question.
- **The counts moved** with the suite: **43 of the 72 check questions** and **39 of the 128 required steps** are settled from the transcript alone (82 of 200 assertions). [What the scan settles](what-the-scan-settles.md) is the current breakdown; this entry records the release's numbers.
- **The mapping** adds four rows: AIHA Q7/Q9/Q10, OWASP ASI01/ASI02/ASI03 and NIST AI RMF MEASURE 2.6/2.10. The EU AI Act column stays empty: no job tests a duty.
- Nothing about the claims changed: the standard still grants no status, no certification and no accreditation.

## 2026-11-13 — the scan states what it settles (clarification)

The standard now says how much of its own suite a machine settles from the transcript, on [What the scan settles](what-the-scan-settles.md): the counts for the check questions and the required steps, the three evidence classes, and why no single percentage is printed. The page is the single source for the numbers, so this dated entry does not repeat them and a later suite cannot leave a stale count in the record.

Nothing about a job, a check, a step or a score changed. Suite v2.1 and Standard v1.0 are unchanged; the counts are derived from the shipped suite and pinned to it, so a later suite moves the page with it.

## 2026-11-12 — v1.0 published

The first public edition:

- **25 hotel front-desk jobs** (suite v2.1), each with its gate, its required elements and its failure rules.
- **Finding grades**: a missed job is critical, major or minor, by the job's authored weight and the settled outcome.
- **Framework mapping**: every job against AIHA Appendix C, the OWASP Top 10 for Agentic Applications (2026) and NIST AI RMF MEASURE. The EU AI Act column is empty on purpose: the suite has no disclosure job.
- **Scope**: 6 of 50 live AIUC-1 requirements have a published job that can speak to them; four families are printed at zero.
- **Discrimination protocol**: the test that decides whether the suite discriminates.

Nothing about the claims changed, because there is nothing to change: the standard grants no status, no certification and no accreditation.

## 2026-11-12 — the panel is composed per axis (panel version 2026-12)

An **instrument change**, dated, not a new standard version: nothing about what
a job tests changed.

- The judge panel is now **composed**: the **task** axis is decided by one
  vendor and the **safety** axis by another, and the evidence (probabilities,
  deductions, checklist) follows each axis to its judge. The two general judges
  of the 2026-11 panel are retired from the running panel. Which models sit
  behind the panel stays with the service, as it always has; a result prints the
  panel version, never the instrument.
- Every result prints its **panel version** as before. A scan recorded under
  2026-12 prints `2026-12`; a stored 2026-11 scan keeps printing `2026-11.x`.
  Because the instrument moved, an old and a new observation differ unless both
  sides record the same panel version.
- Cutover evidence: on 43 hand-labelled turns the composed panel printed
  40/43 both axes and 43/43 safety, against 19/36 both axes for the 2026-11
  panel as recorded. The comparison is not like-for-like on the rubric; the
  study records both arms and its caveats.

## 2026-11-13 — AI disclosure is printed as an observation, not a job

A clarification, not a release: no job changed. The scan now reads the first bot
reply of every captured conversation and prints whether the bot identified itself
as an AI, with the sentence it used. It is unscored: no job, no deduction, no
change to D or E. A widget label, footer or policy page is outside what a
transcript can read, so the line is an observation, not a legal conclusion. The
EU AI Act column stays empty: the suite still has no disclosure job.

## How the two versions differ

- **The standard version** (v1.0) covers the whole published rulebook: the jobs, the grades, the mapping and the scope.
- **The suite version** (v2.2) covers the 29 jobs and their scoring; v2.1 is the frozen 25-job edition a paid subject can still be pinned to. A suite change is a new suite version; a scan prints the version it ran, and two scans of different suites are never compared.

A correction that does not change what a job tests is dated here. A change that does is a new version, with its own entry and its own date.

## How a release happens

- **A release is dated and immutable.** v1.0 is this text; a later release is a new version with its own entry. An old version is never edited in place.
- **Two decision windows a year**, in March and September. Proposals are reviewed in the window; a release ships only when a decision changes what a job tests. There is no release for its own sake, and no promised quarter with nothing in it.
- **A clarification is not a release.** A correction that leaves what a job tests unchanged is dated here without moving the version.
- **A paid subject is pinned to the suite it bought.** Its re-scans run that suite, so its series stays comparable. A superseded suite stays runnable for at least twelve months, and a suite upgrade is a dated event on the record — "suite changed" — never a silent drift.
- **The instrument is part of the measurement.** Every result prints its **panel version**; the models behind the panel are Tare's instrument and stay with the service. A panel change is recorded as a dated measurement change on the record, because a new judge can move a score without the bot changing.

## Where it lives, and how to propose a change

The standard is also published as a public repository, [tarestandard/standard](https://github.com/tarestandard/standard), where every release is a tag and the record is kept. A correction can be a pull request; a scenario change is a [proposal](https://github.com/tarestandard/standard/issues/new/choose), because the engine that plays the jobs is private and the two have to move together. Every proposal gets a dated decision with a reason.
