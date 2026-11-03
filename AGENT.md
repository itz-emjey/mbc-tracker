# MBC Arena --- Agent Project Guide

> **Project:** MBC Arena\
> **Organization:** Matag-ob Badminton Club\
> **Product type:** Club management and badminton competition platform\
> **Primary competitive feature:** ShuttlePower (SP)\
> **Document purpose:** Product requirements, architecture guidance,
> business rules, and implementation instructions for AI coding agents.

------------------------------------------------------------------------

## 1. Mission and product vision

Build **MBC Arena**, a practical, reliable, mobile-friendly web
application for Matag-ob Badminton Club. The club is small, so the
system must be easy to operate, affordable to host, and maintainable by
a student developer.

MBC Arena brings together:

1.  Club member accounts and role management.
2.  Tournament creation, registration, bracket generation, and match
    results.
3.  ShuttlePower competitive points, seasonal rankings, and achievement
    archives.
4.  Friendly singles and doubles challenges.
5.  Training attendance and monthly payment tracking.
6.  Jersey projects, player orders, polls, and club announcements.

Do not treat this as only a dashboard or a bracket generator. The core
value is that player records, matches, SP, training, and club activities
work together consistently.

### Product principles

-   Free-first: use free tiers and open-source tools where practical.
-   Mobile-first: players will commonly use phones.
-   Simple for a small club: avoid enterprise-level complexity.
-   Accurate records: financial records, match results, and SP history
    must be auditable.
-   Secure by default: users must only access data and actions permitted
    by their roles.
-   No fake functionality: do not create buttons or screens that appear
    functional but do not persist real data.
-   Explainable ranking: every SP change must have a recorded reason and
    calculation.
-   Preserve history: never erase completed seasons, matches, payment
    records, or tournament results as part of routine resets.

------------------------------------------------------------------------

## 2. Technology direction

Preferred initial stack:

  Layer              Preferred technology
  ------------------ --------------------------------------------------
  Frontend           React + TypeScript + Vite
  Styling            Tailwind CSS
  UI components      shadcn/ui where appropriate
  Backend platform   Supabase
  Database           Supabase PostgreSQL
  Authentication     Supabase Auth
  File storage       Supabase Storage
  Realtime           Supabase Realtime only where useful
  Hosting            Vercel or another suitable free-tier static host
  Source control     Git + GitHub

### Free-first requirements

-   Start with free tiers. Do not add paid services, paid APIs, or paid
    libraries without explicit approval.
-   Check current provider limits before relying on a feature.
-   Do not promise that a free tier is unlimited or permanently free.
-   Keep secrets and Supabase service-role keys out of frontend code and
    Git.
-   Use environment variables and provide a `.env.example` containing
    placeholders only.
-   Do not add an external payment gateway in the first version.
    Trainers record payments manually.
-   Avoid unnecessary AI APIs, analytics services, and third-party
    dependencies.

### Supabase implementation rules

-   Use PostgreSQL foreign keys, constraints, indexes, and transactions
    where appropriate.
-   Use Supabase Auth for identity. Keep application roles and player
    profiles in application tables.
-   Enable Row Level Security (RLS) on every exposed table.
-   Never trust a role, player ID, SP amount, match result, or payment
    status supplied by the browser without server-side authorization and
    validation.
-   Use SQL migrations committed to the repository. Do not rely on
    undocumented manual dashboard edits.
-   Put privileged operations in PostgreSQL functions/RPCs or trusted
    server-side code.
-   Never expose the Supabase service-role key to the browser.
-   Keep SP calculations server-side and atomic.
-   Use database constraints to prevent duplicate registrations,
    duplicate approvals, and repeated SP awards.

If the repository already uses a different stack, inspect it first and
report the implications before replacing technologies. Do not rewrite a
working project simply to match this preferred stack.

------------------------------------------------------------------------

## 3. User roles, accounts, and permissions

A single account may have **multiple roles**.

Initial roles:

-   **Super Admin:** full system configuration and access.
-   **Tournament Manager:** create and manage tournaments, participants,
    draws, brackets, and tournament results.
-   **Trainer:** manage training sessions, attendance, monthly payments,
    jersey projects, polls, and announcements.
-   **Player:** manage permitted personal information, view records,
    join tournaments, challenge players, approve match results, vote,
    and submit jersey orders.

### Registration and player records

-   Anyone may submit an account registration request.
-   A new account must be approved before receiving normal club-player
    access.
-   Registration approval should be performed by an authorized Super
    Admin.
-   A person may have a player record before creating an account.
-   Managers must be able to add a player record without requiring an
    account.
-   An authorized admin can link an existing player record to an
    approved account.
-   Prevent one player record from being linked to multiple accounts.
-   Support account suspension/deactivation without deleting historical
    player records.
-   A person with multiple roles must be able to access all permitted
    modules without needing separate accounts.

### Authorization expectations

-   Super Admin: all modules and administrative settings.
-   Tournament Manager: tournament-related actions only, unless also
    assigned another role.
-   Trainer: training, payment, attendance, jersey, poll, and
    announcement actions only, unless also assigned another role.
-   Player: own profile and personal records; public club data;
    permitted match, tournament, poll, and order actions.
-   A player must not be able to grant themselves roles, approve their
    own registration, alter SP, alter another player's payment record,
    or edit an official result outside the defined match workflow.

Implement permissions in both UI and database/server authorization.
Hiding a button is not security.

------------------------------------------------------------------------

## 4. Main modules

### 4.1 Player directory and profiles

Each player profile should support, as appropriate:

-   Full name and profile photo/avatar.
-   Account link (optional).
-   Contact details, with privacy-conscious access.
-   Player status (active, inactive, suspended, etc.).
-   Date joined.
-   Playing categories or preferred discipline, if the club chooses to
    collect them.
-   Current SP and seasonal SP.
-   Match history and tournament history.
-   Training attendance and payment history visible to the player
    themselves.
-   Jersey orders and poll participation where relevant.

Do not expose private contact details to all club members by default.

### 4.2 Tournament management

Tournament Managers can:

-   Create, edit, publish, close, and archive tournaments.
-   Set title, description, dates, registration deadline, venue, and
    status.
-   Choose event category:
    -   Singles
    -   Men's Doubles
    -   Women's Doubles
    -   Mixed Doubles
-   Choose format:
    -   Single Elimination
    -   Double Elimination
    -   Round Robin
-   Set maximum participants or teams.
-   Register players from existing club player records.
-   Add external/non-account participants as player records or
    tournament-only participants, while avoiding accidental duplicate
    people.
-   Create and manage doubles pairs.
-   Randomize seeds or manually assign seeds.
-   Generate brackets/draws.
-   Manually edit generated brackets with validation and a clear audit
    trail.
-   Enter match scores and finalize tournament match results.
-   View standings, winners, and tournament history.

#### Tournament rules

-   A tournament event must have one defined discipline and one defined
    format.
-   Singles entries contain one player. Doubles entries contain two
    players.
-   Mixed Doubles pairs must satisfy the club's configured pairing rule.
    Do not assume gender data or enforce a rule until the club confirms
    how it wants this represented.
-   Prevent a player from being registered twice in the same event
    unless the tournament explicitly allows it.
-   Respect the event's participant/team cap.
-   Validate that seeds are unique within an event.
-   Bracket generation must handle non-power-of-two entry counts using
    byes.
-   A bye must not create a played match or award match SP.
-   Automatically advance a winner after a match result is finalized.
-   Manual bracket edits must not silently invalidate completed matches
    or historical SP transactions. Require confirmation and define a
    safe correction workflow.
-   Completed tournament results must be preserved.
-   Round Robin standings must be calculated from recorded match
    results, not manually typed totals.

#### Round Robin standings

Store enough match data to calculate standings. At minimum show:

-   Played
-   Wins
-   Losses
-   Matches/sets won and lost, if set scores are recorded
-   Points/score difference, if the club adopts that tie-breaker
-   Ranking/position

**Tie-break policy is not yet confirmed.** Make tie-break rules
configurable or clearly isolate them in one function. Do not invent a
permanent tie-break order. Provide a sensible provisional display, but
mark the actual policy as awaiting club confirmation.

#### Bracket integrity

Use a clear data model for events, entries/teams, rounds, matches,
participants, and match results. Do not model a bracket only as visual
lines or nested frontend arrays. The database must be the source of
truth.

The UI should support a readable bracket on desktop and mobile. On small
screens, allow horizontal scrolling or a round-by-round view.

### 4.3 ShuttlePower (SP)

ShuttlePower is MBC Arena's club-specific competitive point system. It
is **not ELO**. Do not implement an ELO rating or describe SP as ELO.

Confirmed rules:

-   A newly registered player starts with **1,000 SP**.
-   SP changes automatically based on eligible match results.
-   Players cannot manually edit their SP.
-   Managers cannot manually adjust SP.
-   Every SP change must be recorded in an immutable transaction/history
    record.
-   Official tournament matches use **2x the normal SP impact**, for
    both wins and losses.
-   Friendly matches use the normal SP impact.
-   The SP calculation is strength-based: beating a stronger opponent
    should award more than beating a similarly rated or weaker opponent;
    losing to a stronger opponent should cost less than losing to a
    weaker opponent.
-   For doubles, calculate the team's strength using the average SP of
    its two players, then distribute the calculated change to the
    individual players. The exact distribution/rounding rule must be
    deterministic and documented.
-   Seasonal rankings run in **12-month seasons** following the calendar
    year (January 1 through December 31), with every boundary evaluated in
    `Asia/Manila` (UTC+8).
-   At season end, current SP is **not reset to zero**; it carries over.
    **Seasonal SP** resets to zero, and a rank-based deduction is applied to
    **current SP only**, with higher-ranked players losing more points.
-   Previous seasons remain available as an **immutable archive** of final
    positions and seasonal SP, never recalculated.
-   Seasonal deduction must not delete or rewrite historical match
    transactions.
-   **The match-SP formula is approved (D13, 2026-11-03).** The club owner
    approved: base **20**, strength sensitivity **0.02** (1 point per 50 SP
    of gap), per-match clamp **5–40** on the magnitude, **half-up** rounding
    applied **before** the multiplier, tournament **×2**, floor **0**, no
    ceiling, and an **even** doubles split with the odd point to the lower
    player id. It is recorded as the enabled `approved-2026-11` rule version
    in migration 016. Confirmed friendlies and completed tournament matches
    now award SP, and F4 (D14, migration 017) adds compensating reversals so a
    corrected tournament result re-awards under the original rule version.

> **Reconciliation (2026-11-02).** These bullets now reflect the approved
> decisions S1–S23 in `PLAN.md` §7.3. Superseded drafts: three-month seasons
> (now S2), deduction tiers left as percentages (now fixed amounts, S8), and
> the open question of which balance a deduction reduces (now current SP only,
> S1 and S8).

#### SP items that remain to be finalized

The match-SP formula is **approved** (D13, `PLAN.md` §7.1,
`docs/sp-formula-signoff.md` F1–F3) and the enabled `approved-2026-11` rule
awards confirmed friendlies and completed tournament matches. F4 (D14,
migration 017) adds the compensating reversals. Do not change its values
without a new recorded approval and a new rule version; never edit the applied
`provisional-2026-11` or `approved-2026-11` rows.

Still open:

1.  **Walkover, withdrawal, disqualification, and forfeit SP treatment.**
    Placement eligibility is approved (D12), but unplayed-match SP is
    unapproved.
2.  **The near-zero doubles floor interaction.** If one partner is clamped at
    0, whether the other partner's share is reduced is still open
    (`PLAN.md` §7.1.5 #18).
3.  **Placement implementation.** The 10-match system, initial provisional
    value, visibility, qualification, and the D11 Unrated-share question are
    still unapproved.
4.  **Seasonal implementation.** The business rules are approved (S1–S23,
    `PLAN.md` §7.3); the scheduler, notifications, recovery view, leaderboard,
    and award integration are unbuilt.

Decided and no longer open: the friendly and tournament formula and curve
(D13), the per-match minimum and maximum (D13), whether SP can go below zero
(D13: no, floor 0), the seasonal deduction amounts (S8: fixed 40 / 30 / 20 / 10
by fixed position), the seasonal rank basis (S8, S10–S12), the deduction target
(S1 and S8: current SP only), the doubles split and rounding (D13: even split,
lower-id odd point, half-up before the multiplier), and corrected/invalidated
results (D14: compensating rows only, re-award under the original version).

Recommended separation of values:

-   **Current SP:** persistent competitive rating used to compare player
    strength. It carries over between seasons and is the balance a seasonal
    deduction reduces.
-   **Seasonal SP:** net actual SP gained and lost from eligible finalized
    matches during the current season. It resets to zero each season, may
    become negative, and drives the seasonal ranking; a deduction never
    changes it.
-   **Season archive:** immutable per-player snapshot of the final seasonal
    position, seasonal SP, current SP at the cutoff, matches played, wins,
    and the rule version used, with a reason code for any player excluded
    from the ranking; achievements are limited to placement facts.

This separation is **approved** as club rules (S1, S8, and S19 in `PLAN.md`
§7.3); the earlier note that it was "a recommended design, not a confirmed
club rule" is superseded.

#### SP ledger

Every SP transaction should include:

-   Player ID.
-   Match ID or season event reference.
-   Transaction type (friendly win/loss, tournament win/loss, seasonal
    deduction, correction/reversal).
-   SP before.
-   SP delta (+/-).
-   SP after.
-   Calculation/rule version.
-   Timestamp.
-   Related opponent/team where applicable.
-   Status and idempotency key.

Do not provide a general-purpose manual SP editing interface. If a
genuine data correction is needed, use a restricted, audited
reversal/correction workflow that does not erase the original
transaction. This is for data integrity, not discretionary point
adjustment.

### 4.4 Friendly challenges and matches

Players can challenge any eligible club player.

Support:

-   Singles challenges.
-   Doubles challenges.
-   Challenge invitation and acceptance/decline.
-   Match status: pending, accepted, result submitted, disputed,
    confirmed, auto-approved, cancelled.
-   Match score submission.
-   Opponent approval.
-   SP calculation after the result becomes official.
-   Match history for both sides.

#### Result approval workflow (confirmed)

1.  Players arrange and play the match.
2.  The **winner submits the match score/result**.
3.  The losing player receives a notification and can approve or dispute
    the submitted result.
4.  If the losing player approves, the result becomes official.
5.  If the losing player takes no action within **24 hours after
    submission**, the result is automatically approved.
6.  Once official, the system calculates and records SP changes exactly
    once.

Important implementation details:

-   Store the submission timestamp and a server-calculated approval
    deadline.
-   The 24-hour deadline must be enforced by trusted backend/database
    logic, not the player's device clock.
-   Do not rely only on a browser timer. Use a scheduled server-side
    job/cron or a database-backed process to find expired pending
    approvals.
-   Notify the losing player when a result is submitted and before/at
    the deadline where notification infrastructure exists.
-   Allow the losing player to dispute before the deadline. A disputed
    result must not receive SP until resolved.
-   The dispute resolution process is **not yet specified**. Provide a
    clear status and an admin resolution path, but do not silently
    invent a complex appeals policy.
-   Prevent the winner from approving their own result.
-   Prevent duplicate score submissions from generating duplicate SP.
-   If a match is doubles, require the losing side's designated
    player(s) to approve according to a clearly documented rule. The
    club has not yet specified whether one losing partner or both
    partners must approve; make this configurable and flag it for
    confirmation.
-   Validate scores against the chosen scoring format. Do not assume a
    score is valid solely because it is numeric.
-   If the match is disputed, keep the submitted score and audit
    history.

### 4.5 Training management

Trainers can:

-   Create training sessions.
-   Set session date, time, venue, notes, and attendance status.
-   Record player attendance.
-   View attendance history.
-   Set or record monthly training fees.
-   Record payment amount, payment date, covered month, payment
    method/reference, and notes.
-   Track paid, unpaid, and partially paid status.
-   View a player's payment history.

Players can:

-   View their own attendance history.
-   View their own monthly payment records and payment status.

Payment tracking is a manual recordkeeping feature in the first version.
Do not integrate a payment gateway unless explicitly requested.

Financial integrity:

-   Do not silently overwrite or delete a recorded payment.
-   Use an audited correction/void process.
-   Store who recorded or changed a payment.
-   Restrict financial records to trainers and authorized admins;
    players can view only their own records.
-   Do not expose one player's payment status to other players.

### 4.6 Jerseys and orders

Trainers can create a jersey project containing:

-   Project name and description.
-   Design images/mockups.
-   Available sizes.
-   Price, if applicable.
-   Order deadline.
-   Status (draft, open, closed, completed/cancelled).
-   Optional quantity or stock limits.

Players can:

-   View jersey designs.
-   Vote in design polls where enabled.
-   Select a design and size.
-   Submit or update an order before the deadline.
-   View their own order status.

Trainers can view and manage orders and export a useful order list.
Prevent duplicate active orders for the same player/project unless the
project explicitly allows multiple orders.

### 4.7 Polls and announcements

Trainers can create polls for jersey designs and other club matters.

Poll features:

-   Question and description.
-   Single-choice or multiple-choice configuration.
-   Start and end time.
-   Optional anonymous voting.
-   Results visibility setting.
-   One response per eligible player where configured.
-   Prevent votes after closing.
-   Prevent duplicate votes.

Announcements:

-   Title, body, optional image, author, published date, and status.
-   Players can view published announcements.
-   Only authorized roles can create, edit, publish, or archive them.

------------------------------------------------------------------------

## 5. Suggested database model

This is a starting schema guide. Inspect and refine it before
implementation. Use normalized relational tables and appropriate foreign
keys rather than putting the entire application in one JSON column.

Suggested tables:

### Identity and roles

-   `profiles`: account profile, linked auth user.
-   `players`: club player record, account link nullable.
-   `roles`: role definitions.
-   `user_roles`: many-to-many account-role assignments.
-   `registration_requests`: pending account registration/approval
    records.

### Tournaments

-   `tournaments`: tournament metadata and status.
-   `tournament_events`: event/disciplines and format within a
    tournament.
-   `tournament_entries`: player or team entry in an event.
-   `teams`: doubles team records.
-   `team_members`: players belonging to a team.
-   `bracket_rounds`: rounds for elimination formats.
-   `matches`: match metadata, participants, format, status, and event
    relationship.
-   `match_games` or `match_sets`: per-game/set scores when needed.
-   `match_result_submissions`: submitted scores, submitter, deadline,
    and approval/dispute state.
-   `tournament_standings`: optional cached standings; source results
    remain authoritative.

### ShuttlePower

-   `sp_accounts` or SP fields on player profiles: current and seasonal
    totals, if justified.
-   `sp_transactions`: immutable ledger of all point changes.
-   `sp_rule_versions`: calculation settings/version history.
-   `seasons`: start/end dates and status (12-month calendar seasons in
    `Asia/Manila`, S2).
-   `season_player_results`: immutable final seasonal snapshots, with a
    reason code for any player excluded from the ranking (S19).
-   `season_deductions`: deduction batches and their approved rows, each
    linked to its originating season and applied exactly once (S8, S9).
-   `season_transition_steps`: one checkpoint per season and step, so a
    retried transition is a no-op (S20).

### Training and payments

-   `training_sessions`.
-   `training_attendance`.
-   `training_fee_settings` or `training_fee_periods`.
-   `training_payments`.

### Jerseys, polls, announcements

-   `jersey_projects`.
-   `jersey_designs`.
-   `jersey_sizes` or project size options.
-   `jersey_orders`.
-   `polls`.
-   `poll_options`.
-   `poll_votes`.
-   `announcements`.
-   `notifications` (if in-app notifications are implemented).

### General audit and operations

-   `audit_logs` for sensitive administrative actions.
-   `scheduled_jobs` or a reliable scheduled-task mechanism, if required
    by implementation.
-   `app_settings` for club-controlled configuration.

Use UUID primary keys unless there is a strong reason not to. Add
`created_at` and `updated_at` where appropriate. Use database
constraints for unique relationships and valid states.

Do not duplicate the same authoritative value in multiple tables without
a clear reason. If totals are cached for performance, the transaction
ledger remains the source of truth and reconciliation must be possible.

------------------------------------------------------------------------

## 6. Important workflows

### New account registration

1.  Visitor submits registration.
2.  System validates fields and creates a pending registration
    request/account state.
3.  Super Admin reviews and approves or rejects.
4.  On approval, the account is assigned the appropriate role(s) and
    linked to an existing player record or a new player record.
5.  New player receives 1,000 starting SP exactly once.
6.  Record the initial SP transaction.

Do not award starting SP every time a profile is edited or an account
logs in.

### Tournament match finalization

1.  Match is generated or scheduled.
2.  Authorized manager records the score/result.
3.  Validate match participants, event, and score.
4.  Finalize the result.
5.  Advance winner if the format requires it.
6.  Recalculate standings if Round Robin.
7.  Generate SP transactions at 2x normal match impact.
8.  Mark the SP award as processed using an idempotency key.
9.  Preserve result and audit history.

A tournament manager's entry of an official tournament result is
distinct from the friendly challenge approval workflow.

### Friendly match finalization

Follow the 24-hour winner-submits / loser-approves-or-disputes workflow
in Section 4.4. Apply normal SP impact only after approval or trusted
auto-approval. Ensure exactly-once SP processing.

### Season transition

1.  Identify the season end using `Asia/Manila` (December 31,
    11:59:59 PM).
2.  Freeze and snapshot final seasonal rankings in the same transaction as
    the close, with one immutable snapshot per player (S19).
3.  Create achievement archive records (placement facts only in v1).
4.  Generate the previous season's deduction batch from the approved fixed
    tiers. Do not apply it here: a Super Admin must approve or reject the
    batch, and approval applies it to the latest current SP balance, capped
    at the available amount (S9).
5.  Record each deduction in the SP ledger, linked to its originating
    season.
6.  Start the next season and reset seasonal SP to zero, preserving current
    SP.
7.  Do not erase match history or previous seasonal archives.

The transition is automatic, at 00:05 `Asia/Manila` on January 1: each step
is idempotent with a recorded checkpoint, a failed step is retried, and a
Super Admin is notified after repeated failure. A pending deduction batch
must never block the next season (S3, S4, S20).

------------------------------------------------------------------------

## 7. UI/UX direction

Create a polished, modern sports-club platform. It should feel like a
real badminton club product, not a generic admin template.

### Visual direction

-   Clean, modern, energetic, and professional.
-   Use a restrained badminton/sports-inspired palette. A deep navy or
    charcoal base with a strong green accent is a suitable starting
    direction; keep colors consistent and accessible.
-   Use clear typography, spacing, cards, tables, status labels, and
    responsive layouts.
-   Use badminton imagery sparingly and only when it improves the
    interface.
-   Prioritize useful information over decorative charts.
-   Avoid excessive gradients, glassmorphism, neon effects, giant
    headings, and unnecessary animations.
-   Do not use emoji as substitutes for important interface icons.
-   Maintain consistent button, input, modal, table, badge, and card
    styles.

### Navigation concept

Role-aware navigation may include:

-   Overview
-   Tournaments
-   ShuttlePower
-   Friendly Matches
-   Players
-   Training
-   Payments
-   Jerseys
-   Polls
-   Announcements
-   Administration

Show only relevant navigation items for the user's permissions.

### Player experience

The player home screen should make the following easy to find:

-   Current SP and current seasonal position.
-   Leaderboard.
-   Upcoming tournaments and registration.
-   Pending challenges and match approvals.
-   Training schedule and attendance.
-   Own payment status.
-   Active polls and jersey orders.
-   Club announcements.

### Manager and trainer experience

Use focused management pages with search, filters, clear statuses, and
practical tables. Avoid placing every operation on one enormous
dashboard.

### Responsive requirements

-   Mobile-first responsive layout.
-   Tables must have a mobile-friendly alternative or controlled
    horizontal scrolling.
-   Brackets must remain usable on phones.
-   Forms must have clear validation and loading/error/success states.
-   Destructive actions require confirmation.
-   Empty states should explain what the user can do next.

------------------------------------------------------------------------

## 8. Security, privacy, and data integrity

Security is a core requirement, not a final polish task.

-   Enable RLS on all tables exposed through Supabase.
-   Test policies for every role and important action.
-   Validate every write on the server/database.
-   Use least-privilege permissions.
-   Never trust frontend-only role checks.
-   Protect private player contact details and payment records.
-   Players may read only their own private payment and attendance
    records.
-   Players may not alter SP balances or SP ledger entries.
-   Players may not approve their own friendly match results.
-   Only the losing side can approve a friendly result.
-   Use server time for the 24-hour auto-approval deadline.
-   Use transactions and idempotency controls for match finalization and
    SP awards.
-   Record sensitive changes in an audit log.
-   Avoid storing unnecessary personal information.
-   Do not commit secrets, tokens, private keys, or real user data.
-   Provide a safe development seed dataset using fictional players
    only.

------------------------------------------------------------------------

## 9. Testing requirements

Do not consider a feature complete merely because its page renders.

### Authentication and roles

-   Pending registration cannot access protected club modules.
-   Approved user can sign in.
-   One account can have multiple roles.
-   A player record can exist without an account.
-   Linking a player record cannot create duplicate account links.
-   Unauthorized users cannot call protected database operations
    directly.

### Tournament engine

Test:

-   Single Elimination with power-of-two and non-power-of-two entries.
-   Byes and automatic advancement.
-   Double Elimination, including winners and losers bracket progression
    and final reset rules where applicable.
-   Round Robin generation and standings.
-   Singles and doubles entries.
-   Random and manual seeding.
-   Participant caps.
-   Manual bracket edits.
-   Duplicate entries and invalid participants.
-   Match result correction and audit behavior.

### ShuttlePower

Test:

-   Initial 1,000 SP is awarded once.
-   Friendly wins and losses.
-   Stronger-versus-weaker outcomes.
-   Official tournament results apply exactly 2x normal impact.
-   Doubles team-average calculation.
-   Deterministic rounding.
-   SP transaction ledger balances reconcile with player totals.
-   Duplicate result processing cannot award SP twice.
-   Seasonal snapshot and rank-based deduction.
-   Historical season archives remain unchanged.

Do not write tests that lock in an unapproved formula or a provisional row's
numbers. Test the calculation engine against the approved configuration (D13);
keep test-only synthetic configs clearly separate from club values.

### Friendly match workflow

Test:

-   Winner can submit a result.
-   Losing player can approve.
-   Losing player can dispute.
-   Winner cannot approve their own submission.
-   Auto-approval occurs after 24 hours according to server time.
-   No auto-approval before the deadline.
-   Disputed results do not award SP.
-   Repeated approval or scheduled-job execution cannot duplicate SP.
-   Doubles approval follows the club-approved rule.

### Training and club activities

Test:

-   Attendance create/update and player visibility.
-   Monthly payment records and partial payments.
-   Players cannot see other players' payment records.
-   Jersey sizes and orders.
-   Poll voting eligibility and duplicate-vote prevention.
-   Poll closing behavior.
-   Announcement permissions.

------------------------------------------------------------------------

## 10. Development roadmap

Build in small, verifiable phases. Do not attempt the entire application
in one giant code-generation pass.

### Phase 0 --- Repository inspection and planning

-   Inspect existing files, package scripts, dependencies, and current
    implementation.
-   Identify whether this is a new or existing project.
-   Summarize the current architecture.
-   Propose the folder structure and database schema.
-   Identify unresolved product rules.
-   Do not delete or rewrite existing work without approval.

### Phase 1 --- Foundation

-   Set up React, TypeScript, Vite, Tailwind, and UI components.
-   Configure Supabase client and environment variables.
-   Create SQL migrations.
-   Implement authentication, profiles, player records, multi-role
    permissions, and RLS.
-   Add initial admin setup instructions.

### Phase 2 --- Player directory

-   Player list, search, filters, profile page.
-   Add players without accounts.
-   Link approved accounts to player records.
-   Role assignment and account approval.

### Phase 3 --- Tournament engine

-   Tournament and event management.
-   Participant registration and doubles teams.
-   Seeding and caps.
-   Single Elimination, Double Elimination, and Round Robin engines.
-   Bracket UI, result entry, automatic advancement, standings.
-   Unit tests for tournament algorithms.

### Phase 4 --- ShuttlePower

-   SP ledger and calculation module.
-   Starting 1,000 SP.
-   Friendly and official tournament multipliers.
-   Doubles team-average logic.
-   Leaderboards and player SP history.
-   Keep the unapproved proposal disabled and clearly marked as
    provisional. The approved formula is live (D13); never enable or change a
    rule version without a recorded club approval.

### Phase 5 --- Friendly challenges

-   Challenge invitations and acceptance.
-   Score submission by winner.
-   Loser approval/dispute.
-   Trusted 24-hour auto-approval.
-   Notifications and exactly-once SP processing.

### Phase 6 --- Training

-   Training sessions.
-   Attendance.
-   Monthly fee periods and payment records.
-   Player payment history.

### Phase 7 --- Jerseys, polls, and announcements

-   Jersey projects, designs, sizes, and orders.
-   Poll creation and voting.
-   Announcements.

### Phase 8 --- Seasonal ranking and archives

-   Season configuration (12-month calendar seasons in `Asia/Manila`, S2).
-   Seasonal snapshots (immutable, one per player per season, S19).
-   Rank-based deductions using the approved fixed tiers (S8), applied
    through a Super Admin-approved batch (S9).
-   Achievement archive and historical leaderboard, read from the snapshots
    (S19).

### Phase 9 --- Quality and deployment

-   Full RLS/security review.
-   Responsive and accessibility review.
-   End-to-end tests.
-   Error handling and loading states.
-   Production environment setup.
-   Deployment and backup/export guidance.
-   User acceptance testing with club managers, trainers, and players.

------------------------------------------------------------------------

## 11. Coding-agent operating instructions

You are acting as a senior full-stack engineer and technical mentor on
MBC Arena.

### Before changing code

1.  Inspect the repository and read its existing instructions
    (`AGENTS.md`, `README.md`, package files, and relevant docs).
2.  Identify the current stack and working features.
3.  Understand the relevant data model before modifying it.
4.  State the intended implementation plan for multi-step or high-impact
    changes.
5.  Ask for clarification when a business rule is unresolved and
    materially affects data, permissions, or calculations.

### While implementing

-   Work in small, coherent phases.
-   Preserve existing working functionality.
-   Use TypeScript types and runtime validation.
-   Keep UI components reusable but do not over-abstract simple screens.
-   Keep business logic out of presentation components.
-   Put tournament algorithms and SP calculations in isolated, testable
    modules or trusted backend functions.
-   Use database migrations for schema changes.
-   Add RLS policies alongside new exposed tables.
-   Add tests for business rules and edge cases.
-   Handle loading, empty, error, and success states.
-   Use realistic fictional seed data, not actual member information.
-   Keep naming consistent and code readable.
-   Do not silently change product requirements.
-   Do not add a feature merely because it is common in other sports
    platforms.

### After implementing

Report:

1.  What changed.
2.  Files created or modified.
3.  Database migrations and environment variables required.
4.  Tests run and their results.
5.  Known limitations or unresolved decisions.
6.  Exact manual steps the developer must perform.

Never claim that a feature is complete if it is only a UI mockup, if its
database operation is missing, or if its authorization is not
implemented and tested.

### Definition of done

A feature is done only when:

-   Its intended user can access it.
-   Unauthorized users are blocked at the data layer.
-   Data persists correctly.
-   Validation and error handling work.
-   Important edge cases are tested.
-   Mobile layout is usable.
-   Documentation is updated.

------------------------------------------------------------------------

## 12. Product decisions still requiring confirmation

The following items must remain visible in project documentation and
must not be silently decided by the coding agent.

> **Partly resolved (2026-11-02).** The seasonal rows are now decided: the
> deduction tiers and amounts (fixed 40 / 30 / 20 / 10 SP, S8), the rank basis
> (S8 and S12), the seasonal-versus-current SP relationship (S1 and S8), the
> season boundaries (S2), and the archive (S19) — see `PLAN.md` §7.3. The table
> below is retained for history; where it disagrees with §7.3, §7.3 governs.
> **The match-SP formula was approved 2026-11-03 (D13)** and the enabled
> `approved-2026-11` rule awards confirmed friendlies and completed tournament
> matches. **F4 was approved the same day (D14)** and is implemented in
> migration 017 (`docs/sp-formula-signoff.md`).

  -----------------------------------------------------------------------
  Topic                   Current understanding   Still needs
                                                  confirmation
  ----------------------- ----------------------- -----------------------
  Seasonal deduction      Higher-ranked players   Decided — S8: fixed
                          lose more SP            SP by rank position

  SP formula              Strength-based          **Decided — D13: base
                                                  20, sensitivity 0.02,
                                                  clamp 5–40, half-up
                                                  before ×2, floor 0**

  Seasonal SP             Seasonal leaderboard    **Decided — S1/S8:
                          exists                  separate value; Current
                                                  SP carries over**

  Doubles SP              Team average SP         **Decided — D13: even
                                                  split, lower-id odd
                                                  point, half-up**

  Friendly doubles        Losing side approves    Whether one or both
  approval                                        losing partners must
                                                  approve

  Disputes                Losing player can       Who resolves disputes
                          dispute                 and within what process

  Round Robin ties        Automatic standings     Official tie-break
                                                  order

  Mixed Doubles           Supported               Club's
                                                  pairing/eligibility
                                                  rule

  Walkovers/forfeits      Tournament matches      Whether and how they
                          supported               affect SP (unplayed-match
                                                  SP, still open)

  SP lower bound          Not specified           **Decided — D13: floor
                                                  0**

  Season dates            12-month year (S2)      Approved: Jan 1 to
                                                  Dec 31, Asia/Manila
  -----------------------------------------------------------------------

Use configurable rules where practical. Add a visible product decision
note when a rule needs owner approval.

------------------------------------------------------------------------

## 13. First task for the coding agent

Do not start by building all modules.

Start by:

1.  Inspecting the repository.
2.  Reporting the current project state and stack.
3.  Comparing it with the preferred stack in this document.
4.  Proposing the database schema and permission matrix.
5.  Listing unresolved product decisions that block implementation.
6.  Creating a phased implementation plan.

Wait for developer approval before making large architectural changes.

**The goal is a dependable club system that Matag-ob Badminton Club can
actually use, not merely a visually impressive prototype.**
