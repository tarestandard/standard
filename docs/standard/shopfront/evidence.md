# What a scan can capture

A reading is only as strong as the evidence under it. Every finding and every capability status carries one of three classes, and the class decides what the finding may be used for.

## The three classes

| Class | Definition | What it can support |
|---|---|---|
| **observable** | an unauthenticated request a second party can repeat and get the same answer | a finding, a capability status, a level |
| **inferred** | a published rule applied to observable evidence | a graded reading and a fix, never a level on its own |
| **not captured** | needs credentials, the buyer's inbox, a transaction or a consent the scan does not have | a question for the property; never a pass, never a failure |

**No finding without provenance.** A finding prints what was requested, when, and its class. A claim with no request behind it is a description of the property, not a reading of it.

**No inference printed as observation.** Where a rule settles a fact — a published cancellation window, a stated policy — the page says so and carries the class `inferred`. It never appears in the same table, and the same typeface, as something the scan watched happen.

## The visitor layer

Without the property's cooperation, a scan reads what an ordinary visitor can: the public page, its structured metadata, and a booking widget's own answer when that answer is reachable without a credential.

That layer is real evidence of a real surface, and it is not the property's inventory. A rate served by a widget is one rate plan at one moment, subject to the engine's caching and anti-bot controls; an aggregate scan cannot establish that it saw every rate plan, every negotiated rate or the exact inventory at the second the job began. Where a fact sits behind a credential, it is `not captured` — and the reading prints that, rather than calling the property unready for a fact it never let anyone see.

## The consent boundary

Find is observable without asking anyone: the public surface is public.

Act, confirm and recover are not. Starting a booking, reading a receipt and cancelling the job all touch the property's own records, and a scan that does them without consent is a party to the transaction. So:

- the property **shall** provide a test account, a declared test job, or an instrumented environment; and
- the scan **shall** record which of those it was given, on the reading.

A vendor can hold the second key. A hotel's authorization is not always enough: several booking engines also require the vendor to onboard the scanner — a signed partnership agreement, a registered client name. Both gates are named on the reading when a job needed both, because a property that consented and was still unreachable is a fact about the vendor, not a fault of the hotel.

Without that access, act, confirm and recover are `not captured` for that reading. They are not failed, they are not passed, and the level is capped at what find alone can support — Level 1. A property is never graded down for declining a test account; it is read at the level its observable surface supports and the rest is printed as a question.

## Admission is per layer

A reading records where the agent was let in — discovery, the property's site, the booking engine, the payment step — with the exact challenge it met, if any. One layer admitting the agent says nothing about the next: a property that serves a plain booking page can still be invisible to the search an agent starts from, and a search that works can end at an engine that refuses sessions.

A surface that refuses an agent gets no level. That is a refused reading, and an absence of a level is a true statement about it.

**The record names the agent's authority envelope**, not only its type: what it was permitted to use on the guest's behalf — browsing, mail read, saved sessions, SMS, a payment mandate. An emailed one-time code is unusable to an agent without mail access and trivial to one with it; a "Continue with Google" button is passable only by an agent driving the guest's signed-in browser. Two readings are comparable only at equal envelope.

**The record names the agent that asked**, because admission is a property of the agent as much as of the surface. The survey compared a scripted HTTP client with a browser-driving agent on the same ten surfaces: four were refused at the edge when scripted, one when browser-driven. A reading that does not say which agent it was is reporting a fact about its own tooling.

## A receipt in the guest's inbox is not a missing receipt

Where a confirmation is sent to the booking party — the guest's email, their SMS app — an agent acting for that guest may read it with the guest's permission. The scan is a third party and may not. That difference is recorded, not scored: `same-party channel`, not `missing`.

What remains a finding is a receipt whose only path is a human completing a password login, a phone OTP or a challenge. The channel does not decide that; the step does.

## The private-receipt rule

A confirmation that exists but cannot be reached by a program is a finding about the surface. It is recorded as `missing` in confirm, with the class `inferred` — the scan saw the promise, not the receipt — and it caps the level at 2.

It is never recorded as `not captured`. `not captured` means the scan could not look; a receipt mailed to a human is a surface that cannot be read by an agent, which is the thing this standard measures.

## What the scan will not do

- **Book a real room without consent.** No real charge, no real guest, no real cancellation.
- **Contact a person.** The route to a human is recorded; it is not used.
- **Probe authentication.** Attempts to bypass auth, enumerate credentials or test rate limits are security testing, which is a different discipline and a different engagement.
- **Scan a competitor's production surface** to publish a reading about it. A reading is published by or with the property.
- **Use a sandbox as evidence about a property.** A partner mock or a test environment shows that a contract exists; it says nothing about this hotel, and no field read from one is printed as a receipt.
- **Take the property's word.** A capability is never `strong` because a page says it exists; the scan's own observation, or a documented contract it can be held to, decides.

## What is kept

The scan keeps the requests it made and the receipts it created — id, time, fields — as the evidence behind the reading. Guest data in a test job is synthetic and stays synthetic. The reading prints the evidence it used; it does not print a property's operational data.
