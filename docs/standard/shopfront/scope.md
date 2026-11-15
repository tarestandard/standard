# Scope and anchors

This standard covers one thing: what a hotel exposes to an agent, and how far an agent gets. It is deliberately narrower than the question a buyer asks, and the edge of the instrument is printed here rather than discovered later.

## What it covers

- **One property × one job family.** The first edition covers the hotel shopfront: 22 jobs across find, act, confirm and recover.
- **The surface, not the bot.** Public facts, action endpoints, receipts and recovery paths — the interfaces an agent can use without a human.
- **Four capabilities and two cross-cutting checks.** Find, act, confirm and recover, with **Admit** and **Disclose** beside them — the level, the grade and the profile, with the evidence class behind each.
- **A dated reading.** A level is a fact about one day and one edition; a later scan is a new reading.

## What it does not cover

| Not covered | Why |
|---|---|
| the hotel's own bot behaviour | that is the [Agent Standard](/agent)'s subject: what a bot says to a guest |
| security testing | auth bypass, enumeration and rate-limit probing are a different discipline and a different engagement |
| legal or regulatory conformity | a reading is not a PCI DSS finding, a GDPR assessment, a consumer-law opinion or an AI Act conformity assessment |
| price competitiveness, revenue management or ranking | a level says what an agent can do, not what the room is worth |
| a vendor's description of its own API | a claim is not an observation; the scan's own request, or a documented contract it can be held to, decides |
| the other shelves | restaurant, clinic, local services and e-commerce arrive in later editions |

**Scope is not coverage.** The 22 jobs are the hotel booking loop, not every interface a hotel could expose. A reading that finds everything in this standard has found what this standard asks about, and no more.

## The anchors

The anchors below are **informative**. Nothing in this standard requires conformance to any of them, and a reading never claims that a property conforms to one. They are named because they are the work this standard borrows its shape from, and because a reader is entitled to know which draft a sentence came from and what state that draft is in.

| Anchor | What it is | Status, 2026-11-14 | What this standard takes from it |
|---|---|---|---|
| **UCP lodging booking** (`dev.ucp.lodging.booking`) | a booking session — Create, Get, Update, Complete, Cancel — with published states and an optional `confirmation` | **draft**, explicitly may change; pre-release implementations must not be surfaced through public discovery | the shape of act, confirm and recover, and the human-handoff rule that caps a reading at Level 2 |
| **AP2 mandates** | the checkout and payment mandate model, open and closed, human-present and human-not-present | **published v0.2**, pre-1.0, not an RFC | the meaning of a bounded mandate, and why Level 5 is defined but not awarded |
| **MCP authorization** | tool servers with protected-resource metadata and OAuth 2.1 | shipped spec revision, 2026-07-28 | how a tool-exposing surface is read where it is not REST-shaped |
| **IETF aipref** | `draft-ietf-aipref-vocab-08` and `draft-ietf-aipref-attach-05`: a vocabulary and an attachment method for AI usage preferences | **active Internet-Drafts**, not RFCs | what a surface declares about its content's use, recorded, never required |
| **Schema.org `Hotel` / `LodgingBusiness`** | structured metadata for a lodging property | published vocabulary | the static facts a visitor layer can carry — and the reason it cannot carry a live rate |
| **Content Signals** | `search`, `ai-input`, `ai-train` signals added to `robots.txt` | a vendor policy, not a standard | a declaration a surface may publish; recorded the same way |

## What the anchors do not give

An anchor is not evidence about a property. None of the booking engines examined in November 2026 publishes an anonymous rate and availability feed: live rates and inventory sit behind a registered client name, a property API key, or a signed partnership agreement. That is the fact behind the standard's evidence rules — the visitor layer is observable, the inventory is not, and a mock or a sandbox proves a contract exists rather than that this hotel conforms.

The date on every anchor matters. UCP is draft and may change, AP2 is pre-1.0, and the aipref drafts are drafts: a reading that cites one says which edition of the draft it saw, and a later edition of this standard may change what it takes from them.

## How to cite this standard

Cite the pair, the job family and the edition, and never the level or the grade alone:

> Tare Shopfront Standard v1.0, published 2026-11-14, Level 3 · Grade B, hotel booking, judged 2026-11-14.

**Attach with it.** The agent type that asked — a browser-driving agent is a different fact from a scripted client — the evidence class the pair was read against, and the receipt the reading was taken from. Without those, the sentence is a claim, not a citation.

This edition awards no Level 5: the level is defined and not awarded, and a surface that prints one is citing a draft, not a reading under this standard.
