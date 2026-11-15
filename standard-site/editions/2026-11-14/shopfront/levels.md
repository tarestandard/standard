# Levels and grades

A shopfront's reading is two facts printed together: a level and a grade. The level says how far an agent gets, the grade says how well the part that works behaves. Neither travels without the other and neither travels without a job family.

## The ladder

The level is the **last link in the chain that works end to end**. It is not an average of the four capabilities, and it is not the best one: a surface that finds everything and cannot act is Level 1, however good the finding is.

| Level | What an agent can complete | Headline | What a lower level means |
|---|---|---|---|
| **1 Findable** | finds the facts; starts no job | "Read-only brochure" | the facts are not machine-readable, or not there |
| **2 Actable** | starts the job; confirmation is human-readable only | "One-way door" | no action endpoint, or no stable flow to reach it |
| **3 Confirmable** | completes the job and returns a machine-readable receipt | "Bookable, not changeable" | the receipt is an email, a promise or nothing |
| **4 Recoverable** | changes, cancels or refunds the job end to end | "Full loop" | the job can only be changed by a person |
| **5 Delegable** | accepts an agent-originated job under a declared mandate, and recovers it | "Agent to agent" | the surface needs a human to agree to the mandate |

**A level is a floor, not a sum.** A property that finds everything, acts, and returns no receipt is Level 2. It does not become Level 3 because two of three links work.

**Level 1 is the visitor's view.** The facts a scan can read without the property's cooperation are the ones an ordinary visitor can read: public HTML, structured metadata, a booking widget's own answer. That is not the property's inventory truth — every hotel booking engine we examined gates live rates and availability behind a vendor credential or a signed partnership, and none publishes an anonymous feed. Find is therefore observable as *what a visitor sees*, and the page prints the level beside that qualification rather than behind it.

**Levels 2 to 4 need consent by construction.** Act, confirm and recover all touch the property's records. A reading reaches them only through a test account the property supplies, or a partner credential it authorizes — and hotel consent alone does not satisfy a vendor that also requires a partnership agreement. Without one, those capabilities are `not captured` and the level stops at 1.

**A surface that refuses an agent has no level.** If any Admit layer blocks the agent — a challenge at discovery, a wall on the site, a refusal from the engine — the reading prints the refusal and its mechanism instead of a number. A level for a door nobody opened is a false fact about the property, and Level 1 is not a fallback for "not admitted".

**The agent type and its authority envelope are part of the reading.** A recovery that needs the guest's mailbox, their SMS, or their signed-in browser is a different fact from one that needs nothing, and the level says which was required. A level earned with a browser-driving agent is not the same fact as one earned by a scripted client, and the page says which. Where a surface admits one and refuses the other, the reading prints both results rather than the friendlier one.

**The cost band is required.** Every reading prints what the job cost an agent to attempt: page loads, holds created, whether it completed inside a hold's lifetime, and any money gate before confirmation — a pre-authorization or deposit demanded before the booking is confirmed. In the November 2026 survey the same job cost 6, 7 and 10 page loads across three surfaces before any money moved, and one attempt spent three searches and never reached a property. Cost is printed beside the grade, never folded into it.

**Level 5 is defined and not awarded.** It needs a mandate the business can bound — limits, expiry, revocation — and a recovery path that respects the mandate. The only published protocol that could evidence it is the UCP lodging booking draft with the AP2 mandates extension: UCP is explicitly draft, and its own rule forbids exposing a pre-release implementation through public discovery. So **no reading may print Level 5 in this edition**, whatever a surface claims. A host who says it is Level 5 is citing a draft, not a measurement.

## The grade

The grade is **A–F**, measured within the level, over the links that do work.

| What it reads | What moves a grade down |
|---|---|
| fact accuracy — whether the facts match the property's own published terms | a price, policy or time that disagrees between two surfaces |
| provenance — whether the fact carries where it came from and when | a fact that cannot be traced to a source |
| consistency — whether the same question answers the same way twice | two answers to one question |
| refusal and handoff — what the surface does when it cannot help | a refusal with no route, or a route with no owner |

**Level 1 is not graded.** A brochure can be a perfect brochure, and grading it would compare it with a booking surface. A Level 1 reading prints a dash in place of the grade.

**Cost is a band beside the grade, never inside it.** A cheap action and an expensive one can carry the same grade; the band says what the job costs an agent to complete, and it is reported separately so a reader can weigh it.

## The pair

The rule is one line, always both, always with the job:

> **Level 2 · Grade B — takes bookings, cannot confirm or change them.**

A component of the reading is never printed alone: no "Grade A surface", no "Level 4 property", no grade across job families. A Level 2 A and a Level 4 A are two different A's and are never compared.

## The profile

The four capabilities are printed under the pair, each with one of four statuses:

| Status | Means |
|---|---|
| **strong** | observed, and it works for the job |
| **partial** | observed, and it works with a gap a reader must know |
| **missing** | observed, and it is not there |
| **not captured** | the scan could not see it; this is not a finding against the property |

> Level 2 · Grade B — takes bookings, cannot confirm or change them.
> Find: strong · Act: partial · Confirm: missing · Recover: not captured

The profile is the fix order. A `missing` link that caps the level is worth more than a `partial` one, and a `not captured` one is a question for the property, not a failure of it.

## The 2×2 is the cover, not the engine

|  | cannot recover | can recover |
|---|---|---|
| **can act** | **one-way door** | **full loop** |
| **cannot act** | **brochure** | **service desk** |

It is the executive summary and the sales conversation. It collapses find and confirm and it cannot grade, so it never scores. Where a page prints it, the level and grade are printed beside it.

## What a level is not

- **Not a risk assessment.** No likelihood, no exposure, no expected loss.
- **Not compliance.** A Level 4 for cancellations is not a consumer-law finding, and no reading here is a data-protection or AI-Act assessment.
- **Not a comparison across properties** unless both readings name the same edition, the same job family and the same evidence class.
- **Not permanent.** A surface changes when a booking engine changes; a reading is dated and a re-scan is a new reading, never an edit of the old one.
