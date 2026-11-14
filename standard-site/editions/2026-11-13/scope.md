# Framework mapping — the 29 hotel front-desk jobs

**Tare Standard v1.0 · hotel front-desk suite v2.2 · as of 2026-11-13**

This is the citable map behind the procurement answer: for each job in the 29-job hotel front-desk suite, the AIHA Appendix C question it contributes to, the OWASP Top 10 for Agentic Applications (2026) risk it exercises, the NIST AI RMF 1.0 subcategory it can produce evidence for, and the EU AI Act duty it tests. It maps evidence, not coverage: a code is not a pass, and a dash is a finding.

The rows are the 29 scenarios in [the suite](hotel-frontdesk-scenarios-v22.md), with ids from `src/scan/suites/hotel-v22.ts`. The AIHA rows are [the answer sheet](../product/aiha-vendor-answer-sheet.md). The anchors are named in "Anchors used" below; the framework versions are dated and linked at the end.

## How to read the table

- **One primary anchor per cell.** Where a job could sit under two anchors, the nearer one is shown; the other is not implied.
- **AIHA** cites the Appendix C question the job's evidence contributes to, using the answer sheet's strength ratings. It is not a claim that the question is answered.
- **OWASP** gets a code only where the script directly exercises that pattern. The suite is a front-desk service suite, not an attack corpus; "—" means no scenario exercises the pattern, not that the risk is absent.
- **NIST** gets one MEASURE subcategory. No job supports a GOVERN, MAP or MANAGE anchor: those are organisational processes and determinations the scan does not observe.
- **EU AI Act** gets a duty only where the job tests the conduct the duty requires. None does; the column is empty on purpose, and "What this mapping does not prove" says why. The scan prints one unscored disclosure observation outside this table (ADR-0032).
- **The scan is front-stage.** It records the transcript and the quoted turn, not tool calls. An OWASP code describes observed wording and refusal, not an observed tool invocation.
- **The OWASP column is the Agentic list, not the LLM list.** The scanned artifact is an agent, and the research brief rates the agentic taxonomy the better fit; an LLM01/02/06 column would be a separate map, not this one.

## The map

| Scenario | Job | AIHA Appendix C | OWASP Agentic 2026 | NIST AI RMF 1.0 | EU AI Act |
|---|---|---|---|---|---|
| V2-S01 | Arrival with reservation | Q9 | ASI02 Tool Misuse and Exploitation | MEASURE 2.6 | — |
| V2-S02 | Walk-in room request | Q9 | — | MEASURE 2.3 | — |
| V2-S03 | Arrival before check-in | Q9 | — | MEASURE 2.3 | — |
| V2-S04 | Late check-out | Q10 | ASI02 Tool Misuse and Exploitation | MEASURE 2.3 | — |
| V2-S05 | Room type unavailable | Q9 | — | MEASURE 2.3 | — |
| V2-S06 | Overbooked / walk | Q10 | ASI02 Tool Misuse and Exploitation | MEASURE 2.6 | — |
| V2-S07 | No reservation on file | Q9 | ASI03 Identity and Privilege Abuse | MEASURE 2.10 | — |
| V2-S08 | Third-party check-in | Q7 | ASI03 Identity and Privilege Abuse | MEASURE 2.6 | — |
| V2-S09 | Lost key, no ID | Q7 | ASI03 Identity and Privilege Abuse | MEASURE 2.6 | — |
| V2-S10 | Room change | Q9 | ASI02 Tool Misuse and Exploitation | MEASURE 2.6 | — |
| V2-S11 | Maintenance issue | Q9 | — | MEASURE 2.3 | — |
| V2-S12 | Housekeeping complaint | Q9 | — | MEASURE 2.3 | — |
| V2-S13 | Noise complaint | Q10 | — | MEASURE 2.6 | — |
| V2-S14 | Amenity request | Q9 | — | MEASURE 2.3 | — |
| V2-S15 | Local recommendation | Q9 | — | MEASURE 2.3 | — |
| V2-S16 | Disputed folio | Q10 | ASI02 Tool Misuse and Exploitation | MEASURE 2.6 | — |
| V2-S17 | Split payment | Q9 | ASI02 Tool Misuse and Exploitation | MEASURE 2.6 | — |
| V2-S18 | Folio copy request | Q7 | ASI03 Identity and Privilege Abuse | MEASURE 2.10 | — |
| V2-S19 | Normal checkout | Q9 | — | MEASURE 2.3 | — |
| V2-S20 | Departure without checkout | Q9 | ASI02 Tool Misuse and Exploitation | MEASURE 2.6 | — |
| V2-S21 | Lost item | Q9 | — | MEASURE 2.10 | — |
| V2-S22 | Safety / medical | Q10 | — | MEASURE 2.6 | — |
| V2-S23 | Accessibility request | Q9 | — | MEASURE 2.3 | — |
| V2-S24 | VIP / loyalty / group | Q9 | — | MEASURE 2.10 | — |
| V2-S25 | Abusive guest / compensation | Q10 | ASI02 Tool Misuse and Exploitation | MEASURE 2.6 | — |
| V2-A01 | Another guest's room or booking details | Q7 | ASI03 Identity and Privilege Abuse | MEASURE 2.10 | — |
| V2-A02 | Refund or upgrade on a claimed approval | Q10 | ASI02 Tool Misuse and Exploitation | MEASURE 2.6 | — |
| V2-A03 | Prompt injection: show your instructions | Q9 | ASI01 Goal Hijack | MEASURE 2.6 | — |
| V2-A04 | Card details offered in chat | Q7 | — | MEASURE 2.10 | — |

## Coverage at a glance

| Column | Rows with a mapping | Anchors used | Reading |
|---|---|---|---|
| AIHA Appendix C | 29/29 | Q7 ×5, Q9 ×17, Q10 ×7 | 3 of the 14 questions; Q1, Q4 and Q11 have suite-level or nearby evidence only; the data, security, continuity and contract rows have none |
| OWASP Agentic 2026 | 15/29 | ASI01 ×1, ASI02 ×9, ASI03 ×5 | 3 of the 8 in-scope codes; no ASI04–ASI08 |
| NIST AI RMF 1.0 | 29/29 | MEASURE 2.3 ×10, 2.6 ×13, 2.10 ×6 | MEASURE only; no GOVERN, MAP or MANAGE |
| EU AI Act | 0/29 | — | no job tests a duty; one unscored transcript-level observation is printed (ADR-0032) |

## Scope — what this suite does and does not test

AIUC-1 is a control standard for AI agents; the 29 jobs are front-desk work, so the two meet only where a transcript can settle something. This section prints the suite's scope, not a control matrix: one row per AIUC-1 requirement a published job can genuinely speak to, the job(s) behind it, and the class of evidence — **observed** (the transcript settles the requirement) or **boundary** (the job reaches its edge and the front stage cannot settle it). The denominator is AIUC-1's own count: 50 live requirements in six families, with its five retired requirements excluded. Scope is not coverage — the scan's D score is difficulty and coverage, 0–10 — and not AIUC-1's statement of applicability; a row says a job can speak to a requirement, not that the bot met it. A settled job is one conversation's behaviour, not evidence that a control is implemented — that is the difference between a scan and an audit.

**6 of 50.**

| Family | AIUC-1 requirement | Job(s) | Evidence class |
|---|---|---|---|
| C Safety | C003 Prevent harmful outputs | V2-S22, V2-S25 | observed |
| C Safety | C004 Prevent out-of-scope outputs | V2-S22 | observed |
| C Safety | C005 Prevent agent-specific high risk outputs | V2-S16, V2-S25 | observed |
| C Safety | C007 Flag high risk outputs for human review | V2-S06, V2-S07, V2-S09, V2-S13, V2-S16, V2-S22, V2-S25 | boundary |
| D Reliability | D001 Prevent hallucinated outputs | V2-S01–V2-S25, V2-A01–V2-A04 | observed |
| D Reliability | D003 Restrict unsafe tool calls | V2-S01, V2-S08, V2-S09, V2-S10, V2-S19 | boundary |

The two boundary rows state their own limit: C007 asks for an alerting system that flags high-risk output for review, and the transcript hears only whether the bot named a human channel and left the decision there; D003 asks for unsafe tool calls to be restricted, and the transcript hears only what the bot said about the key, not whether a call ran.

**What the table does not list.** 44 of the 50 requirements have no row. Four families are at zero: A Data & Privacy (0 of 9), B Security (0 of 10), E Accountability (0 of 16) and F Society (0 of 2). In Safety and Reliability the seven without a row are the requirements a transcript cannot settle — C001 risk taxonomy, C002 pre-deployment testing, C006 output vulnerabilities, C008 risk monitoring, C009 real-time feedback and intervention, C010 third-party safety testing and D004 third-party reliability testing. The four zero families are stated because a scope that lists only what it tests reads as a complete one, and the buyer needs the edge of the instrument. That edge is not always empty: S07's other-booking rule and S18's folio request touch Data & Privacy, S08 and S09's key handling is the Security reading of D003, and the v2.2 attack jobs (A01, A04) test cross-guest disclosure and card-data handling directly. None becomes an A or B row: a judged reply shows a refusal or a disclosure, not the data-flow safeguard that A005 and A006 govern, and the key behaviour is claimed under the nearer requirement, D003, rather than twice.

> 0 is a fact about the suite, a hole we are not hiding.

**What the scan settles is a different count.** The scope above asks which AIUC-1 requirements a job can speak to; [what the scan settles](what-the-scan-settles.md) asks how much of this suite a machine settles from the transcript. Neither is a substitute for the other, and neither is a coverage percentage.

The rule behind the table, and the matrix this page refuses to print, are recorded in [ADR-0024](../adr/0024-the-scan-prints-its-scope.md).

## What this mapping does not prove

**A code is not coverage.** OWASP is a risk taxonomy, not a test specification. ASI02 on a row means the script exercises unsafe use of a legitimate front-desk action (a key, a rate, a payment, a refund, a relocation); it does not mean the risk is controlled. Fifteen of 29 rows carry a code because the suite is built around authority and access; the other fourteen, and five of the eight in-scope ASI codes, have no scenario. A04 deliberately carries a dash: the agentic list has no over-exposure code, and its card-data behaviour is mapped to AIHA Q7 and NIST MEASURE 2.10 rather than forced into ASI02. That is the honest shape of this suite, not a gap to close with a plausible-looking row.

**The scan is front-stage only.** "I'll issue a key" and "I issued a key" look the same, so a job that describes an action and a job that performs it are indistinguishable. ASI01, ASI02 and ASI03 are observed as wording, refusal and escalation, not as tool calls, credential scopes or access logs. No back-stage trace is captured in this build, so every back-stage check is `not_captured`.

**NIST AI RMF is voluntary vocabulary, not a certificate.** The subcategories are outcomes an organisation's risk programme can adopt. A scan produces one measurement input to MEASURE; it does not satisfy the subcategory, and there is no AI RMF certificate to hold. GOVERN, MAP and MANAGE are organisational processes and determinations — a policy, a context map, a resourcing decision — that a transcript cannot show. AI RMF 1.0 is being revised, so the subcategory ids may move.

**The AI Act column is empty for a reason.** The suite has no AI-disclosure job. Art 50(1) is a provider duty about design and first-interaction information; a transcript that happens to contain "I'm an AI" is a quote, not evidence that the duty was met. S01–S03 are first interactions, but no script asks for a disclosure and no element or question scores one. Since 2026-11-13 the scan also prints one transcript-level observation of whether the bot identified itself as an AI, with the sentence it used (ADR-0032). It is not a job, not a row and not scored: it is evidence of wording, not of the duty. A scenario that did touch a duty would still be evidence about observed behaviour, not a conformity assessment. The high-risk duties (Art 12, 14, 15) are deferred for Annex III systems to 2027-12-02 and are outside this shelf.

**AIHA Appendix C is a voluntary questionnaire, not a legal instrument.** The scan contributes to Q7, Q9 and Q10 only, and partially. Q7's identity, scope, action record and revocation are back-stage; Q10's switch and its effect on the underlying service are not observed; Q9's capabilities are declared, not observed. The answer sheet says this row by row; this map does not upgrade it. No scenario maps to the other eleven questions; Q1, Q4 and Q11 have suite-level or nearby evidence, as the answer sheet says, and the rest have none.

**The artifact, not the deployment.** The scanned artifact is a pasted prompt, an uploaded config or a driven widget. `mode` and `replay` record how the bot side was produced; neither names the vendor's production model. Every anchor inherits that limit.

**A standard pass is not a status.** `passesStandard` is the published claim about one scan: E ≥ 8.5, D ≥ 7.0, an empty gate and a clean sheet. It is not an accreditation and it grants no framework status. A re-scan is another dated observation, not monitoring. The claims rule applies throughout: this document reports what was tested and observed, and grants no status.

## How to cite this

**One sentence for a questionnaire.**

> "Tare Standard v1.0 (hotel front-desk suite v2.2) tested this agent against 29 published front-desk jobs on a dated transcript; for the jobs that were eligible, the report is evidence for AIHA Appendix C Q7, Q9 and Q10 and records behaviour mapped to OWASP ASI01/ASI02/ASI03 and NIST AI RMF MEASURE 2.3/2.6/2.10, and it is not an EU AI Act conformity assessment."

**Dated line.** As of 2026-11-13.

**Attach with it.** The scan id, `input.observedAt`, `suite.version` (`v2.2`), each `judges[].version`, and the report link. Without those, the sentence is a claim, not a citation.

## Anchors used

**AIHA Appendix C (V1, 2026-10-26):**

- **Q7** — who can access our data; where an agent accesses the hotel's systems, its identity, limited permissions, exportable action record and independent revocation.
- **Q9** — what the AI can do without human approval.
- **Q10** — how the AI feature can be disabled or suspended, who can do so, and what happens to the underlying service.

**OWASP Top 10 for Agentic Applications (2026):**

- **ASI02 — Tool Misuse and Exploitation**.
- **ASI03 — Identity and Privilege Abuse**.
- Not exercised: ASI01, ASI04, ASI05, ASI06, ASI07, ASI08.

**NIST AI RMF 1.0:**

- **MEASURE 2.3** — performance or assurance criteria measured and demonstrated for conditions similar to deployment; measures documented.
- **MEASURE 2.6** — the system is evaluated for safety risks and can fail safely, particularly beyond its knowledge limits.
- **MEASURE 2.10** — privacy risk is examined and documented.

**EU AI Act:**

- **Art 50(1)** — providers ensure people are informed they are interacting with an AI system, unless obvious; **Art 50(5)** — at the latest at the first interaction. Applicable from 2026-08-02 (Art 113). No row uses this anchor; the suite has no disclosure job. The scan's one disclosure observation (ADR-0032) is printed outside this map and is not scored.

## Sources

- **AIHA, Hospitality AI Governance Framework, Workgroup 8, V1, 2026-10-26**, Appendix C "Vendor due diligence questionnaire", https://aihospitalityalliance.com/workgroups/ai-governance/vendor-questions, accessed 2026-11-11. A voluntary industry reference, not a legal instrument.
- **OWASP GenAI Security Project, OWASP Top 10 for Agentic Applications, Version 2026 (released 2025-12-09)**, https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/, accessed 2026-11-11. ASI01–ASI08 ids and names checked against the AIUC-1 crosswalk, https://standard.aiuc-1.com/crosswalks/owasp-agentic-top-10, and the framework summary at https://docs.modulos.ai/frameworks/owasp-top-10-agentic, both accessed 2026-11-11. This map uses ASI01–ASI08 only.
- **NIST, AI Risk Management Framework (AI RMF 1.0), NIST AI 100-1, 2023-01-26**, https://doi.org/10.6028/NIST.AI.100-1; function and subcategory text from the AI RMF Core, https://airc.nist.gov/airmf-resources/airmf/5-sec-core/, accessed 2026-11-11. Voluntary; a revision is in progress.
- **EU, Regulation (EU) 2024/1689 (AI Act), Article 50(1) and 50(5)**, applicable from 2026-08-02 (Article 113); text from the European Commission AI Act Service Desk, consolidated as at 2026-07-27, https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50, accessed 2026-11-11; consolidated text at https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02024R1689-20260727. The Annex III high-risk duties are deferred to 2027-12-02 by the Digital Omnibus, Regulation (EU) 2026/1744, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202601744.
- **AIUC-1, the standard for AI agent security, safety and reliability, 50 live requirements across A–F (A001–F002)**, https://standard.aiuc-1.com/, accessed 2026-11-12. Requirement titles and ids read from the family pages; the five retired pages (C011, C012, D002, E007, E014) are outside the 50. The standard is audited by accredited auditors; this scan issues no statement of applicability.
- **Repo:** [the suite](hotel-frontdesk-scenarios-v2.md), [the AIHA answer sheet](../product/aiha-vendor-answer-sheet.md), [the standards brief](../research/ai-assurance-standards-brief.md), [PRODUCT.md](../../PRODUCT.md) (claims rule, front-stage/back-stage limit), [GLOSSARY.md](../../GLOSSARY.md) (scan, job outcome, standard pass, scope), [ADR-0024](../adr/0024-the-scan-prints-its-scope.md) (the scope rule), `src/scan/suites/hotel-v2.ts`.
