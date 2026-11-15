# The four capabilities

The surface is tested as four capabilities in a chain. Each has one test that decides it, and one way of failing that is not a failure of the property. Two checks run across all four — **Admit** and **Disclose** — and neither is ever scored as a fifth capability.

## Find

Can an agent read the facts the job needs, in a form a program can use?

| Is | Is not |
|---|---|
| structured facts: prices, hours, availability, policies | a search-engine ranking |
| machine-readable terms, with a stable address | AI-search visibility, brand copy |
| one canonical source a reader can be sent to | a PDF a human must read, a fact only in an image |

**The test.** The scan requests the public surface without credentials and asks for the facts one hotel job needs — rate, availability, policy, timing. The capability is `strong` when every fact is present, unambiguous and addressable; `partial` when some are; `missing` when the facts exist only in a form a program cannot read.

**What the visitor layer contains, and what it does not.** Structured metadata on a hotel page is marketing metadata: a name, an address, a location, amenities, sometimes a price range. It is not a bookable rate for named dates. A live rate or an availability answer usually comes from the booking widget's own endpoint, and a scan can replay that answer only when the endpoint is reachable without the property's cooperation — for some engines a sample client identifier is enough to read one property, for others nothing short of a partner credential works. Where the answer is behind a credential, the fact is `not captured`; it is not `missing`.

The capability is never `strong` on the strength of a machine-readable *description* of the facts. It is `strong` when the answer an agent would act on was actually read, and the page says which of the two was read.

## Act

Can an agent start the job without a human opening the page?

| Is | Is not |
|---|---|
| a documented action endpoint, or a stable flow an agent can drive | "we have an API" with no published contract |
| authentication an agent can obtain without a person in the loop | a contact form, a phone number, an email address |
| a request an agent can repeat without booking twice | a one-shot flow with no idempotency |

**The test.** With consent and a test account, the scan starts one job and repeats the request. The capability is `strong` when the job starts and the repeat creates nothing new; `partial` when the job starts but cannot be repeated safely, or when a human must finish it; `missing` when there is no way to start the job at all. Idempotency is part of the capability: an endpoint that books twice on one retry is an action surface no agent can use.

**The shape this borrows.** The published contract nearest this family is the UCP lodging booking draft: a booking is a *session*, not a call — Create, Get, Update (a full-resource replacement), Complete, Cancel — and it carries its own states, from `incomplete` through `requires_escalation` to `completed` or `canceled`. The draft also requires the agent to hand the guest to a trusted, deterministic page for review and completion unless the AP2 mandates extension is supported. That handoff is a fact about the surface, and it caps a reading at Level 2: an endpoint that starts a job and then hands it to a human has not acted without one.

**Selection can be a write.** Some surfaces hold a resource the moment a slot or a room is chosen, before any form is submitted — one restaurant flow held a table for just under five minutes on selection alone. A reading records that hold as an act: `HFD-A01`, with the time-to-live and whether abandoning released it. A scan that treats selection as reading is mutating somebody's inventory and calling it observation.

**Consent has two gates, not one.** Some engines accept a hotel's authorization alone; others also require the vendor to onboard the scanner — a signed partnership agreement, a registered client name. The reading prints which gate was passed. A hotel's consent that the vendor does not honour is a `not captured`, not a failure of the property.

## Confirm

Does the agent get a durable, machine-readable receipt?

| Is | Is not |
|---|---|
| an id, a price, a time and the terms, readable by a program | a human-readable email, or "we'll get back to you" |
| a receipt the scan can read back later by its id | a confirmation that exists only in the buyer's inbox |
| terms that match the quote the agent was given | a receipt whose price or dates differ from the quote |

**The test.** The scan reads the receipt by its id, without a human, and compares its fields with the quote. `strong` requires every field; `partial` requires the id and the price but a gap in the terms; `missing` is a confirmation that a program cannot read.

**The shape this borrows.** The nearest published form is the UCP lodging draft's Booking Confirmation: an optional `confirmation` field on a completed booking session, holding the reservation created from it, and it must not appear while the session is still completing. Where a surface is not UCP-shaped, the same test applies to whatever it does emit: a merchant-hosted confirmation reference, an order number that reads back, a documented resource an agent can fetch.

**A mock is not a receipt.** An exercise against a sandbox or a partner mock shows that a contract exists somewhere; it is evidence about the protocol, never about this property. A reading never prints a confirmation obtained from a mock.

**The receipt is the credential.** Reading back, changing or cancelling a booking usually needs the confirmation: a reservation number, a guest login, an order id. Where that is so, confirm does not merely describe the job — it is what makes recovery possible. A reading cannot claim recover while confirm is unproven, and the page says which credential it would need.

**Whose channel carries the receipt matters.** The confirmation usually arrives by email or SMS with a manage-or-cancel link, and that is not a failure of the surface: an agent acting for the guest can read the guest's own channel with the guest's permission. What the scan has to separate is the three cases—

| Receipt | Verdict |
|---|---|
| an id or page a program can fetch, reachable at booking time | the strong case |
| a token link in the booking party's email that a program can follow without a further step | accepted, reported as same-party-channel |
| a token link that then asks for a second factor the agent can read — a code emailed to the same party | agent-completable, reported per step |
| a link that lands on a password, a phone OTP or a CAPTCHA | **a finding**: a human-only step, whatever channel delivered the link |

**The second factor's channel decides it.** One 2026 Booking.com confirmation carries a per-booking token and, when fetched, redirects to a step-up authentication prompt: the token alone cannot read or cancel the booking. Whether an agent acting for the guest can finish depends on where the verification code goes — email, which the agent may read, or SMS, which it cannot. The record names the channel, and does not call the whole path closed until it knows.

**Recovery is a chain of channels**: a link, then a token, then a code, then a confirmation. It breaks at the first channel the agent cannot read, and the reading says where.

A third-party scan cannot read the guest's inbox, so it cannot verify the middle case. It reports the case as `not captured — same-party channel` rather than turning its own limits into a defect of the property. The job test with consent exists for exactly this: the guest hands over the inbox or the link, and the receipt is read for real.

**The private-receipt rule.** A receipt that exists but cannot be reached by the scan is a **finding about the surface**, not a failure of the scan: the property emits a confirmation, and the confirmation is not machine-readable. It is recorded as `missing` in confirm and it caps the level at 2. It is never recorded as `not captured`, and it is never recorded as a pass on the strength of the property's own description of it.

## Recover

Can the agent change, cancel or refund the job end to end?

| Is | Is not |
|---|---|
| change, cancel and refund, with the outcome observable | "call us", a policy page, "contact support" |
| stable, documented error codes | an error the agent must guess at |
| a named human fallback with a route and an owner | a promise of a fallback with no address |

**The default recovery surface is the confirmation email.** For a booking made on a website, the way back in is almost never an API: it is a link in the confirmation — a manage-or-cancel URL, sometimes a token that opens the booking directly, more often a token that lands on a sign-in first. The reading looks there before it concludes that a surface has no recovery path, and it names which document it is reading: the confirmation, the receipt, or a separate voucher are different emails, and only one of them may carry the link.

**What the link then asks for decides it, and the menu is wider than one factor.**

| The step after the link | What the agent needs | Reachable when |
|---|---|---|
| nothing — the page opens | the link itself | always (and anyone holding the email has it too) |
| an emailed one-time code | the booking party's mailbox | the agent may read that mailbox |
| a texted one-time code | the guest's phone | only an agent with the guest's SMS |
| "Continue with Google/Apple/Facebook" | a live account session | the agent drives the guest's own signed-in browser |
| a password | credentials, or a password manager | the agent holds them |
| a passkey / platform authenticator | the guest's device | the agent drives that device |
| a "verify you are human" challenge | a person | never |

**The floor decides, not the headline.** A sign-in that offers a passkey and falls back to a mailed code is, for an agent, only as strong as the fallback — and the same is true for anyone else holding that mailbox. Reachability is the union of the offered methods that sit inside the envelope, and the reading prints the *weakest* one, because that is the method that will actually be used. An observed 2026 case offered a passkey, then an emailed OTP with a 44-second countdown after the passkey was declined: the passkey was not the ceiling it looked like.

**Recovery has a time budget.** A code that expires in 44 seconds, a hold that lasts five minutes, a token that dies in a day: an agent slower than the timer needs a new one, and the reading records the timer beside the step.

**A sign-in with a menu is passable in more ways than one.** Where the link lands on a sign-in that offers several methods, the reading lists what was offered and names which one sat inside the envelope: a social button in the guest's signed-in browser, an emailed code in an agent that may read their mail, a password in a password manager. "Sign in required" is not a verdict. One observed case carried a booking token into `signin.html` with LINE, Google, Facebook, Apple and an email path offered, and the email path's next step — password or mailed code — is what decides it.

So "human-only step" is too blunt. The reading records **the step and the credential it wants**, then whether that credential sits inside the agent's authority envelope. A sign-in is not automatically a wall: an emailed code is inside the envelope of an agent reading the guest's mail; a social login is inside it only when the agent drives a signed-in browser; an SMS is inside it almost never.

**And there is a trade on the other side.** A link that opens the booking with no further step is the most agent-friendly shape — and it is a bearer credential: anyone forwarded that email can read, change or cancel the booking. A link that demands a sign-in is the safer shape and the harder one for an agent. The reading prints both halves, because a surface that scores well on recovery reachability and badly on link safety is a surface to be careful with.

**The test.** The scan changes the test job, then cancels it, then reads the refund state. `strong` requires all three end to end; `partial` requires the change or the cancel but not both, or a refund state that cannot be read; `missing` is a job that can only be changed by a person. The capability also carries the failure the agent will meet: the documented error codes, and the route to a person when the surface cannot help.

**The shape this borrows.** UCP's draft binds Cancel to the session and gives the session a `canceled` state an agent can read back, which is exactly the test above; the change path is the same session's Update. Nothing here needs a new contract invented for it — where a surface conforms to any of this, the reading says so, and where it does not, the same test applies to what it does emit.

**Autonomy is not recovery.** An agent that cancels on its own authority needs a mandate — the AP2 mandate model, open and closed, with a bounded scope — and that is the Level 5 question, which this edition does not award. Recovery at Level 4 is a human-granted job, changed or cancelled by an agent acting on that grant.

## Disclose

Cross-cutting, on every capability and never a fifth one:

- does the surface say it is dealing with an agent, and where?
- are the terms of the transaction reachable before it is started?
- what does the surface do with the data the job supplies, and is that stated at the point it is collected?

Disclose does not move the level. It moves the grade: a surface that handles a booking well and says nothing about what it does with a guest's details grades lower than one that says it plainly, and a disclosure that contradicts the property's published policy is a consistency failure.

A surface that publishes a preference for how its content may be used by AI — the IETF aipref drafts, or a Content-Signals line in `robots.txt` — is stating terms to an agent, and the reading records what it states. Both are drafts, and this standard neither requires a declaration nor counts its absence as a failure. What it records is whether the terms an agent needs are reachable before a job starts, and whether they agree with the property's own published policy.

## Admit

Cross-cutting, beside disclose: is an agent let in at all, and by whom? This is recorded **per layer**, because the layers fail independently — a property can admit an agent that a search engine never let find it.

| Layer | The question | What is recorded |
|---|---|---|
| **discovery** | can an agent find the business — search, maps, a directory? | the challenge or the listing that worked |
| **the property's site** | does it serve an agent the page a visitor gets? | the block, or its absence |
| **the booking engine** | does the engine accept the session? | a challenge, a refusal, or a session |
| **the payment step** | is there a path an agent can take? | the method, or the wall |

Statuses: **admitted** · **admitted with stated terms** · **challenged** · **blocked** · **not found**, each with the exact text and the layer.

**Every admission record names the agent that asked.** The same property admits one kind of agent and refuses another: in the November 2026 survey, four of ten New York surfaces refused a scripted HTTP client at the edge — Marriott's *"Access Denied"*, Booking.com's *"we need to verify that you're not a robot. This requires JavaScript."*, Tock's *"Just a moment…"*, NYU's `403 Forbidden` — and three of those four let a browser-driving agent straight through to the guest-details page. One (Zocdoc, DataDome) stopped both.

So a reading prints **the agent type** beside every Admit result: a browser-driving agent, or a scripted client. A scripted block is not evidence that a business refuses agents, and a browser pass is not evidence that it is open to a scan. A refusal counts only against the agent that met it.

The rules that keep it honest:

- **A blocked layer is a fact about the layer, not a capability failure.** It is printed with its mechanism and never turned into a lower level.
- **A blocked layer means no level at all.** Print the refusal and the mechanism; a reading that scores a door nobody opened is a false fact. "Not admitted" is not Level 1.
- **A mechanism present is not a mechanism enforced.** A page can carry reCAPTCHA, DataDome or a WAF and never challenge the agent; the reading records whether it was *triggered*, not whether the vendor's tag is in the HTML.
- **The two access paths can disagree, not just block differently.** On one restaurant surface a slot was `is_requestable: true` in the API and unavailable in the browser; on an OTA the rate existed only for the browser. Every fact prints the path that produced it — scripted or browser — and two disagreeing facts are printed as two facts.
- **Account walls are not bot blocks.** A login or a phone OTP ("Log in or sign up to book"; "We'll need to verify it's you to continue") says a person must sign, not that agents are unwelcome. It is recorded as its own friction, and it caps the level like any other incomplete link.
- **Not found is a discovery finding.** Every observed block in the November 2026 survey was at discovery, not at a business: a search engine challenged the agent, and no property or booking engine did. That distinction is the difference between a business that refuses agents and one that never hears from them.
- **Stated terms are recorded, not scored.** A surface that declares automated booking is not permitted is `admitted with stated terms`: the terms are the property's to set, and the reading prints them so a buyer can see what the agent met.

## The chain

The capabilities are read in order and the level is where the chain stops. A `missing` link caps the level; a `not captured` link does not, but it also cannot lift the level — a surface cannot reach Level 4 on a recovery path the scan never observed.
