# ShuttlePower — club decision brief

**For:** Matag-ob Badminton Club

**Prepared:** 2026-11-01

**Status:** the formula decisions (F1–F3, rows 1–6) were **approved 2026-11-03 by the club owner** and recorded as
D13 in `PLAN.md` §7. **F4 (corrected/invalidated results) was approved the same day as D14.** Migration 016 enabled the
`approved-2026-11` rule, and migration 017 added the tournament award and F4 reversals, so confirmed friendlies and
completed tournament matches now award SP and a corrected tournament result reverses and re-awards. The seasonal rules
S1–S23 are **implemented locally in migration 018** (ranking, snapshot, deduction batch, transition job, recovery, and
leaderboard); migration 018 and policy 018 still need applying to the hosted project. The placement and unplayed-match
rows (7–8) remain open.

**Read time:** about 5 minutes. Every number has a one-line reason.

---

## Why you are being asked

The app already records friendly matches, tournament results, and player profiles. **Confirmed friendlies and completed
tournament matches now award SP** under the approved formula. Placement and unplayed matches still do not, because
those paths are unbuilt or unapproved. The exact numbers were approved by the club, never guessed by a developer.

This page originally asked for every number in one sitting. The formula and correction rules are now decided; what
remains is placement and the unplayed-match rule.

**Formula only, nothing else?** `docs/sp-formula-signoff.md` packages just §7 rules 1, 2, and 6 plus F4; its F1–F4 rows
are all approved.

## Already decided — please do not re-decide these

| Rule | Value | Where it came from |
| --- | --- | --- |
| A new player starts at | **1,000 SP**, awarded once | Already built and tested |
| Official tournament match | **2×** a friendly's impact | Already built |
| Manual SP edits | Never. Every change is a permanent ledger row | Already built |
| Rated player facing a new player (D11) | **No change at all** — no gain, no loss, no ledger row | You approved this on 2026-11-01 |
| Which matches count toward placement (D12) | Only matches actually played and finalized | You approved this on 2026-11-01 |

## How the formula behaves, in plain English

At **equal strength**, the winner gains 20 and the loser loses 20.

- Beating someone **stronger** pays more; losing to someone stronger costs less.
- Each **50 SP** of rating gap is worth **1 point**.
- One **singles** match moves at most **40 points** for a player (before the tournament doubling) and at least
  **5**. In doubles the team adjustment is split between the two partners, so each partner moves half of it: at
  most 20, and a 5-point team minimum becomes 3 and 2 rather than 5 each.
- An **official tournament** match moves exactly twice those amounts: 10 to 80 points for the team, which is 5 to
  40 per partner in doubles.

```
Win:  gain = clamp(20 + 0.02 × (opponent SP − your SP), 5, 40)
Loss: loss = clamp(20 + 0.02 × (your SP − opponent SP), 5, 40)
Tournament: multiply the rounded result by 2
```

| Your SP | Opponent SP | Result | Friendly | Official tournament |
| ---: | ---: | --- | ---: | ---: |
| 1,000 | 1,000 | Win | **+20** | +40 |
| 1,000 | 1,000 | Loss | **−20** | −40 |
| 1,000 | 1,500 | Win | **+30** | +60 |
| 1,000 | 1,500 | Loss | **−10** | −20 |
| 1,000 | 500 | Win | **+10** | +20 |
| 1,000 | 500 | Loss | **−30** | −60 |
| 1,000 | 2,000 | Win | **+40** (capped) | +80 |
| 1,000 | 2,000 | Loss | **−5** (minimum) | −10 |

---

## Decision 1 — the formula numbers

| Setting | Approved 2026-11-03 | What it means | If you change it |
| --- | --- | --- | --- |
| Base change | **20** | An even match moves 20 points | Higher makes every match more decisive |
| Strength sensitivity | **0.02** | 1 point per 50 SP gap | `0.04` was the old draft; it treats ordinary club differences as extreme |
| Minimum per match | **5** | A win or loss always records something | 0 would create matches with no ledger entry |
| Maximum per match | **40** | Caps one match at 4% of the starting rating | Higher lets one upset swing the table |
| Tournament multiplier | **2** | Official matches count double | Already your rule |
| Rounding | **Half-up**, on the size of the change, before doubling | 20.5 becomes 21 | "Banker's rounding" would give 20; the club should pick one. It also changes tournament results by up to 1 point against today's engine — see the note below |
| Cap order | 40 is the **normal** cap; **80** is the tournament maximum | A tournament can move 80 | The alternative is a flat 40 cap for every match |

**Correction, 2026-11-02.** An earlier version of this page said rounding before doubling changes no number today.
It does: the running engine multiplies and *then* rounds, and the two orders disagree on about half of the rating
gaps that stay inside the 5–40 limits — for example a 13-point gap gives **41** today against **40** as proposed.
Friendly results are identical; only official tournament matches differ, and by 1 point. Approving the row also
approves that change.

**Approved 2026-11-03: all seven as written.** They are the middle of the range: visible on the leaderboard,
but no single match decides a season.

## Decision 2 — can SP go below zero, and is there a ceiling?

| Setting | Approved 2026-11-03 | Why |
| --- | --- | --- |
| Minimum SP | **0** | A negative rating cannot be read on a leaderboard or used for strength comparison |
| Maximum SP | **None for now** | The club has no evidence for a ceiling; an arbitrary one punishes the strongest players |

The cost of a zero floor: a player at 4 SP who loses 20 drops only 4, so the two sides of that one match no
longer balance exactly. That happens only near zero.

**Approved 2026-11-03: minimum 0 and no ceiling.** Revisit the ceiling after a full season if the top of the
table runs away.

## Decision 3 — doubles

**Approved 2026-11-03:** use the **average** of the two partners' SP as the team strength, calculate **one** team
adjustment, then **split it evenly**. A doubles match then moves the same combined total as an equivalent
singles match.

**One caveat, if Decision 4 is also approved.** During a new player's placement matches the rated partner does
not move (D11, already approved). If a newcomer plays doubles with a rated partner, only their half of the
team adjustment is applied, so they move at half the rate of a singles newcomer — and depending on which player
id sorts first, the odd point can be dropped. That is a consequence of D11, not of the split itself, and it is
why a mixed rated/unrated doubles pair still needs a decided rule.

- Example: Team A averages 1,100, Team B averages 1,400. A wins → team adjustment **+26** → **+13 / +13**.
- An odd adjustment cannot split evenly. The extra point goes to the partner whose **player id sorts first** —
  a fixed, auditable rule that does not depend on names or entry order.
- One parameter set covers singles and doubles. Separate doubles numbers are possible but add complexity for
  no clear benefit.

**Approved 2026-11-03: the even split, the lower-id odd point, and one shared parameter set.**

## Decision 4 — new players: hide their SP for 10 matches?

This is the one genuinely new feature in the proposal. It is **separate from the formula**: you can switch SP on
without it.

> **Not implementable as it reads (2026-11-02 review).** Hiding the number needs a permission and read-path
> change, not a screen change: today every member can read every balance, and a player can read their own
> ledger. Approving Path B approves that work too. The detail is in
> `docs/sp-placement-technical-review.md`.

**The proposal:** a new player is publicly **Unrated** for their first **10 eligible finalized matches**. Their SP
is calculated normally from match one, but kept hidden. At the 10th match the accumulated value is published
**unchanged** — no reset to 1,000, no bonus. The player sees only progress, e.g. `6 / 10`. Rated opponents in
those matches get **no SP change at all** (D11, already approved).

Why bother: a brand-new player's first results are noisy, and publishing them immediately can put a beginner at
the bottom of the table on day one and make them reluctant to play.

| What must be confirmed | Recommended |
| --- | --- |
| Number of placement matches | **10** |
| Starting hidden value | **1,000** (the existing starting award becomes the hidden balance) |
| Who can see the hidden number | Not true today: every member can read every balance, and a player can read their own ledger. Hiding it is a policy and read-path change that ships with Path B |
| After qualification | The hidden value becomes the public SP, unchanged; no bonus row |
| Can a player be un-qualified later | **No**; a late correction adds an 11th match to an already-Rated player |
| Existing players | Backfill as **Rated** — they are already published |

**Two ways to go live — pick one:**

- **Path A (fastest):** approve the formula only. Everyone is Rated, new players appear at 1,000 immediately,
  and SP starts moving. Placement can be added later as a separate change.
- **Path B (recommended):** approve the formula **and** placement together. New players are protected from day
  one, and the app ships the full design in one reviewed migration.

## Decision 5 — what happens to unplayed matches

Walkovers, no-shows, forfeits before play, disqualifications, and withdrawals before play should **not move SP**.
A retirement after play counts only when an official final result exists. Placement eligibility for these is
already settled by D12; this decision is only about SP.

**Recommendation: no SP for any match that was not actually played to a final result.**

---

## What is NOT being decided today

These are real, but they block only later phases. Approving the five decisions above does not require them.

| Topic | Why it can wait |
| --- | --- |
| Seasonal deduction tiers and dates | Phase 8 only. SP works without seasons |
| Who resolves a disputed friendly result | Only matters once a dispute is raised; the app already blocks SP for disputed matches |
| Whether one or both losing doubles partners must approve | Friendly doubles is not built yet; only singles friendlies ship |
| Historical placement credit | Existing players simply start as Rated; no backfill is proposed |

---

## What happened after the formula approval

1. The decision was recorded in `PLAN.md` §7 as D13 with the date, the approver, and every value. F4 followed the same
   day as D14.
2. A **new** rule version, `approved-2026-11`, was created by migration 016 and enabled. The old provisional version
   was never edited, so past calculations stay auditable.
3. The approved rounding order and doubles remainder rule were implemented in the calculation engine and in the
   friendly awarding database function, with tests proving SP is awarded exactly once.
4. Migration 017 added the tournament award and F4's compensating reversals. A completed tournament match now awards
   the 2× adjustment; a winner-flip correction reverses its prior rows and re-awards under the original rule version,
   while a score-only correction that keeps the winner writes no SP rows.
5. The version is **enabled**, and confirmed friendlies and completed tournament matches now move SP.
6. Migration 018 implemented the approved seasonal rules S1–S23 locally: the ranking and tie-break statistics, the
   immutable season snapshot, the fixed-tier deduction batch, the January transition with retries and Super Admin
   recovery, and the seasonal leaderboard. Migration 018 and policy 018 are not yet applied to the hosted project.

**What is still not switched on:** placement and SP for unplayed matches. Those remain separate approvals and
implementation work. The seasonal implementation is complete locally but awaits the hosted migration.

---

## Sign-off

Initial each line you approve, or write the value you prefer.

| # | Decision | Recommended | Your decision | Initials | Date |
| --- | --- | --- | --- | --- | --- |
| 1 | Base / sensitivity / min / max | 20 / 0.02 / 5 / 40 | **Approved** | Club owner | 2026-11-03 |
| 2 | Tournament cap | 40 normal, 80 tournament | **Approved** | Club owner | 2026-11-03 |
| 3 | Rounding | Half-up, before doubling | **Approved** | Club owner | 2026-11-03 |
| 4 | Minimum SP / ceiling | 0 / none | **Approved** | Club owner | 2026-11-03 |
| 5 | Doubles split | Even, odd point to lower id | **Approved** | Club owner | 2026-11-03 |
| 6 | Doubles parameters | One set for singles and doubles | **Approved** | Club owner | 2026-11-03 |
| F4 | Corrected / invalidated results | Compensating rows only; re-award under the original rule version | **Approved** | Club owner | 2026-11-03 |
| 7 | Placement system | Path B (10 matches, hidden, publish unchanged) or Path A (defer) | **Open** | | |
| 8 | Unplayed matches | No SP | **Open** | | |

**Approved by:** Club owner  **Role:** Club owner  **Date:** 2026-11-03 (rows 1–6 and F4; rows 7–8 open)

---

*Sources: `AGENT.md` §4.3 and §7 rules 1–14; `PLAN.md` §7.1 (approved formula), §7.2 (placement proposal),
D11 and D12. Where this page and those documents disagree, those documents win.*
