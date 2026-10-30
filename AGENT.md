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
-   Seasonal rankings run in three-month seasons.
-   At season end, current SP is **not reset to zero**. A rank-based
    deduction is applied, with higher-ranked players losing more points.
-   Previous seasons remain available as an achievement archive.
-   Seasonal deduction must not delete or rewrite historical match
    transactions.

#### SP items that remain to be finalized

The club has not yet specified exact numeric formulas. Do not invent
final values and silently ship them. Implement the calculation behind a
well-tested, configurable server-side rules module and document the
proposed defaults for club approval.

Awaiting confirmation:

1.  Friendly match SP formula and its strength-difference curve.
2.  Minimum/maximum SP change per match, if any.
3.  Whether SP can fall below zero.
4.  Rank tiers and exact seasonal deduction per tier (percentage or
    fixed amount).
5.  Whether rank for seasonal deduction is based on final leaderboard
    position, rank tier, or another rule.
6.  Whether seasonal deduction applies to current SP or only a separate
    seasonal value.
7.  Doubles rounding and how team-level changes are split between
    partners.
8.  Whether a tournament walkover, withdrawal, disqualification, or
    forfeit changes SP.

Recommended separation of values:

-   **Current SP:** persistent competitive rating used to compare player
    strength.
-   **Seasonal SP:** points earned during the current season for the
    seasonal leaderboard.
-   **Season archive:** immutable snapshot of a player's final seasonal
    position, SP, and achievement.

This separation is a recommended design, not yet a confirmed club rule.
The product owner must approve how the rank-based deduction interacts
with current SP and seasonal SP before production activation.

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
-   `seasons`: start/end dates and status.
-   `season_player_results`: final seasonal snapshots and achievements.
-   `season_deductions`: recorded rank-based deduction events.

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

1.  Identify the season end using the configured club timezone.
2.  Freeze and snapshot final seasonal rankings.
3.  Create achievement archive records.
4.  Apply the approved rank-based deduction to the approved SP value.
5.  Record each deduction in the SP ledger.
6.  Start the next season.
7.  Do not erase match history or previous seasonal archives.

The exact deduction formula and which SP balance it affects must be
approved before this workflow is enabled in production.

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

Do not write tests that lock in an unapproved formula. Test the
calculation engine against the approved configuration.

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
-   Keep unapproved formula settings disabled or clearly marked as
    provisional.

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

-   Season configuration.
-   Seasonal snapshots.
-   Rank-based deductions after club approval of the formula.
-   Achievement archive and historical leaderboard.

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

  -----------------------------------------------------------------------
  Topic                   Current understanding   Still needs
                                                  confirmation
  ----------------------- ----------------------- -----------------------
  Seasonal deduction      Higher-ranked players   Exact rank tiers and
                          lose more SP            deduction amounts

  SP formula              Strength-based          Exact win/loss formula
                                                  and caps

  Seasonal SP             Seasonal leaderboard    Exact relationship
                          exists                  between seasonal SP and
                                                  current SP

  Doubles SP              Team average SP         Exact rounding and
                                                  partner distribution

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
                          supported               affect SP

  SP lower bound          Not specified           Whether SP may go below
                                                  zero

  Season dates            Every three months      Exact season boundaries
                                                  and club timezone
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
