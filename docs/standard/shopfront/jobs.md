# Hotel shopfront jobs — 22 jobs

The first shelf. A hotel that an agent can book, confirm and cancel with, without a guest or a person in the middle.

Every job below is a statement about the **surface**, not about the hotel's agent or its booking engine's owner. The ids are shelf-scoped and carry no version: `HFD-F03` is the same job in every edition of this standard until a later edition says otherwise. An id never moves between families.

| Prefix | Family | Count |
|---|---|---|
| `HFD-F` | Find — the facts a job needs, readable by a program | 7 |
| `HFD-A` | Act — starting the job | 5 |
| `HFD-C` | Confirm — the receipt | 5 |
| `HFD-R` | Recover — changing and unwinding it | 5 |

The class column is the evidence the job can be settled with, under [what a scan can capture](evidence.md). `observable` jobs are settled by an unauthenticated request; `inferred` jobs by a published rule applied to one; `not captured` is never printed as a pass.

## What the jobs are anchored to

No job here is invented for this standard. Each family borrows its shape from work already published, and the reading names the anchor it used.

| Family | Anchor | Status of the anchor |
|---|---|---|
| Find — static facts | Schema.org `Hotel` / `LodgingBusiness` and the page's own structured metadata | published vocabulary; carries no live availability |
| Find — rate and availability | the booking engine's own read path (the widget's endpoint, or a partner API such as a channel manager's rates call) | **no anonymous feed exists**; several engines need a registered client or a signed partnership |
| Act | UCP lodging booking draft — a session with Create, Get, Update, Complete, Cancel, and its published states | **draft**, may change; the draft requires a human review page unless the AP2 mandates extension is supported |
| Confirm | the same draft's Booking Confirmation and its optional `confirmation` field | draft; a merchant-hosted reference is accepted in its place |
| Recover | UCP's Cancel operation and its `canceled` state; AP2 mandates v0.2 for autonomous recovery | draft and a published pre-1.0 specification |
| Disclose | the IETF aipref drafts and Content-Signals lines, where a surface publishes one | drafts; a declaration is recorded, never required |

The consequence is stated plainly: a job in the act, confirm or recover family cannot be settled without the property's test account or a partner credential, and a rate read from a widget is one plan at one moment rather than the hotel's inventory.

## Find

| Id | The job | What the surface exposes | Passes when | Class |
|---|---|---|---|---|
| HFD-F01 | Find the rate for a stay | a nightly price for named dates, with currency, tax and fee treatment | the answer a visitor gets is readable by an agent, and totals the stay | observable |
| HFD-F02 | Find what is bookable | the room types available on named dates | availability reaches an agent as a fact, not a phone call | observable |
| HFD-F03 | Find the cancellation terms | the window, the penalty and the route to cancel | the terms are structured, not only prose | observable |
| HFD-F04 | Find the arrival facts | address, check-in and check-out times, the timezone | all three agree across the surfaces that print them | observable |
| HFD-F05 | Find how payment works | whether it is taken at booking or arrival, and which methods | an agent knows if it must pay before it books | observable |
| HFD-F06 | Find the occupancy rules | per-room occupancy, extra-guest and child policy, the fees | a party size can be checked before booking | observable |
| HFD-F07 | Find the property's attributes | step-free access, parking, pets, and the rest, as explicit attributes | an attribute is present or stated absent, not buried in marketing | observable |

## Act

| Id | The job | The surface must | Passes when | Class |
|---|---|---|---|---|
| HFD-A01 | Start a booking | a documented endpoint, or a stable flow an agent can drive, returning an id | the job starts without a human and returns a reference | observable |
| HFD-A02 | Repeat without booking twice | idempotency: the same request twice returns the same booking | a retry creates nothing new | observable |
| HFD-A03 | Authenticate without a person | a documented way for an agent to obtain access, or a stated unauthenticated policy | access is obtainable without a human in the loop | observable |
| HFD-A04 | Price the booking from the surface | one quote that the action and the confirmation both use | the price the agent acts on is the price the surface issued | observable |
| HFD-A05 | Declare the outcome | a documented status for every request — created, held, declined — with a code | an agent can tell success from failure without reading prose | observable |

## Confirm

| Id | The job | The surface must | Passes when | Class |
|---|---|---|---|---|
| HFD-C01 | Return a receipt | an id, dates, room type, price, tax and terms, readable by a program | every field is present and machine-readable | observable |
| HFD-C02 | Let the receipt be read back | retrieval by id, without a human | the same receipt is readable later, unchanged | observable |
| HFD-C03 | Match the receipt to the quote | the fields the agent was quoted | no invented fee, no moved date, no silent change | observable |
| HFD-C04 | Carry the terms with the receipt | the cancellation and change terms travel with the booking | an agent can act on recovery without re-reading the site | observable |
| HFD-C05 | Name the property and the channel | which property, and which route the booking came through | an agent cites what it booked and how | observable |

## Recover

| Id | The job | The surface must | Passes when | Class |
|---|---|---|---|---|
| HFD-R01 | Change the dates | an end-to-end change that returns an updated receipt | the change is visible in the receipt, not only promised | observable |
| HFD-R02 | Cancel end to end | a cancelled state an agent can read | reading the receipt again shows it cancelled | observable |
| HFD-R03 | Report the refund state | whether money moved, and when | the state is readable, not inferred from a policy page | observable |
| HFD-R04 | Name its failure codes | stable, documented errors for the failures an agent will meet | a failure is a named code, not a message to interpret | observable |
| HFD-R05 | Offer a named human fallback | a route to a person, with an owner | the route exists and names who answers | observable |

**A hold is a state, not a step.** Some engines create a table or room hold when a slot is selected, before any form is submitted. When that happens it is recorded under `HFD-A01`: the hold, its lifetime, and whether abandoning released it. The agent that dawdles past the hold has failed `HFD-A01`, not `HFD-F01`.

## What a level requires

| Level | Jobs that must pass |
|---|---|
| **1 Findable** | the find jobs needed by one job family |
| **2 Actable** | the find jobs and the act jobs |
| **3 Confirmable** | find, act and confirm |
| **4 Recoverable** | find, act, confirm and recover |
| **5 Delegable** | the four families, under a declared mandate the property can bound and revoke — **defined and not awarded in this edition** |

A job that cannot be settled — no test account, no consent — is `not captured`, and the level stops at the last family it could settle. That is a reading of the surface, not a verdict on the hotel.

A surface that refuses an agent at any layer has no level at all: the reading prints the refusal instead. The layer rules are in [the four capabilities](capabilities.md).

## What this shelf does not test

- **The hotel's own bot.** What it says to a guest is the Agent Standard's subject.
- **The booking engine's brand or price competitiveness.** A level says what an agent can do, not what the room is worth.
- **Security.** Authentication bypass, rate limits and enumeration are out of scope.
- **The other shelves.** Restaurant, clinic, local services and e-commerce jobs are later editions; their ids will be `RST-`, `CLN-`, `LCL-` and `ECM-` under the same rules.
