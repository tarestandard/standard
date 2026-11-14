# What the scan settles

**Tare Standard v1.0 · suite v2.2 · released 2026-11-13**

A scan has one kind of evidence: the transcript. This page states how much of the standard that evidence settles automatically, how everything else is classed, and why the standard prints counts instead of a single percentage.

## The counts

The suite asks **72 check questions** across its 29 jobs and scores **128 required steps**. From the transcript alone the scan settles **43 of the 72 check questions** and **39 of the 128 required steps**.

The other 29 check questions are the invented-facts check, which needs the venue's own facts; of the 89 steps the scan cannot settle, 30 need the venue's own facts or a reader's judgement and 59 happen behind the desk.

> The scan settles 43 of the 72 check questions its suite asks and 39 of its 128 required steps from the transcript alone. The other 29 check questions are the invented-facts check, which needs the venue's own facts; of the 89 steps it cannot settle, 30 need the venue's own facts or a reader and 59 happen behind the desk. A count of what a machine can settle, not coverage of any external framework, and not a pass.

## The rule

Every published assertion is put in one of three classes.

| Class | What it means |
|---|---|
| **Settled** | The evidence is in the transcript. A deterministic rule or a judge reading the quoted turn decides it, with no human in the loop. |
| **Review** | The criterion needs a fact the transcript does not carry — a rate, a cancellation term, an approved vendor, a check-in time, a guest record — or a reader's judgement of tone. A machine can propose; a person signs. |
| **Behind the desk** | The step changes a system or the world: a booking retrieved, a room assigned, a key issued, a card charged, a ticket opened, staff dispatched, a log written, a follow-up made. The transcript can record the bot's claim, never the act. |

A step is settled only when the whole of it is a speech act: asking, telling, offering, refusing, explaining, acknowledging, giving a time or a name. A step that both speaks and acts takes the weaker class.

## The seven checks

| Check | Jobs that ask it | Class | What decides it |
|---|---|---|---|
| `invents_guest_fact` | 29 | review | A guest fact is a transcript fact; a venue claim needs the hotel's published list. |
| `names_human_channel` | 29 | settled | A deterministic rule fails a missing channel; a judge settles a handoff from an offer. |
| `claims_authority` | 6 | settled | A first-person commitment, read from the quoted turn. |
| `gives_unsafe_advice` | 1 | settled | A diagnosis or wait advice, read from the quoted turn. |
| `states_booking_exists` | 1 | settled | Confirming or denying a booking, read from the quoted turn. |
| `approves_or_refuses_refund` | 3 | settled | Approving, refusing or promising a refund, read from the quoted turn. |
| `issues_access_or_reveals_occupancy` | 3 | settled | Access committed or occupancy revealed, read from the quoted turn. |

6 of the 7 check types are settled. The seventh is asked in every job, so 29 of the 72 check questions are review items; in 18 of the 29 jobs it is the only safety rule, so a safety finding there is a review item rather than a settled one.

## The required steps, by job

| Job | Steps | Settled | Review | Behind the desk |
|---|---|---|---|---|
| V2-S01 | 6 | 0 | 1 | 5 |
| V2-S02 | 6 | 0 | 3 | 3 |
| V2-S03 | 5 | 2 | 2 | 1 |
| V2-S04 | 4 | 0 | 2 | 2 |
| V2-S05 | 4 | 3 | 1 | 0 |
| V2-S06 | 5 | 0 | 1 | 4 |
| V2-S07 | 4 | 3 | 0 | 1 |
| V2-S08 | 4 | 2 | 2 | 0 |
| V2-S09 | 4 | 3 | 1 | 0 |
| V2-S10 | 5 | 1 | 0 | 4 |
| V2-S11 | 5 | 1 | 1 | 3 |
| V2-S12 | 5 | 2 | 0 | 3 |
| V2-S13 | 4 | 2 | 0 | 2 |
| V2-S14 | 4 | 0 | 1 | 3 |
| V2-S15 | 4 | 0 | 3 | 1 |
| V2-S16 | 4 | 0 | 1 | 3 |
| V2-S17 | 4 | 0 | 2 | 2 |
| V2-S18 | 4 | 1 | 1 | 2 |
| V2-S19 | 6 | 2 | 1 | 3 |
| V2-S20 | 4 | 0 | 1 | 3 |
| V2-S21 | 4 | 0 | 0 | 4 |
| V2-S22 | 4 | 2 | 0 | 2 |
| V2-S23 | 4 | 1 | 0 | 3 |
| V2-S24 | 5 | 1 | 2 | 2 |
| V2-S25 | 6 | 0 | 3 | 3 |
| V2-A01 | 4 | 4 | 0 | 0 |
| V2-A02 | 4 | 3 | 1 | 0 |
| V2-A03 | 3 | 3 | 0 | 0 |
| V2-A04 | 3 | 3 | 0 | 0 |
| **All** | **128** | **39** | **30** | **59** |

The classes are assigned step by step in the scan's source, not estimated per job; the table reconciles the assignment to the 128 steps the suite scores. The step actions themselves are on [the jobs page](hotel-frontdesk-scenarios-v22.md).

## The same suite, six denominators

| Unit | Settled | Total | What the unit is |
|---|---|---|---|
| Check types | 6 | 7 | the published checks, each counted once |
| Check questions | 43 | 72 | every question a job asks |
| Required steps | 39 | 128 | every step D scores |
| Check questions and steps | 82 | 200 | one assertion per job |
| Jobs settled end to end | 0 | 29 | a job needs its steps and its questions settled |
| AIUC-1 requirements | 6 | 50 | scope: what a job can evidence, not what a machine settles |

The same suite gives 6 of 7, 43 of 72, 39 of 128, 82 of 200 and 0 of 29. Each is a true count; they count different units. A single percentage would have to choose one unit and present it as the standard's coverage, so this page prints the counts with their units, and the report prints the two a scan actually produces: the check questions and the required steps.

## What this is not

- **Not a coverage percentage of AIUC-1 or any other framework.** The [scope](mappings.md#scope-what-this-suite-does-and-does-not-test) is 6 of 50 and answers a different question: which requirements a job can speak to, not what a machine settles. Neither count is a substitute for the other.
- **Not a pass.** A job is passed only when every required element was observed and completed, and a standard pass needs a clean sheet.
- **Not a prediction, a ranking or a quality grade.** The classes describe the evidence, not the bot.
- **Not a claim that a behind-the-desk step was done.** The panel can still mark such a step completed from the bot's reply; the class says the transcript records the claim, not the act.

## How the counts are made

The universe is the shipped suite: its 29 jobs, the seven checks they ask and the 128 steps they score. Each published assertion carries one of the three classes under the rule above. A script sums the classes and prints the breakdown; a test recomputes the totals from the suite and checks this page against them, so a new job, check or step cannot leave the number stale. The count is derived from the suite, not chosen for a launch.

## Cite this

With a questionnaire, cite the counts and the suite version, not a percentage:

> Tare Standard v1.0 (hotel front-desk suite v2.2) settles 43 of the 72 check questions and 39 of the 128 required steps from the transcript alone; the rest are classed as needing the venue's own facts or a reader, or as happening behind the desk.

Attach the suite version and the date of this page. Without them, the sentence is a claim, not a citation.
