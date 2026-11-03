# ShuttlePower formula — sign-off package

**For:** Matag-ob Badminton Club

**Prepared:** 2026-11-02

**Covers:** `PLAN.md` §7 rules 1 (the formula), 2 (minimum and ceiling), 6 (doubles distribution), and the new §7.1.11
(the rule for corrected and invalidated results, decision F4).

**Status:** F1–F3 **approved 2026-11-03 by the club owner** and recorded in `PLAN.md` §7 as decision **D13**. F4
(corrected and invalidated results) was **approved the same day as D14** and implemented in migration 017. Migration
016 inserts and enables the `approved-2026-11` rule version, so confirmed friendlies and completed tournament matches
now award SP, and a corrected tournament result reverses and re-awards under the original rule version.

**Read time:** about 5 minutes. Every number has a one-line reason, and every example is computed from the formula
on this page.

---

## Why this page exists

The app records matches. **F1–F3 were approved on 2026-11-03 and confirmed friendlies and completed tournament matches
now award SP. F4 was approved the same day**, so a corrected or invalidated played result now has an approved SP
treatment. That is deliberate: the numbers are the club's decision, never a developer's guess.

This page asked for the three formula decisions that switch SP on, and nothing else. It deliberately leaves out the
placement system for new players, the treatment of unplayed matches, and disputes — each is a separate gate.

## Already decided — do not re-decide these

| Rule | Value | Where it came from |
| --- | --- | --- |
| A new player starts at | **1,000 SP**, awarded once | Already built and tested |
| Official tournament match | **2×** a friendly's impact | Already built |
| Manual SP edits | Never. Every change is a permanent ledger row | Already built |
| Rated player facing a new player | **No change at all** — no gain, no loss, no ledger row | D11, approved 2026-11-01 |

---

## Decision F1 — the formula and its numbers

At **equal strength**, the winner gains 20 and the loser loses 20. Beating someone stronger pays more; losing to
someone stronger costs less. Each **50 SP** of rating gap is worth **1 point**.

```
Win:        gain = clamp(20 + 0.02 × (opponent SP − your SP), 5, 40)
Loss:       loss = clamp(20 + 0.02 × (your SP − opponent SP), 5, 40)
Tournament: round the friendly result, then multiply by 2
```

| Setting | Approved 2026-11-03 | What it means | If you change it |
| --- | --- | --- | --- |
| Base change | **20** | An even match moves 20 points | Higher makes every match more decisive |
| Strength sensitivity | **0.02** | 1 point per 50 SP of gap | The disabled draft used `0.04`, which treats ordinary club differences as extreme |
| Minimum per match | **5** | A result always records something | 0 would create matches with no ledger entry |
| Maximum per match | **40** | Caps one match at 4% of the starting rating | Higher lets one upset swing the table |
| Tournament multiplier | **2** | Official matches count double | Already your rule |
| Rounding | **Half-up** on the size of the change, **before** doubling | 20.5 becomes 21 | Banker's rounding would give 20 |
| Cap order | 40 is the **normal** cap; **80** is the tournament maximum | A tournament can move 80 | The alternative is a flat 40 cap for every match |

### What the rounding order changed

The engine before D13 multiplied first and then rounded. The approved rule rounds first. That is not a no-op: it
changed **official tournament results by up to 1 point**, and never changed a friendly. `domain/sp.ts` was updated on
2026-11-03.

| Rating gap | Raw value | Old engine | Approved |
| ---: | ---: | ---: | ---: |
| 13 | 20.26 | 41 | **40** |
| 25 | 20.5 | 41 | **42** |

Across rating gaps from 0 to +2,000, **500 of 2,001 gaps differ by one point** (875 of 4,001 across ±2,000, which is
about half of the gaps that stay inside the 5–40 limits). Only tournament matches are affected. Approve this row
knowing that, not as a wording tidy-up.

### Worked examples

The loss column shows the **size** of the change; the sign is negative.

| Your SP | Opponent SP | Result | Raw value | Friendly | Official tournament |
| ---: | ---: | --- | ---: | ---: | ---: |
| 1,000 | 1,000 | Win | 20 | **+20** | +40 |
| 1,000 | 1,500 | Win | 30 | **+30** | +60 |
| 1,000 | 1,500 | Loss | 10 | **−10** | −20 |
| 1,000 | 500 | Win | 10 | **+10** | +20 |
| 1,000 | 500 | Loss | 30 | **−30** | −60 |
| 1,000 | 2,000 | Win | 40 | **+40** (at the cap) | +80 |
| 1,000 | 2,000 | Loss | 0 → 5 | **−5** (at the minimum) | −10 |
| 1,000 | 200 | Win | 4 → 5 | **+5** (at the minimum) | +10 |
| 1,000 | 1,025 | Win | 20.5 | **+21** (half-up) | +42 |
| 1,000 | 975 | Loss | 20.5 | **−21** (half-up) | −42 |

**Approved 2026-11-03: all seven rows as written.** They sit in the middle of the range: visible on the
leaderboard, but no single match decides a season.

## Decision F2 — can SP go below zero, and is there a ceiling?

| Setting | Approved 2026-11-03 | Why |
| --- | --- | --- |
| Minimum SP | **0** | A negative rating cannot be read on a leaderboard or used for strength comparison |
| Maximum SP | **None for now** | The club has no evidence for a ceiling, and an arbitrary one punishes the strongest players |

Two consequences, stated plainly:

- **Near zero the two sides stop balancing.** A player at 4 SP who loses 20 drops only 4, so that one match no longer
  moves the same amount on both sides. It happens only at the floor.
- **A player at exactly 0 who loses gets no ledger row**, because a zero change is forbidden. That is correct
  behaviour, not a missing record: nothing moved.

**Approved 2026-11-03: minimum 0 and no ceiling.** Revisit the ceiling after a full season if the top of the table
runs away.

## Decision F3 — doubles

**Approved 2026-11-03:** use the **average** of the two partners' SP as the team strength, calculate **one** team adjustment,
then **split it evenly**. A doubles match then moves the same combined total as an equivalent singles match.

- Team A averages 1,100, Team B averages 1,400. A wins → team adjustment **+26** → **+13 / +13**. In a tournament
  the same match is 52 → **+26 / +26**.
- An odd adjustment cannot split evenly. The extra point goes to the partner whose **player id sorts first** — a
  fixed rule that does not depend on names, entry order, or join order, and that the database can reproduce exactly.
  A **25**-point team change becomes **13 / 12**; a **5**-point change becomes **3 / 2**.
- The sign is applied **after** the split, so a −25 change becomes **−13 / −12**.
- **One parameter set covers singles and doubles.** Separate doubles numbers are possible but add complexity for no
  clear benefit.

**Approved 2026-11-03: the even split, the lower-id odd point, and one shared parameter set.**

**One detail this page does not decide.** If the 0 floor (F2) clamps one partner's share, the team total falls short
of the team adjustment. The recommended treatment is to leave the other partner's share as calculated, but `PLAN.md`
records that interaction as still open (which matters only for players near 0 SP). Approving F2 and F3 did not
settle it.

**Not covered here.** A doubles pair where one partner is still in placement is affected by the already-approved D11
rule (the rated partner does not move), which makes the newcomer move at half rate. That is a placement question, not
a formula question, and it only matters if placement is approved.

## Decision F4 — what happens when a result is corrected or invalidated

A result can be changed after it is finalized — a score is entered wrongly, a winner is corrected, a match is
invalidated — and a winner flip is possible. The ledger can never delete or edit a row, so without a rule for this
two players can both end up holding a win from the same match. F4 was the last decision between the approved formula
and a correction-safe award.

**Approved 2026-11-03 — D14, implemented in migration 017:**

- A finalized result awards SP **once**.
- A later correction writes **compensating rows only**. Nothing is edited or deleted, and the compensation is written
  in the same transaction as the correction.
- **Winner unchanged** (scores corrected, games re-entered): no SP rows at all.
- **Winner flipped**: the old award is reversed, then the new winner is awarded.
- **Match invalidated, cancelled, or voided**: every award on that match is reversed.
- **A retry, replay, or repeated approval**: no second row, because the award key is unique.
- A correction re-awards under the **rule version recorded on the original row**, never whichever version is enabled
  today. A formula change therefore never restyles completed matches.
- A correction to a match from a **closed season** adjusts Current SP only; the season's Seasonal SP, ranking, and
  published snapshot are not touched (S7, S19).
- No reversal without a recorded reason, actor, and timestamp, and no "repair" row invented by a reconciliation job.

*Why this matters in plain terms:* without it, the first corrected tournament result leaves the old winner holding
points that the ledger cannot remove, and the new winner holding points they did not earn. Every later change would
add to the drift.

*Cost:* each correction writes two ledger rows instead of one, and the missing-points case stays visible in the
history as a reversal plus a new award rather than a tidy edit. That is the price of an auditable ledger.

---

## What the F1–F4 approval created (2026-11-03)

1. The decision is recorded in `PLAN.md` §7 as **D13** with the date, the approver, and every value. F1–F3 created
   the rule version described next; **F4 added no configuration** — it is a behaviour rule the awarding function
   implements (D14, migration 017).
2. A **new** rule version, `approved-2026-11`, was inserted by migration 016 with exactly this configuration and
   enabled:

```json
{
  "baseChange": 20,
  "strengthSensitivity": 0.02,
  "minGainPerMatch": 5,
  "maxGainPerMatch": 40,
  "minLossPerMatch": 5,
  "maxLossPerMatch": 40,
  "floor": 0,
  "tournamentMultiplier": 2,
  "rounding": "round",
  "doublesSplit": "even"
}
```

`"rounding": "round"` means half-up on the positive size of the change, applied **before** the multiplier; it matches
both `Math.round` and SQL `round()` for positive values.

3. The applied `provisional-2026-11` row was **never edited**, so every past calculation stays auditable against the
   version that produced it.
4. The approved order of operations and the doubles remainder rule were implemented in `domain/sp.ts` and in the
   friendly and tournament awarding functions, with tests proving SP is awarded **exactly once**.
5. The version is **enabled** and is the single enabled row; the unapproved proposal remains disabled.

## What F4 created

F4 adds no config and no rule version. It is a behaviour contract for the awarding and correction functions:
compensating `reversal` rows, re-award under the original rule version, and one transaction per correction. Migration
017 implements it for tournament matches through `reverse_tournament_sp()` and the superseded `correct_match_result()`.

## What is still missing

F1–F4 are approved and both the friendly and tournament awards are live. These items remain:

| # | What | Why it matters |
| --- | --- | --- |
| 1 | **Placement** | New-player placement (§7 rules 16, 20–25) is a separate gate and is not implemented. |
| 2 | **Unplayed-match SP** | Walkovers, no-shows, forfeits, disqualifications, and withdrawals have no approved SP rule. |
| 3 | **Seasonal implementation** | The rules are approved (S1–S23) and migration 012 provides the storage layer, but the scheduler, notification, recovery view, and leaderboard are unbuilt. |

## What this page does not approve

- **Placement for new players** (§7 rules 16, 20–25) — a separate gate.
- **SP for unplayed matches** — walkovers, no-shows, forfeits before play, disqualifications, and withdrawals
  (§7 rule 9; still open after F4).
- **Dispute resolution** (§7 rule 8).
- **Seasons and deductions** — the rules are approved (S1–S23) and the storage layer exists, but the scheduled job,
  notifications, recovery view, and leaderboard are unbuilt.
- **Any further code, migration, or rule change.** F1–F4 are in force; F4 created no version.

---

## Sign-off

Initial each line you approve, or write the value you prefer. F1–F3 were approved on 2026-11-03 by the club owner and
are recorded as D13; F4 was approved the same day as D14.

| # | Decision | Recommended | Your decision | Initials | Date |
| --- | --- | --- | --- | --- | --- |
| F1 | Base / sensitivity / min / max | 20 / 0.02 / 5 / 40 | **Approved** | Club owner | 2026-11-03 |
| F1 | Rounding order | Half-up, before doubling (changes tournament results by up to 1 point) | **Approved** | Club owner | 2026-11-03 |
| F1 | Tournament cap | 40 normal, 80 tournament | **Approved** | Club owner | 2026-11-03 |
| F2 | Minimum SP / ceiling | 0 / none | **Approved** | Club owner | 2026-11-03 |
| F3 | Doubles split | Even, odd point to the lower player id | **Approved** | Club owner | 2026-11-03 |
| F3 | Doubles parameters | One set for singles and doubles | **Approved** | Club owner | 2026-11-03 |
| F4 | Corrected / invalidated results | Compensating rows only; re-award under the original rule version | **Approved** | Club owner | 2026-11-03 |

**Approved by:** Club owner  **Role:** Club owner  **Date:** 2026-11-03 (F1–F4)

---

*Sources: `PLAN.md` §7.1 (parameters, worked examples, operation order, doubles), §7 rules 1, 2, and 6, and
`AGENT.md` §4.4. Where this page and those documents disagree, those documents win. Arithmetic on this page was
recomputed from the formula above; the divergence figures come from scanning every integer rating gap from −2,000 to
+2,000.*
