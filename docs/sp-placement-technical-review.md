# SP placement — technical review

**Prepared:** 2026-11-01
**Scope:** hidden placement ratings, D11 (Rated participants get no SP change), doubles, and the
permanent SP ledger — reviewed against the code and migrations, not against the proposal prose.
**Status:** review only. No code, migration, policy, rule, or test was changed.
**Method:** read `frontend/src/domain/sp.ts`, `frontend/src/domain/sp.test.ts`,
`frontend/src/features/shuttlepower/{api,leaderboard}.ts`,
`frontend/src/features/players/api.ts`, migrations 002/003/005/006/010, policies 003/006, and
`PLAN.md` §7.1–§7.2. Arithmetic claims were re-run in Node; schema claims were checked by
searching every migration for the relevant columns and tables.

---

## Verdict

The formula engine and the ledger are in better shape than the placement proposal. The placement
proposal is **not implementable as written**, for three independent reasons, and two of the
club-facing claims in the brief are **numerically wrong**.

| # | Severity | Finding | Blocks |
| --- | --- | --- | --- |
| 1 | **Blocker** | "Hidden" SP is visible to every club member and to the player, through three existing read paths | Path B |
| 2 | **Blocker** | D11 + doubles halves the Unrated player's movement and can discard the odd point | Path B |
| 3 | **Blocker** | The "two operation orders are identical at 2×" claim is false for ~25% of rating gaps | Path A and B |
| 4 | **High** | A voided match keeps its SP in the published value; D12 and "publish unchanged" contradict | Path B |
| 5 | **High** | A correction can flip the winner; there is no reversal hook, so both sides can end up paid | Path A and B |
| 6 | **High** | Two Unrated players can solve each other's hidden value from one match | Path B |
| 7 | **High** | The "placement — no SP change" marker for Rated players has no data source | Path B |
| 8 | **Medium** | No non-negative constraint; floor 0 exists only in the engine | Path A |
| 9 | **Medium** | `reconcile_sp_balances()` cannot see orphan ledger rows or a broken row chain | Path A |
| 10 | **Medium** | Odd-point tie-break uses `localeCompare`, not byte order | Path A |
| 11 | **Medium** | `rounding` and `doublesSplit` are unvalidated; a bad rule row fails with the wrong error | Path A |
| 12 | **Medium** | `Math.max(1, …)` silently overrides a configured minimum of 0 | Path A |
| 13 | **Medium** | Placement can move ±400 (±800 tournament) with no counterbalancing movement | Path B |
| 14 | **Low** | Tournament tests cannot detect the order divergence | Path A |
| 15 | **Low** | Match-score validation is weaker than D12 assumes | Path B |
| 16 | **Low** | `created_by` is nullable, so cron-written awards are unattributed | Path B |

What is solid, and should not be re-opened: the engine refuses any rule that is not approved **and**
enabled (`sp.ts:260–280`); the ledger is append-only by trigger (`002:101–107`); clients have no write
grant (`policy 003:10–12`); idempotency is a unique key (`002:73`); per-row balance is enforced
(`002:55–56`); only one rule can be enabled (`006:64–66`); an unapproved rule cannot be enabled
(`006:51–52`); and **no RPC awards match SP today** — the only ledger insert in the whole backend is
`grant_starting_sp` (`003:207`).

---

## 1. Blocker — "hidden" placement is not hidden, in three independent ways

**What the code does**

| Path | Evidence | What leaks |
| --- | --- | --- |
| Any member reads every balance | `policy 003:12` grants `select` on `sp_accounts` to `authenticated`; `policy 003:14–23` allows all four roles | The provisional number itself, for every player |
| The player reads their own ledger | `policy 003:25–36` | `sp_before`, `sp_delta`, `sp_after` — the hidden value and its history |
| The leaderboard selects and sorts by it | `frontend/src/features/shuttlepower/api.ts:43–44` | The provisional number, and its rank |
| The profile card reads it | `frontend/src/features/players/api.ts:64–76` | The provisional number on any profile |
| Own history renders it | `frontend/src/features/shuttlepower/api.ts:64–80` | Every provisional row, including `sp_before`/`sp_after` |
| Registration returns it | `frontend/src/features/auth/api.ts:70`, `003` `approve_registration` | `current_sp` in the registration outcome |

**What the plan says**

`PLAN.md:1238–1239` and `:1268` already state that hiding must be solved at the exposure layer and
that RLS cannot hide one column behind a table-wide `select` grant. That analysis is correct. The
brief, however, tells the owner "the player sees only `x / 10`" and "only staff, for audit", which
describes a capability that **does not exist**.

**Why it matters**

A UI-only hide would violate the project's own rule that hiding a control is not security. The
provisional value would be readable with one query by any member, including the player. Reverse
inference (finding 6) is therefore not the primary leak — the direct read is.

**Recommended resolution**

Pick the exposure design before approving Path B. Design 1 in `PLAN.md:1258` is the least invasive:
keep one balance that always equals the ledger sum, add a rating status, and replace direct table
reads with a view or RPC that returns only `RATED` balances. That requires:

- a successor to `policy 003` (not an edit — a new policy in a new migration);
- switching the leaderboard, the profile, the own-history screen, and the registration outcome to the
  new read model;
- deciding whether the **player** may see their own provisional number. The current promise is no, but
  the ledger is the audit record, so the honest options are "player sees progress only" (requires
  suppressing `sp_before`/`sp_after` in the player view) or "player sees their own number" (a weaker
  but defensible promise).

**Decision needed from the club:** does "hidden" include the player themselves?

---

## 2. Blocker — D11 + doubles halves the Unrated player's movement

**What the code does**

`calculateSpChange` computes a team adjustment from the team averages and splits it across **all**
participants (`sp.ts:284–325`). Under D11, Rated participants are then given no row. Filtering after
the split leaves the Unrated player with only their share.

Worked example, using the plan's own numbers (`PLAN.md:1171`): Team A = U1 (1,000) + R1 (1,200),
average 1,100; Team B = R2 (1,300) + R3 (1,500), average 1,400. A wins → team adjustment **+26** →
split **+13 / +13**. D11 then applies **+13 to U1** and **0 to R1**. The team's applied change is
**+13, not +26**.

**Consequences**

- A doubles-only Unrated player moves at **half speed** relative to an equivalent singles player.
- The same happens on a loss: U loses with a Rated partner, and the Unrated bears only half the loss.
- Odd adjustments: `+25` becomes `+13 / +12` by player-id order (`sp.ts:207–227`). If the **Rated**
  partner sorts first, the extra point is **discarded**; if the Unrated partner sorts first, they get
  it. The Unrated player's placement delta therefore depends on UUID ordering.
- Team-average strength means an Unrated paired with a strong Rated partner is rated partly by a
  partner who never moves. A weaker partner "carries" them less than the team result implies.

`PLAN.md:1171` acknowledges that "whether the Unrated participant should instead receive the whole
+26 … is not decided here". The review's point is that this is not a cosmetic open question: it
changes the rate at which doubles players qualify, and it is invisible in the brief.

**Recommended resolution**

Decide one of three, and write it into §7.1.6 and §7.2.4:

1. **Redistribute** the Rated share to the Unrated partner(s) on that side, preserving the team total.
   Cleanest for rating accuracy; needs an explicit rule for two Unrated partners (they already split
   normally) and for a side with one Unrated and one Rated.
2. **Discard** the Rated share, and state that doubles placement moves at half speed by design.
   Simplest, but creates a two-tier placement rate.
3. **Compute the team adjustment from Unrated participants only** when a side is mixed. This changes
   the approved team-average basis and should not be chosen without the club.

The odd-point rule must also be restated for the filtered case: "the extra point goes to the lowest
**Unrated** player id, or is dropped if none". The current wording sends it to the lowest id
regardless of rating.

---

## 3. Blocker — the operation-order claim is false

**What the plan says**

- `PLAN.md:767`: "Every tournament change is exactly twice the rounded friendly change."
- `PLAN.md:769`: "The shipped engine clamps, multiplies, then rounds. **At 2× these two orders produce
  identical numbers**; they diverge only for a non-integer multiplier."
- `PLAN.md:806` repeats it.
- The brief says "Half-up, on the size of the change, **before doubling**".

**What the code does**

`roundMagnitude(clamp(value) * multiplier)` — clamp, multiply, then round (`sp.ts:289–299`,
`303–313`). The proposal is `round(clamp(value)) * multiplier`.

**Arithmetic**

| Gap | Raw | Shipped: `round(raw × 2)` | Proposed: `round(raw) × 2` | Differ? |
| ---: | ---: | ---: | ---: | --- |
| 13 | 20.26 | 41 | 40 | yes |
| 25 | 20.5 | 41 | 42 | yes |
| 75 | 21.5 | 43 | 44 | yes |
| 125 | 22.5 | 45 | 46 | yes |
| 250 | 25 | 50 | 50 | no |

The divergence is **not** confined to half-points. Scanning gaps 0–2000, **500 of 2,001 gaps (25%)
differ by one point**, because `round(2x)` and `2·round(x)` disagree whenever the fractional part of
`x` is below 0.5 but `2x` crosses a rounding boundary. There is no floating-point noise in these
cases (`0.02 × 25 × 2` is exactly `1`).

**Why it matters**

The plan asks the club to approve a definition while telling them it changes nothing today. It does
change tournament numbers. The friendly numbers are identical; only tournament results differ.

**Recommended resolution**

Pick the order deliberately and correct `PLAN.md:769` and `:806` and the brief. The proposal's order
(round, then multiply) guarantees tournament changes are even and exactly 2× the friendly change,
which is easier to explain. The shipped order can produce odd tournament numbers. Whichever is
chosen, the statement must be "this changes tournament results by up to 1 point" — not "identical".

---

## 4. High — a voided match keeps its SP in the published value

**What the plan says**

- D12: an invalidated match's credit is **voided**, not deleted (`PLAN.md:1188`).
- Qualification: "Publish the accumulated SP **without resetting it** — the visible official SP equals
  the ledger sum that already existed" (`PLAN.md:1204`).

**The contradiction**

The ledger is append-only (`002:101–107`). Voiding a credit removes it from the placement **count**
but does not touch the provisional SP row. The published value is the ledger sum, so a match that was
later voided still contributes SP to the player's permanent rating.

The only way to remove it is a compensating row. `reversal` is an allowed `transaction_type`
(`002:46–53`), but nothing writes one, and no rule says it must.

**Why it matters**

A player can reach 10 credits, qualify, and keep the SP from a match that was later ruled invalid. The
brief's "publish unchanged" does not mention this.

**Recommended resolution**

Decide explicitly:

- **Option R (reverse):** invalidation writes a `reversal` row that negates the original delta, and the
  credit is voided. The published value then excludes the match. This preserves append-only history and
  is the only option consistent with "the match no longer counts".
- **Option K (keep):** the SP stands and only the count is voided. Then say so, and explain that a
  voided match can still have moved the rating.

If Option R is chosen, the reversal must be idempotent and keyed to the original row, and the
qualification transaction must handle a reversal that arrives **after** qualification.

---

## 5. High — corrections can flip the winner with no reversal

**What the code does**

`correct_match_result` deletes the games (`005:1793`), resets the match to `pending` (`005:1795–1800`),
and re-applies the new result (`005:1802`). `score_match_games` derives the winner from game wins
(`005:1545`), so a correction **can flip the winner**. There is no SP hook anywhere in this path.

**Why it matters**

Under a per-player idempotency key such as `match:<id>:<player>`, a flipped result produces:

- the old winner keeps a stale award (the ledger cannot delete it);
- the new winner can be awarded under their own key, which was never used.

Both sides then hold a win's worth of SP. D12's "a correction cannot create a second **credit**"
(`PLAN.md:1189`) covers placement credits, not SP rows.

This is prospective today because no award RPC exists, but it must be designed before one does.

**Recommended resolution**

- On correction, compare the old and new winner. If unchanged, no SP action. If changed, write
  `reversal` rows for the old winner and award rows for the new winner, all inside the same
  transaction as the correction.
- Add an idempotency key that includes the result identity, not just the match, or make the reversal
  key derive from the original transaction id.
- Test: correct a completed match, flip the winner, assert the sum of deltas for each player equals the
  new result only.

---

## 6. High — two Unrated players can solve each other's hidden value

**What the plan says**

D11 closes the Rated-opponent channel (`PLAN.md:1136–1143`): no Rated-side delta, so nothing to invert.
That argument is sound for **Rated vs Unrated**.

**What it misses**

`UNRATED vs UNRATED` is two-sided (`PLAN.md:1169`). Each player sees their own delta, and the formula
is invertible inside the clamp:

```
winner's gain d = 20 + 0.02 × (S_loser − S_winner)
⇒ S_loser = S_winner + 50 × (d − 20)
```

The loser can invert in the other direction. If the player also sees their own `sp_before` — which they
do, via `policy 003:25–36` — the opponent's hidden value follows from one match with no inference at
all.

**Why it matters**

The proposal's stated benefit is protecting a newcomer's noisy early results. Peer disclosure within
the Unrated cohort undermines that, and it is the population most likely to play each other.

**Recommended resolution**

Choose one and document it:

- accept peer disclosure within the Unrated cohort (defensible: both are hidden, both are new);
- do not write provisional rows visible to the player (suppress `sp_before`/`sp_after` in the player
  view), which also fixes part of finding 1;
- or withhold the delta from the player and show progress only.

Note that the clamp limits inversion: once `d` hits 5 or 40, the opponent's value is only bounded, not
exact. That is not a defence, because most club matches sit inside the clamp.

---

## 7. High — the Rated-side "placement" marker has no data source

**What the plan says**

- The match "Must identify that the match involved placement" (`PLAN.md:1113`).
- "A Rated participant's history can then show 'placement — no SP change' from that record instead of a
  fabricated ledger row" (`PLAN.md:1248`).

**What exists**

Nothing. Searching every migration for `unrated`, `placement`, `rating_status`, or `qualif` returns no
matches. `players` has registration `status` only; `matches` and `friendly_matches` have no placement
flag; `sp_accounts` has `current_sp` only. There is no placement-credit table and no qualification
record.

**Why it matters**

The requirement is currently unimplementable, and the Rated player's history would show a completed
match with no explanation. This is a display gap, not a rating error, but it is a stated requirement
with zero backing.

**Recommended resolution**

The placement-credit row proposed in `PLAN.md:1266` — keyed by `(source, match_id, player_id)` — is the
right marker. Write a credit for the **Unrated** participant and let the Rated participant's history
join through the match. If a per-Rated-player marker is wanted, it needs its own row or a match-level
flag; do not fabricate a zero-delta ledger row (`002:57–58` forbids it anyway).

---

## 8. Medium — no non-negative constraint on balances or ledger rows

`sp_accounts.current_sp` and the ledger columns are plain `integer` with no `>= 0` check
(`002:16–21`, `002:30–74`). The 0 floor exists only in the engine (`sp.ts:230–252`) and is `null` in
both the shipped config (`sp.ts:70`) and the provisional row (`006:75–78`). A privileged write or a
future RPC bug can therefore persist a negative rating, and the leaderboard would display it.

**Recommendation:** if the club approves a 0 floor, enforce it in the schema (`check (current_sp >= 0)`,
`check (sp_before >= 0)`, `check (sp_after >= 0)`) in the same migration that adds the award RPC.
Keep the engine clamp as the user-facing behaviour.

---

## 9. Medium — reconciliation is narrower than it looks

`reconcile_sp_balances()` (`006`) builds its ledger CTE **from `sp_accounts`** and left-joins
transactions. Therefore:

- a ledger row for a player with no `sp_accounts` row is never examined;
- `checked` counts accounts, not ledger rows;
- it compares only the **sum** of deltas to the cached balance; it does not verify that each row's
  `sp_before` equals the previous row's `sp_after`. A ledger with a broken chain but a matching total
  passes.

**Recommendation:** for placement, add a check that every ledger row has an account, and consider a
window-function continuity check. This matters more once provisional rows exist, because the plan's
whole hiding argument depends on "cache equals ledger sum" (`PLAN.md:1238`).

---

## 10. Medium — `localeCompare` is not byte order

`distributeEqually` sorts ids with `localeCompare` (`sp.ts:216`). The documented rule is "lowest player
id". `localeCompare` is locale- and ICU-dependent; it can order non-hex or uppercase strings
differently from byte order, and it does not match Postgres `uuid` ordering. UUIDs are normally
lowercase hex, so the risk is latent today, but the rule should not depend on the runtime's collation.

The test only uses `'a'`, `'b'`, `'c'` (`sp.test.ts:281–295`), so it cannot catch this.

**Recommendation:** replace with `left < right ? -1 : left > right ? 1 : 0` and add a test with
mixed-case or non-hex ids.

---

## 11. Medium — unvalidated `rounding` and `doublesSplit`

`assertConfig` (`sp.ts:135–169`) checks the numeric fields, sensitivity sign, cap ordering, multiplier,
and floor. It does **not** check `rounding` or `doublesSplit`. `roundMagnitude` has no `default`
(`sp.ts:175–184`), so an unknown value returns `undefined`, `Math.max(1, undefined)` is `NaN`, and the
failure surfaces as "A team change must be a whole number of points" (`sp.ts:212`) — the wrong error.

The database only checks that `config` is a JSON object (`006:45–46`), so a bad rule row is reachable.

**Recommendation:** validate both fields in `assertConfig`, and add a `default` that throws. Also
validate them at the rule-creation boundary, or add a CHECK for the known keys.

---

## 12. Medium — `Math.max(1, …)` overrides a configured minimum

`gain` and `loss` are wrapped in `Math.max(1, …)` after rounding (`sp.ts:289–299`, `303–313`). If the
club ever approves `minGainPerMatch: 0`, a sub-0.5 result still becomes 1, and the config is silently
disobeyed. It also makes the true minimum unconfigurable.

**Recommendation:** either drop the wrapper and let the configured minimum govern, or make the
absolute floor an explicit config key and document it. With the proposed minimum of 5 the wrapper is
inert, so this is a latent inconsistency rather than a live bug.

---

## 13. Medium — placement drift has no counterweight

Ten matches at 5–40 (10–80 tournament) can move a newcomer by **±400 normal / ±800 tournament**
(`PLAN.md:766`, `:811`). During those matches every Rated opponent is frozen by D11, so the system is
deliberately not zero-sum. `PLAN.md:1149` calls the asymmetry "temporary", but the value published at
qualification is **permanent**, and no other player's rating moved to offset it.

Combined with finding 2, doubles-heavy newcomers move at half speed, so the same 10 matches can produce
very different placement outcomes depending on format mix.

**Recommendation:** this is a club decision, not a bug. Present it as: "a newcomer can enter the
leaderboard up to 400 points from 1,000, and no one else's rating adjusts." If that is unacceptable,
the alternatives are a narrower placement band, a smaller per-match cap during placement, or a
counterbalancing adjustment to opponents — the last contradicts D11 and should not be adopted
casually.

---

## 14. Low — tests cannot detect the order divergence

The tournament test asserts `tournament == friendly × 2` (`sp.test.ts:101–119`) using an integer
friendly value, so it passes under both orders. There is no fractional tournament case, no
locale-order case, no D11-filtering case, no correction/reversal case, and no hidden-read case.

**Recommendation:** add tests for a fractional clamped value (for example sensitivity `0.02`, gap 25),
mixed-case ids, a mixed Rated/Unrated doubles side, a flipped correction, a void after qualification,
and a denied read of a provisional balance.

---

## 15. Low — match-score validation is weaker than D12 assumes

`score_match_games` (`005:1474–1548`) requires at least one game, non-negative integers, no level game,
and an overall winner. It does **not** cap the number of games, cap points, enforce win-by-2, or require
a best-of format. A 1–0 "match" is valid.

D12 says a credit may be written only after "validation has passed" (`PLAN.md:1185`). Today that
validation is thin, so a placement match can be a one-game formality. This is a policy gap, not a
placement-specific bug, but it weakens the integrity story.

**Recommendation:** decide the minimum acceptable result shape for a placement-eligible match
(for example, best-of-three with a recognised scoring rule), and enforce it before a credit is written.

---

## 16. Low — `created_by` is nullable

`sp_transactions.created_by` references `profiles` and is nullable (`002:42`). `grant_starting_sp`
sets `auth.uid()` (`003`), but an award written by `pg_cron` (auto-approval, `010`) has no
`auth.uid()` and would be unattributed.

**Recommendation:** require an actor for match awards, or record a service identity in `metadata` when
the caller is a job.

---

## Cross-cutting matrix: the four topics the review was asked about

| Topic | Current state | Blocking issue |
| --- | --- | --- |
| **Hidden placement** | No schema, no status, no credit table, no qualification record. The value is readable by every member and by the player. | Findings 1, 6, 7 |
| **D11** | Not implemented. The rule is approved as policy only. The engine has no rating status, so it cannot filter Rated participants. | Findings 2, 4, 5 |
| **Doubles** | Team average and even split exist (`sp.ts:187–227`). No Rated filtering, no odd-point rule for the filtered case. | Finding 2 |
| **Permanent ledger** | Append-only, idempotent, per-row balance check, no write grant. No non-negative check, no reversal path, no source-named reference, narrow reconciliation. | Findings 4, 5, 8, 9 |

---

## Minimum change set if Path B is approved

1. **Migration 011** — rating status, placement credits keyed by `(source, match_id, player_id)` with
   `voided_at`, a qualification record, a non-negative check, and a source-named reference type.
   Never edit 001–010.
2. **Policy successor** — replace the club-wide `sp_accounts` read and the own-ledger read with a
   view/RPC that returns only published balances, and decide what the player may see.
3. **Award RPC** — per-player idempotency, D11 filtering, the chosen doubles distribution, and reversal
   on correction or invalidation, all inside the match-finalization transaction.
4. **Read paths** — leaderboard, profile, own history, and the registration outcome switch to the new
   model.
5. **Engine** — validate `rounding`/`doublesSplit`, byte-order sort, the approved operation order, and
   the `Math.max(1, …)` decision.
6. **Tests** — the cases in finding 14.

If Path A is chosen, findings 1, 2, 4, 6, 7, and 13 fall away, but 3, 5, 8–12 still apply before an
award RPC can ship.

---

## What to correct in the plan and the brief now

| Document | Line | Current | Correction |
| --- | --- | --- | --- |
| `PLAN.md` | 769 | "At 2× these two orders produce identical numbers" | False. They differ for ~25% of gaps; give the gap-13 and gap-25 examples. |
| `PLAN.md` | 806 | "With the integer 2× multiplier the numbers are identical today" | Same correction. |
| `PLAN.md` | 767 | "Every tournament change is exactly twice the rounded friendly change" | True only under the proposed order, not the shipped one. |
| `docs/shuttlepower-decision-brief.md` | Rounding row | "Half-up, before doubling" with no caveat | Add: "this changes tournament results by up to 1 point versus today's engine". |
| `docs/shuttlepower-decision-brief.md` | Doubles section | "A doubles match then moves the same combined total as an equivalent singles match" | False under D11. Add the half-speed consequence. |
| `docs/shuttlepower-decision-brief.md` | Hidden-number row | "Only staff, for audit; the player sees only `x / 10`" | Not true today. Mark it as a required policy and read-path change. |
| `PLAN.md` | §7.1.6 / §7.2.4 | Odd point to "lowest player id" | Specify the filtered case: lowest **Unrated** id, or dropped. |
| `PLAN.md` | §7.2.5 rule 4 / :1204 | Void the credit; publish the ledger sum unchanged | Contradiction. Choose reversal or keep, and say which. |

---

*This review changes no code, migration, policy, rule, or test. It is a record of what the current
implementation does, not an approval of any proposal.*
