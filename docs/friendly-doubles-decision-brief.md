# Friendly doubles — club decision brief

**For:** Matag-ob Badminton Club

**Prepared:** 2026-11-04

**Status:** **APPROVED 2026-11-04 by the club owner as D20** (§7 rule 7). The chosen rule is **Option B**: both
losing partners may approve or dispute; the result becomes official when both approve, or at the 24-hour deadline if
neither disputes; a dispute by either partner freezes the result. Friendly doubles may be **any pairing** (D10 stays a
tournament-only rule), and all five follow-on defaults were accepted. The rule is recorded in `PLAN.md` §7.5 and
implemented in migration 020. This page is retained as the owner-facing record of what was decided.

**Read time:** about 4 minutes.

---

## Why you are being asked

The app records singles friendly matches today. The losing player approves or disputes the result, and if they do
nothing for **24 hours** the result is automatically approved. The winner submits; the winner can never approve their
own result.

Doubles has **two losing players**, so the singles rule does not say who must approve. The database and UI are
deliberately waiting for your answer. No doubles friendly can be recorded until you choose.

This is a **club rule, not an engineering choice**. The developer will not pick one silently.

## Already decided — please do not re-decide these

| Rule | Value | Where it came from |
| --- | --- | --- |
| Who submits a result | A member of the **winning** side | Existing singles workflow |
| Who may approve or dispute | Only the **losing** side; never the winner | Existing singles workflow |
| Silence for 24 hours | The result is **automatically approved** by the server | Existing singles workflow |
| Doubles SP split | Team adjustment split **equally**; an odd point goes to the lower player id | D13, approved 2026-11-03 |
| Unrated partner's share | The Unrated player receives **their own share only**; a Rated partner's share is not applied to them | D19, approved 2026-11-04 |
| Rated player in a placement match | **No SP change** at all for the Rated participant | D11, approved 2026-11-01 |
| Which matches count toward placement | Only matches actually played and finalized | D12, approved 2026-11-01 |
| Dispute resolution | Not yet specified | §7 rule 8, still open |

## The question: who on the losing side must approve?

### Option A — One losing partner is enough

The first losing partner to approve confirms the result. The other partner has no separate approval step; their only
recourse is the general dispute process after the result is official.

- **Good:** fastest, simplest, matches the singles habit.
- **Risk:** one partner can confirm a result the other partner believes is wrong, before the other even sees it.

### Option B — Both partners must approve, with the 24-hour fallback (recommended)

Each losing partner can approve or dispute. The result becomes official when **both approve**, or when the 24-hour
deadline passes with **no dispute** from either. A dispute from either partner freezes the result.

- **Good:** either partner can object, and a silent partner cannot stall a match forever.
- **Cost:** one extra approval state to track; slightly slower than A when both are online.
- **Why recommended:** it keeps the fairness of "both must approve" without breaking the club's existing 24-hour
  safety valve. In practice, a partner who does not care simply stays silent and the result confirms on schedule.

### Option C — Both partners must approve strictly

The result stays pending until both losing partners explicitly approve. Silence never confirms it.

- **Good:** strongest protection for the losing side.
- **Risk:** an inactive or unreachable partner can freeze a valid result indefinitely. This contradicts the 24-hour
  auto-approval already approved for singles.

## Follow-on defaults to confirm with the same answer

These are not new club rules in dispute; they are the practical details the build needs. The recommendation is shown
first. Say "accept defaults" if they are fine.

1. **Team formation.** The challenger names a partner when creating the challenge; the challenged player names a
   partner when accepting. A challenge cannot be accepted without a complete opposing pair. *(Recommended.)*
2. **One open match per team pair.** The existing "one open match per pair" rule extends to the two teams, so the same
   four players cannot have two open friendlies against each other at once.
3. **Who submits.** Either member of the winning team may submit, once, on behalf of the team. The other winning
   partner does not need to re-confirm the submission.
4. **Placement credit.** A confirmed doubles friendly gives **one placement credit to each of the four players** who
   actually played, subject to D11/D12/D19. *(Recommended.)*
5. **Disputes.** A dispute by **either** losing partner marks the whole result disputed and stops SP and placement
   credit until §7 rule 8 is decided.

## One separate question: mixed-gender pairings

D10 currently says a **Mixed Doubles** tournament team must be one male and one female. It was written for tournaments
and does not yet say whether friendly doubles must follow it.

- **Option 1 (recommended):** friendly doubles may be any pairing — men's, women's, or mixed. D10 stays a tournament
  rule.
- **Option 2:** every friendly doubles team must be one male and one female.
- **Option 3:** friendly doubles must be same-gender (men's or women's only); mixed friendlies are not allowed.

## What happens after you answer

1. The choice is recorded in `PLAN.md` as a new decision with the approval date and rule version.
2. A new migration extends `friendly_matches` for teams and per-partner approval, with a new policy and tests. Migrations
   010 and 011 are not edited.
3. The `/matches` screen gains a doubles challenge flow and team-aware approval.
4. Doubles friendlies then award SP under D13 and count toward placement under D11/D12/D19.
5. Dispute resolution (§7 rule 8) is decided separately before any disputed doubles result can be resolved.

**Nothing is built until you choose.** Reply with **A**, **B**, or **C** for the approval rule, confirm or change the
five defaults, and choose **1**, **2**, or **3** for mixed-gender pairings.
