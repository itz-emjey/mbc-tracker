# MBC Arena — Implementation Plan

> **Source of truth for requirements:** `AGENT.md`
> **This document:** the approved working plan — architecture, design system, schema, phases, Phase 1 checklist, and open business rules.
> **Status:** v52 - architecture, stack, design, and roadmap approved. **Approved 2026-11-03 by the club owner: D13 - the §7.1 ShuttlePower formula** (base 20, sensitivity 0.02, clamp 5-40, floor 0, no ceiling, tournament x2, half-up rounding before the multiplier, even doubles split). Migration 016 records it as the enabled `approved-2026-11` rule version; the applied `provisional-2026-11` row stays provisional and disabled for audit. Confirmed friendlies and completed tournament matches now award SP. **Approved 2026-11-03: D14 - F4, the rule for corrected and invalidated results** (compensating reversal rows only, re-award under the original rule version, one transaction per correction), implemented in migration 017. Placement and unplayed-match SP remain open; the seasonal implementation shipped in migration 018. **§7.1.11 (F4) is approved and implemented as D14:** migration 017 adds the tournament award and its compensating reversal, so a corrected result reverses its prior rows and re-awards under the original rule version. **Implemented 2026-11-02: migration 011 (`011_friendly_sp_award.sql`) adds the internal friendly SP award and wires it into both friendly finalizers. It was inert until migration 016 enabled the approved rule on 2026-11-03; it changes no screen. Implemented 2026-11-02: migration 012 (`012_seasons.sql`) adds the seasonal schema — seasons, per-player seasonal balances, the close snapshot, deduction batches and entries, and transition checkpoints — with four Super Admin RPCs; it is inert, no season exists, and no screen or scheduled job uses it. **Implemented 2026-11-04: migration 018 (`018_seasonal_implementation.sql`) activates the approved S1–S23 rules — ranking, snapshot, deduction batch, transition job with retries and recovery, the seasonal leaderboard, and the S6/S7 award guards — together with policy 018, the `/admin/seasons` management screen, and the seasonal standings panel on `/shuttlepower`. Migration 018 is local only and still needs applying to the hosted project, after 017 and before policy 018.** **Approved during the seasonal decision review: S1-S15 — seasonal SP structure, season boundaries, automatic transition, deduction policy, and seasonal ranking — and, in the continued review, S16–S23, which close all eight follow-up rows of §7.4 (zero-match players, administrative status changes, tie-break counting, the seasonal snapshot and archive, the transition/notification/recovery design, placement matches, seasonal playoffs, and last-known-ranking retention) — all in §7.3.** That approval covered the seasonal **business rules**; the seasonal schema, scheduled job, notification channel, recovery screen, archive table, and implementation are now built in migration 018 (local only; hosted apply pending). **Approved 2026-11-01: D11 — no SP change for Rated participants in a placement match; D12 — Placement Match Eligibility Policy.** D12 approves the core eligibility principle, the eight eligible and eleven ineligible match situations, the additional conditions, and the placement credit rules recorded in §7.2.2 and §7.2.5. D11 and D12 are the **only** approved placement decisions: the **10-match placement system as a whole, the initial provisional SP value, qualification and concurrency design, and the final schema/RLS remain NOT APPROVED** (the seasonal **rules** — including the snapshot, transition, notification, and recovery design — are approved as S1-S23 in §7.3 and implemented locally in migration 018). The §7.1 formula and the doubles split/rounding are approved separately by D13 (2026-11-03), and F4 by D14. **All hosted migrations through 017 are applied; Phases 1-7 are complete and verified on the hosted project; Phase 4's friendly and tournament awards are active under D13 and D14.** Phase 1 and Phase 2 are complete. Phase 3 ships `domain/bracket.ts`, `domain/standings.ts`, and `domain/tournament.ts`, migration 005 (tournament tables, RLS, audited entry/draw/result RPCs), and the staff tournament console. Phase 4 adds migration 006 (versioned `sp_rule_versions` with a provisional, disabled default, plus `reconcile_sp_balances()`), the pure config-driven engine in `domain/sp.ts`, and `/shuttlepower` (leaderboard, own ledger history, admin balance check). Verification: 176/176 SQL checks, 228/228 frontend tests, typecheck, lint, format, and build all clean (typecheck/lint still report the pre-existing unused jersey-payment declarations). Hosted (2026-11-01): `anon` is denied on the tournament and rule tables and on the reconciliation RPC; a signed-in demo Super Admin reads `provisional-2026-11` and `{"checked":7,"consistent":true}`; policy 004 is confirmed; demo sign-in, the Phase 3 walkthrough, the Phase 5–7 walkthrough, the Gate G replay, and the owner's Super Admin bootstrap are done. Phase 6 adds migration 007 (sessions, attendance, fee periods, soft-voided payments) with audited training RPCs, the `/training` and `/payments` screens, and player-visible own records. Phase 7 adds migration 008 (jersey projects, designs, sizes, orders, polls with option-level votes, and announcements) with twelve audited club-activity RPCs and the `/jerseys`, `/polls`, and `/announcements` screens. Migration 009 adds design mockups in a public `jersey-designs` Storage bucket, pointed at by an audited staff-only RPC. Phase 5 adds migration 010 (friendly matches with challenge → accept → winner-submits → loser-approves → 24-hour auto-approval) and `/matches`; confirmed friendlies and completed tournament matches now award SP under D13 and D14. What remains is product scope: rules 1-6 and 11-14 are approved by D13, rule 7 gates doubles friendlies and unplayed-match SP, and rule 8 gates dispute resolution. Rules 3–5, 10, and 15 are now approved (S8 for tiers, amounts, and rollover; S2 for boundaries), and S16–S23 close the remaining seasonal questions. The seasonal rules are implemented in migration 018 (local only; hosted apply pending); placement and unplayed-match SP remain the only open SP product scope.

### Approved decisions

| # | Decision | Approved |
| --- | --- | --- |
| D1 | **Supabase-only.** No separate backend server in v1. Privileged logic in Postgres RPCs. | ✅ |
| D2 | React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase. | ✅ |
| D3 | **Minimalist dark** design system, single green accent, no light mode in v1 (§3). | ✅ |
| D4 | Phased roadmap, Phase 0 → 9, each phase shipped end-to-end (§6). | ✅ |
| D5 | SP stays configurable and visibly provisional until formulas are approved (§7). | ✅ |
| D6 | Strict RLS, DB-enforced integrity, automated tests are part of "done", not polish. | ✅ |
| D7 | Build incrementally. Never implement all modules in one pass. | ✅ |
| D8 | **First Super Admin:** create/invite the account via Supabase Auth, then assign `super_admin` with a one-time SQL bootstrap script. No public Super Admin registration route, no permanent bootstrap endpoint. | ✅ |
| D9 | **Round Robin tie-break:** match wins → head-to-head → game difference → point difference → playoff. Three or more tied participants use a mini-table of their mutual matches before moving to the next tie-breaker. | ✅ |
| D10 | **Mixed Doubles:** one male + one female per team (club's traditional format). Enforced in tournament domain logic and database validation. | ✅ |
| D11 | **Rated opponents during placement:** no SP gain, no SP loss, and no SP ledger transaction for any Rated participant in a placement match; their balance stays unchanged. The Unrated participant's hidden provisional SP still updates and the match still counts toward placement. Applies to singles and to every Rated doubles participant. This approves only the Rated-side asymmetry — not the placement system, the 10-match requirement, the hidden-balance design, or the SP formula (§7.2.4). | ✅ 2026-11-01 |
| D12 | **Placement match eligibility policy:** a placement match counts only when an actual badminton match has been played and its result finalized through the applicable workflow. Approves the eight eligible and eleven ineligible situations in §7.2.2, the additional conditions (retirement only with an official final result; DQ excluded by default; walkover/no-show/withdrawal-before-play excluded; no duplicate credit on correction; historical matches only when reliably verified), and the placement credit rules in §7.2.5 (one credit per eligible Unrated participant, none for Rated participants per D11, progress from unique finalized credits, void-not-delete for invalidated matches). This approves eligibility and credit rules only — not the 10-match system, the initial provisional value, the SP formula, doubles distribution, qualification design, seasons, or the schema/RLS implementation. | ✅ 2026-11-01 |
| D13 | **ShuttlePower match formula:** base 20, sensitivity 0.02, clamp 5–40, floor 0, no ceiling, tournament ×2, half-up rounding before the multiplier, even doubles split with the odd point to the lower player id. Recorded as the enabled `approved-2026-11` rule version in migration 016; the applied `provisional-2026-11` row is unchanged. Approves F1–F3 of `docs/sp-formula-signoff.md`; F4 is approved separately as D14. The near-zero doubles floor interaction remains open. | ✅ 2026-11-03 |
| D14 | **Corrected and invalidated results (F4):** a finalized result awards SP once; a change is corrected by append-only compensating `reversal` rows keyed to the original row, written in the same transaction as the correction; a winner flip reverses every existing award before re-awarding; a correction re-awards under the **original** rule version; retries and replays are no-ops through the unique key; a closed season's snapshot is never rewritten. Implemented in migration 017 for tournament matches, together with the tournament award. Approves F4 of `docs/sp-formula-signoff.md`. Walkover/forfeit/withdrawal/DQ SP treatment and the placement credit-count question remain open. | ✅ 2026-11-03 |
| S1–S15 | **Seasonal SP decisions (structure, boundaries, transition, deduction policy, ranking).** Approved during the seasonal decision review; the approval date is to be recorded. Recorded in §7.3. Implemented in migration 018 for the seasonal schema, ranking, snapshot, deduction batch, transition job, notification, recovery, and leaderboard; the placement system and unplayed-match SP remain outside this approval. | ✅ date TBD |
| S16–S23 | **Seasonal follow-up decisions** approved during the continued seasonal review (approval date to be recorded): zero-match players with no previous ranking; administrative and membership status changes at the cutoff; the seasonal tie-break source and counting; the immutable seasonal snapshot and archive; the transition, notification, and recovery design; placement matches contributing no Seasonal SP; no playoff for a seasonal tie; and last-known-ranking retention. Recorded in §7.3; these close §7.4. Implemented in migration 018 together with S1–S15. | ✅ date TBD |

---

## 1. Current repository state

| Item | Finding |
| --- | --- |
| Git | Initialized, branch `main`; Phases 1–3, the Phase 4 scaffold, and Phases 5–7 are committed |
| Tracked files | `AGENT.md`, `PLAN.md`, `frontend/`, `backend/`, root test tooling |
| `frontend/` | React + TS + Vite app: design system, shell, routing, guards, Supabase client, auth/admin screens, player directory and profiles, tournament console, ShuttlePower pages, friendly matches, training and payments, jerseys, polls, announcements |
| `backend/` | SQL migrations 001–010, policies 001–010, seeds, and the PGlite verification harness |

**Conclusion:** Phases 1–3 are implemented and verified against the hosted project, Phase 4 ships a disabled
scaffold, and Phases 5–7 are complete and verified against the hosted project. The remaining work is
product scope — the §7 SP and season rules — not setup (see §9).

---

## 2. Stack decision

`AGENT.md` prefers **React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase**. That stack was approved unchanged (D2), with the structural question now settled in §2.1.

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui primitives |
| Routing | React Router |
| Data fetching | TanStack Query (cache, retries, loading/error states) |
| Forms + validation | React Hook Form + Zod (shared schemas with server checks) |
| Backend | Supabase (Postgres, Auth, Storage, RLS, RPC) |
| Business logic | Postgres functions/RPC for SP + match finalization; pure TS modules for bracket generation, unit tested |
| Scheduling | `pg_cron` (preferred) or a secured Supabase Edge Function on a schedule — for 24h auto-approval and season rollover |
| Hosting | Vercel free tier (frontend) |
| Tests | Vitest (pure modules), Playwright (critical flows) |

### 2.1 Resolved — Supabase-only, no separate server ✅ (D1)

Approved 2026-10-30. **There is no application server in v1.**

- All privileged operations live in Postgres functions / `security definer` RPCs, exactly as `AGENT.md` §2 requires.
- Authorization is enforced in exactly one place — RLS plus RPC guards. There is no second code path to keep in sync, which is the main reason this was chosen.
- `backend/` is **not** a Node service. It holds SQL migrations, RPC source, RLS policy files, policy tests, and seed data, all versioned in Git.
- Nothing in `frontend/` holds a service-role key. The browser gets the anon key and RLS decides what it can do.
- Supabase **Edge Functions are not planned**. They are allowed only if a future need genuinely cannot be met in Postgres (transactional email, PDF export). Adding one would be a new approved decision, not a silent drift.

**Revisit only if:** the club needs work Postgres cannot do safely, or free-tier limits are hit. Either event triggers a new decision record, not an ad-hoc server.


### 2.2 Final folder structure (D1-aligned, no server)

```
mbc-tracker/
├─ AGENT.md                      # requirements, unchanged by this plan
├─ PLAN.md                       # this document
├─ README.md                     # setup, env vars, migration + seed commands
├─ .env.example                  # placeholders only, committed
├─ .gitignore                    # .env.local, node_modules, dist
├─ frontend/
│  ├─ public/
│  ├─ src/
│  │  ├─ main.tsx
│  │  ├─ app/
│  │  │  ├─ router.tsx
│  │  │  ├─ providers.tsx         # QueryClient, AuthProvider, Toaster
│  │  │  ├─ layouts/              # AppShell, AuthLayout
│  │  │  └─ guards/               # RequireAuth, RequireApproved, RequireRole
│  │  ├─ components/
│  │  │  ├─ ui/                   # shadcn primitives, themed to §3.2 tokens
│  │  │  └─ shared/               # PageHeader, DataTable, StatusBadge, EmptyState,
│  │  │                           # ConfirmDialog, LoadingState, ErrorState
│  │  ├─ features/
│  │  │  ├─ auth/                 # sign in, register, pending state, approval queue
│  │  │  ├─ players/              # directory, profile, link account, role assignment
│  │  │  ├─ tournaments/          # phase 3
│  │  │  ├─ shuttlepower/         # phase 4
│  │  │  ├─ matches/              # phase 5 (friendly challenges)
│  │  │  ├─ training/             # phase 6 (sessions, attendance, payments)
│  │  │  ├─ jerseys/              # phase 7
│  │  │  ├─ polls/                # phase 7
│  │  │  └─ announcements/        # phase 7
│  │  ├─ lib/
│  │  │  ├─ supabase.ts           # the single typed client
│  │  │  ├─ queryKeys.ts
│  │  │  ├─ permissions.ts        # UI affordances only — never enforcement
│  │  │  └─ format.ts             # dates, SP, currency, tabular numerals
│  │  ├─ domain/                  # pure TS: bracket.ts, standings.ts, sp.ts
│  │  ├─ styles/
│  │  │  ├─ tokens.css            # §3.2 CSS variables — single source of colour
│  │  │  └─ globals.css
│  │  └─ types/
│  │     └─ database.ts           # generated via `supabase gen types` — do not hand-edit
│  ├─ tests/
│  │  ├─ unit/                    # Vitest — domain modules
│  │  └─ e2e/                     # Playwright — critical journeys
│  ├─ index.html
│  ├─ tailwind.config.ts
│  ├─ vite.config.ts
│  └─ tsconfig.json
└─ backend/                       # SQL only — not a server
   ├─ migrations/                 # 001_identity.sql, timestamped, committed
   ├─ functions/                  # RPC source: has_role, approve_registration,
   │                              # link_player, grant_starting_sp, ...
   ├─ policies/                   # RLS policy SQL, one file per module
   ├─ tests/                      # policy + constraint assertions
   └─ seeds/
      ├─ 001_fictional_players.sql
      └─ README.md                # how to run; fictional data only
```

**Structural rules (enforced by review):**

- `features/*` may import `lib/`, `components/`, `domain/`, `types/`. **Never** another feature's internals.
- `domain/*` is pure: no React, no Supabase, no `fetch`, no `Date` calls inside calculations (time is passed in as a parameter). Deterministic and unit tested first.
- `components/ui/*` are theme wrappers only — zero business logic.
- Every exposed table ships with a migration, a policy file, and a policy test **in the same change**.
- `types/database.ts` is regenerated, never hand-edited.
- `lib/permissions.ts` drives what the UI shows. It is never the thing that stops a request.


---

## 3. Design direction — **minimalist dark**

This is a hard constraint on all UI work, layered on top of `AGENT.md` §7 (which already bans gradients, glassmorphism, neon, giant headings, and decorative animation).

**Feel:** a quiet, precise, professional sports-club tool. Dark surfaces, thin borders, generous whitespace, type and layout doing the work instead of decoration. Closer to a well-designed terminal or Linear than to a flashy sports app.

### 3.1 Principles

- **Dark by default, no light mode in v1.** One theme, executed well.
- **Surfaces, not shadows.** Hierarchy comes from 3–4 flat surface levels + 1px borders. No drop shadows except a single soft shadow on menus/modals.
- **One accent.** A single green accent for primary actions, active nav, and positive deltas. Everything else is grayscale.
- **Restraint on color.** Red only for destructive/error, amber only for pending/warning. No rainbow status colors.
- **Density with air.** Tables are compact but rows are tall enough to read on a phone.
- **No emoji as UI.** Use Lucide icons at consistent sizes.
- **Motion is a hint, not a show.** 120–160ms transitions on hover/focus/open only; respect `prefers-reduced-motion`.

### 3.2 Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#0A0D11` | App background (near-black, slightly cool) |
| `surface-1` | `#101419` | Cards, panels, sidebar |
| `surface-2` | `#161B22` | Inputs, table headers, hover rows |
| `surface-3` | `#1D242D` | Popovers, modals, selected state |
| `border` | `#232B36` | Default 1px divider |
| `border-strong` | `#33404F` | Focus rings, active edges |
| `text` | `#E7EDF3` | Primary text |
| `text-muted` | `#93A1B1` | Secondary text, labels |
| `text-faint` | `#7A8998` | Timestamps, hints *(raised from `#61707F` in Group C to meet AA 4.5:1 — see §9)* |
| `accent` | `#2ED47A` | Primary buttons, active nav, positive delta |
| `accent-hover` | `#27BC6C` | Hover state |
| `accent-soft` | `rgba(46,212,122,0.12)` | Accent badges/chips |
| `danger` | `#F05A5A` | Destructive, loss delta, errors |
| `warning` | `#E8B04B` | Pending approval, disputes |
| `info` | `#5AA9F0` | Neutral system notices |

Contrast: `text` on `bg` ≈ 14:1, `text-muted` on `surface-1` ≈ 5.5:1, `accent` on `bg` ≈ 8:1 — all comfortably above WCAG AA. Accent is never used as text on `accent-soft` at small sizes without checking; primary buttons use `text` on `accent`? **No** — buttons use dark text (`#06120B`) on the green fill for maximum legibility.

### 3.3 Type, spacing, shape

- **Type:** Inter for UI, `ui-monospace`/JetBrains Mono for SP values, scores, and IDs. **Tabular numerals everywhere numbers align** (`font-variant-numeric: tabular-nums`) — critical for leaderboards and score tables.
- **Scale:** 12 / 13 / 14 / 16 / 20 / 24 / 30. Body is 14px, table text 13px, page titles 24px. Never larger than 30px except a single hero number (current SP).
- **Weight:** 400 body, 500 labels/buttons, 600 headings. No 700+ except the hero SP figure.
- **Spacing:** 4px base scale (4/8/12/16/24/32/48). Card padding 20px. Section gap 24px. Page gutter 16px mobile / 32px desktop.
- **Shape:** radius 8px (cards, inputs, buttons), 999px for status pills, 6px for small chips. Borders always 1px, never 2px.
- **Layout:** max content width 1240px, centered. Sidebar 240px on desktop, collapsible to icon rail; bottom tab bar or sheet nav on mobile (max 5 items + "More").

### 3.4 Component conventions

- Buttons: `primary` (green fill), `secondary` (surface-2 + border), `ghost` (text only), `danger` (danger text + border until confirmed). Heights 32/36/40.
- Inputs: surface-2 fill, 1px border, accent border on focus with a 2px soft ring — never a thick glow.
- Status pills: uppercase 11px, letter-spaced, tinted background at 12% + matching text. Fixed vocabulary: `draft`, `open`, `pending`, `accepted`, `disputed`, `confirmed`, `auto-approved`, `paid`, `partial`, `unpaid`, `archived`.
- Tables: sticky header, hover row = surface-2, mobile fallback = stacked key/value cards below 768px (not a squeezed table).
- Empty states: one line of explanation + one next action. No illustrations.
- Charts: only where `AGENT.md` allows — SP trend, attendance rate. Flat lines, accent stroke, no gridlines beyond a faint horizontal set, no 3D, no gradients.
- Brackets: 1px connector lines in `border-strong`, active/completed matches tinted by status; mobile uses a round-by-round selector instead of a scrollable canvas by default.

### 3.5 What is explicitly forbidden

Gradients, glass/blur panels, neon glows, colored drop shadows, parallax, animated numbers, confetti, decorative sports photography backgrounds, emoji icons, and any accent color other than the single green.

---

## 4. Data model (approved direction, open to refinement)

UUID primary keys, `created_at`/`updated_at` on all mutable tables, constraints for valid states, RLS on every exposed table.

### Identity
- `profiles` (1:1 `auth.users`), `players` (nullable account link, unique), `roles`, `user_roles`, `registration_requests`.
- `players.gender` — nullable enum `('male','female')` (D10). Only required for Mixed Doubles entry; no other module reads it, and it is not exposed in public player views by default.

### Tournaments
- `tournaments`, `tournament_events` (discipline + format), `teams`, `team_members`, `tournament_entries` (unique per event), `bracket_rounds`, `matches`, `match_games`, `match_result_submissions`, `tournament_standings` (cache only).
- Mixed Doubles integrity (D10): a `team` entered in a `mixed_doubles` event must have exactly two members with genders `male` and `female`. Checked in the domain module and re-checked in a database constraint/trigger before the entry is accepted — a forged client request cannot create a same-gender pair.
- Standings (D9) are always recalculated from recorded matches in `domain/standings.ts` and mirrored in one SQL function. Tie-break order lives in that single function, never in the UI.

### ShuttlePower
- `sp_accounts` (current + seasonal totals, derived/cached), `sp_transactions` (**immutable ledger, append-only**), `sp_rule_versions`, `seasons`, `season_player_results`, `season_deductions`. The seasonal tables are **planned only**: S1–S15 (§7.3) approve the rules, not this schema.

### Training
- `training_sessions`, `training_attendance` (unique per session+player), `training_fee_periods`, `training_payments` (soft-void, never delete).

### Club
- `jersey_projects`, `jersey_designs`, `jersey_project_sizes`, `jersey_orders` (unique active per player+project), `polls`, `poll_options`, `poll_votes` (unique per poll+player), `announcements`, `notifications`.

### Ops
- `audit_logs`, `app_settings`, `scheduled_job_runs` (idempotency for cron).

**Integrity rules enforced in the database, not the UI:**
- Append-only `sp_transactions` (no UPDATE/DELETE policy) with `idempotency_key` unique per source.
- One starting-SP transaction per player, ever.
- Score submission → at most one finalized result per match.
- Auto-approval deadline computed from `now()` server-side, never from a client date.
- Payment and SP corrections create new rows referencing the original, never overwrite.

---

## 5. Permission matrix (v1)

| Capability | Super Admin | Tournament Mgr | Trainer | Player |
| --- | :--: | :--: | :--: | :--: |
| Approve registration, assign roles | ✓ | – | – | – |
| Create/link player records | ✓ | ✓ | ✓ | – |
| Create/manage tournaments, enter results | ✓ | ✓ | – | – |
| Generate/edit brackets | ✓ | ✓ | – | – |
| Register self for a tournament | ✓ | ✓ | ✓ | ✓ |
| Submit friendly result (as winner) | – | – | – | ✓ |
| Approve/dispute own friendly result | – | – | – | ✓ (losing side only) |
| Create training sessions / attendance | ✓ | – | ✓ | – |
| Record payments | ✓ | – | ✓ | – |
| View any player's payment record | ✓ | – | ✓ | – |
| View own payment/attendance | ✓ | ✓ | ✓ | ✓ |
| Create jersey projects / polls / announcements | ✓ | – | ✓ | – |
| Vote, order jersey | ✓ | ✓ | ✓ | ✓ |
| Adjust SP manually | **no one** | **no one** | **no one** | **no one** |
| Resolve a disputed match | ✓ (audited) | – | – | – |

Every row above needs a matching RLS policy **and** a server-side guard, plus a test that a direct API call by the wrong role is rejected.

---

## 6. Phased roadmap

Each phase must ship something usable end-to-end (schema → policy → UI → test), not a mockup. A phase is done only by the `AGENT.md` §11 definition of done.

### Phase 0 — Planning ✅ Approved
- Repo inspection complete at planning time: greenfield, zero commits, `frontend/` and `backend/` empty.
- D1–D7 approved 2026-10-30 (see the decisions table at the top).
- Remaining §7 items are **club business rules**, not architecture. They block Phase 3 onward where noted, never Phase 1.
- **Deliverable:** this document (v2).

### Phase 1 — Foundation
Full task list and acceptance gates: **§6.1**. Summary:
1. Scaffold Vite + TS + Tailwind, wire §3.2 tokens as CSS variables, build the dark app shell.
2. Supabase project, `.env.example`, one typed client, generated DB types.
3. Migration 001: identity, roles, `registration_requests`, `audit_logs`, `app_settings` — with RLS and a `has_role()` helper.
4. Auth lifecycle: register → pending → admin approves → roles assigned → player record linked → **1,000 SP exactly once**.
5. Frontend route guards and role-aware navigation.
6. Fictional seed data and a demo admin.
- **Exit test:** a pending user sees nothing; an approved player sees only their own profile and SP; a direct REST call to a protected table with the anon key is rejected.

### 6.1 Phase 1 — implementation checklist

Executed in order. Each group ends at a **gate** that must pass before moving on. I will report at each gate rather than delivering the whole phase in one shot.

#### Group A — Baseline
- [ ] A1. `git add AGENT.md PLAN.md`, initial commit `docs: add agent guide and approved implementation plan`.
- [ ] A2. Confirm branch `main`, clean tree, `.gitignore` present before first `npm install`.
- [ ] A3. Confirm no paid service is required for any Phase 1 task.
- **Gate A:** repo has one commit; nothing else changed.

#### Group B — Frontend scaffold
- [ ] B1. `frontend/`: Vite + React + TS template, strict `tsconfig`, path alias `@/*`.
- [ ] B2. Tailwind + PostCSS configured; `@tailwindcss/forms` and `@tailwindcss/typography` only if actually used.
- [ ] B3. `styles/tokens.css` with every §3.2 token as a CSS variable; `tailwind.config.ts` maps utilities to those variables (no raw hex in components).
- [ ] B4. Inter self-hosted or via `@fontsource`; tabular numerals utility for SP/score columns.
- [ ] B5. ESLint + Prettier; scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`.
- **Gate B:** `npm run build` and `npm run typecheck` pass on an empty app; zero hex literals outside `tokens.css`.

#### Group C — Design system foundation
- [ ] C1. Install only the shadcn/ui primitives Phase 1 uses: Button, Input, Label, Card, Badge, Dialog, Alert, DropdownMenu, Table, Skeleton, Toast/Sonner.
- [ ] C2. Re-theme each primitive to the tokens; remove default light-mode classes. Delete unused shadcn defaults rather than leaving dead styles.
- [ ] C3. Document component variants in a dev-only `/dev/ui` route (buttons, inputs, badges, states). Not shipped in nav.
- [ ] C4. `shared/` components: `PageHeader`, `StatusBadge`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog`.
- **Gate C:** every primitive renders correctly on the near-black base; no gradients, no shadows beyond the modal/menu exception; focus rings visible via keyboard only.

#### Group D — App shell and routing
- [ ] D1. `AppShell`: 240px sidebar (desktop), collapsible icon rail, mobile bottom nav (≤5 items + More sheet).
- [ ] D2. Header with page title, user menu, sign-out. Active nav state = accent text + `accent-soft` background, no glow.
- [ ] D3. Routes for Phase 1 only: `/`, `/sign-in`, `/register`, `/pending`, `/profile`, `/admin/registrations`. Placeholder routes for later phases are **not** created.
- [ ] D4. Role-aware nav: items derive from `lib/permissions.ts`; hides what a role cannot use.
- [ ] D5. Route guards: `RequireAuth`, `RequireApproved`, `RequireRole` — with loading, disabled, and 403 states.
- [ ] D6. Error boundary + 404 page in the same visual language.
- **Gate D:** keyboard-only navigation works; mobile layout usable at 360px width; no layout shift on load.

**Group D — as built (v5):**

- **Routes:** `/sign-in`, `/pending`, `/unauthorized`, and a guarded shell at `/` containing `/` (Overview),
  every module in `app/navigation.ts` as a guarded placeholder, and a nested `*` 404. `/register` and
  `/profile` were deliberately absent at v5; `/register` arrived in Group G, and `/profile` remains a
  Phase 2 page.
  This extends D3: later-phase modules get a **guarded placeholder** so role filtering and direct-URL
  blocking can be exercised, but they render a "not built yet" state and contain no data or fake
  business logic.
- **Permissions:** the single module list in `frontend/src/app/navigation.ts` drives the sidebar, the
  mobile bar, and the generated route table, so navigation and guards cannot drift. Role matching is
  `hasAnyRole` in `frontend/src/features/auth/types.ts` (any-of, never role hierarchy), which is what
  makes one account with several roles work.
- **States:** `AppLoading`, `/sign-in` (authentication-required), `/pending`, `/unauthorized` (403 +
  suspended account), 404, and a route-level `errorElement`.
- **Auth placeholder:** development only. `features/auth/dev-session.tsx` stores a persona id in
  `localStorage` and is compiled out of production builds (verified: none of its strings appear in
  `dist/`). Production renders as signed-out with "Sign-in is not configured" until Group G. No mock
  session is presented as authentication.
- **Shell:** 240px sidebar with persisted icon-rail collapse, mobile bottom bar (4 modules + More
  sheet), skip link, scroll-to-top and `document.title` on route change.

#### Group E — Supabase wiring
- [x] E1. Supabase project created (**manual step: developer creates it and holds credentials**). Verified: `.env.local` configured locally, GoTrue and the database API reachable.
- [x] E2. `.env.example` with `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` placeholders only; `.env.local` gitignored.
- [x] E3. `lib/supabase.ts` — single lazy client; the `Database` generic lands with E4.
- [x] E4. `supabase gen types typescript` wired to a script and committed output. **Completed in Group F** (see the Group F as-built note).
- [x] E5. Verify no service-role key exists anywhere in `frontend/` or Git history.
- **Gate E:** app boots against the real project; a failed env var produces a clear error, not a blank screen. **Passed** once E4 closed in F; the in-app error path is exercised when Group G wires the session provider.

**Group E status (v10):**

- **E1:** verified.
- **E4:** completed in Group F — types generated and the client typed.
- **Email confirmation:** disabled for development (verified).
- **Gate E:** passed — E1–E5 complete and the E4 deferral reconciled.

**Group E — as built (v10):**

- **E1 done and verified.** The owner created the `mbc-arena` project and filled `frontend/.env.local` (gitignored,
  never committed). `npm run check:supabase` probes the live project without printing secrets and reports:
  GoTrue v2.197.0 reachable, the anon/publishable key accepted by the database API, no stored session, and an empty
  `public` schema (the probe table correctly returns `PGRST205`). The key is a `sb_publishable_…` key, not a
  service-role or secret key.
- **E2 done.** `frontend/.env.example` contains only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, both empty;
  `.env.*` is gitignored with an explicit `!.env.example` exception.
- **E3 done (client + validation).** `src/lib/env.ts` validates both variables, rejects malformed URLs, rejects
  service-role JWTs and `sb_secret_…` keys, and throws a readable `SupabaseConfigError`. `src/lib/supabase.ts`
  exposes one lazily created client with session persistence and token refresh, typed with the generated `Database`
  type.
- **E5 verified.** `git grep` finds no service-role key, secret key, or JWT value in tracked files or history; the
  only matches are documentation and tests that reject such keys.
- **E4 completed in Group F.** `frontend/src/types/database.ts` was generated with the Supabase CLI from the
  migration schema (nine tables plus `has_role`), and `src/lib/supabase.ts` now uses `SupabaseClient<Database>`.
  Regenerate the file against the hosted project for the authoritative refresh, and after every later migration.
- **Gate E evidence.** Connectivity and key rejection are covered by `npm run check:supabase`; env validation and
  the clear `SupabaseConfigError` are covered by 13 unit tests. The error path reaches the running app only when
  Group G wires the session provider; the E4 deferral is now reconciled.
- **Email confirmation (development) — verified.** The Email provider is enabled, sign-ups are allowed
  (`disable_signup: false`), and `mailer_autoconfirm: true`, so confirmation is off. A live `signInWithPassword`
  probe returns `invalid_credentials` instead of `email_provider_disabled`, confirming email authentication is
  active. This configuration is for development only: production must require confirmation.
- **Group G (position at v10):** approval RPCs, registration UI, role assignment, and the real session provider were
  still outstanding, and the development persona adapter was the only session source. Delivered in v12 — see the
  Group G as-built note.

#### Group F — Migrations and policies (identity + SP bootstrap)
- [x] F1. `backend/migrations/001_identity.sql`: `profiles`, `players`, `roles`, `user_roles`, `registration_requests`, `audit_logs`, `app_settings`. A second migration, `002_shuttlepower_bootstrap.sql`, adds the minimal `sp_accounts` + append-only `sp_transactions` required by F6 and G6.
- [x] F2. UUID PKs, `created_at`/`updated_at` + trigger, FKs, `CHECK` constraints on status enums (checked text chosen consistently; see as-built note).
- [x] F3. Uniqueness: one account per player (`players.profile_id` unique), one role assignment per (profile, role), one open registration request per email.
- [x] F4. `has_role(uuid, role)` as `security definer`, `search_path` pinned.
- [x] F5. RLS enabled on **every** table in the migration, with policies in `backend/policies/`.
- [x] F6. Column privileges: players cannot write `sp_accounts` or role tables — no policy grants it, and no `INSERT`/`UPDATE` grant exists.
- **Gate F:** migration applies from an empty database without manual dashboard edits; re-running it fails loudly rather than silently. **Passed:** all five files applied to the hosted project; local harness 41/41; a PostgREST probe with the publishable key now returns `42501 permission denied` for all nine tables to `anon` (tables exist, anon grants are revoked).

**Group F — as built (v10):**

- **Migrations.** `001_identity.sql` creates the seven identity/operations tables; `002_shuttlepower_bootstrap.sql`
  adds the minimal Phase 1 SP account cache and append-only ledger needed by F6 and G6. Neither includes the Phase 4
  SP formula, seasons, or match references. Both are non-idempotent by design: re-running fails at the first
  `CREATE`. Roles are the only seeded rows.
- **Constraint choice (F2).** Statuses are checked `text` columns, not Postgres enums. This keeps future status
  additions migration-only and produces stable generated TypeScript; every allowed value is still enforced by a
  named `CHECK`. UUID keys default to `gen_random_uuid()`.
- **Uniqueness (F3).** `players.profile_id` is unique; `user_roles` is keyed by `(profile_id, role_id)`; partial
  unique indexes enforce one pending registration per email (case-normalised) and per profile. Approving a request
  frees the email for a later request.
- **Role predicate (F4).** `public.has_role(p_profile_id, p_role_key)` is `security definer`, `stable`, with
  `search_path = ''`; execute is granted only to `authenticated` and `service_role`. It requires the profile to be
  `active`, so suspension/deactivation revokes role-based access immediately at the database layer, not just in the UI.
- **RLS and grants (F5/F6).** RLS is enabled on all nine tables. `anon` has no table access. `authenticated` gets
  narrow grants: own-name update on `profiles`, staff writes on `players`, read-only role/registration/audit/settings
  access, and select-only SP. There is no client `INSERT`/`UPDATE`/`DELETE` on `roles`, `user_roles`,
  `registration_requests`, `audit_logs`, or `sp_*`. `sp_transactions` additionally rejects UPDATE, DELETE, and
  TRUNCATE through triggers.
- **Verification.** `npm run test:db` runs a real PostgreSQL engine (PGlite) with `auth.users`/`auth.uid()` stubbed
  to Supabase's shape, applies both migrations and all three policy files, and passes 41/41 checks: schema, RLS
  coverage, idempotency failure, constraints, column privileges, and positive/negative cases for player, pending,
  staff, admin, anon, and the SP ledger. No Docker, hosted database, or database password is used.
- **E4 closed.** `frontend/src/types/database.ts` is generated with `supabase gen types typescript` from the
  migration schema, and `src/lib/supabase.ts` is now `SupabaseClient<Database>`. Typecheck and lint pass. The types
  must be regenerated against the hosted project after the migrations are applied there.
- **Known limitations.** `app_settings` has no seed rows. Approval/linking/starting-SP RPCs and the real session
  provider remain Group G. The SP bootstrap is schema only — no formula or engine. The committed types were
  generated from the same migrations against a local Postgres; they match the hosted schema, but regenerating them
  against the hosted project is still the authoritative refresh.

#### Group G — Auth lifecycle ✅ Approved and executed
- [x] G1. Sign up form (email, password, full name) with Zod validation shared with the server check.
- [x] G2. Registering creates `profiles` (unapproved) + `registration_requests` (pending). **No player record, no SP yet.**
- [x] G3. `/pending` explains what happens next; pending users cannot reach club modules.
- [x] G4. Admin approval screen: list pending requests, approve or reject with a reason; suspension/deactivation supported.
- [x] G5. On approval, a single RPC (`approve_registration`) atomically assigns roles, creates or links the player record, and grants starting SP.
- [x] G6. `grant_starting_sp`: inserts one `1000` ledger transaction with idempotency key `player:{id}:initial`, guarded by a unique constraint. Called twice → still one row.
- [x] G7. Every approval/rejection/role change written to `audit_logs` with actor, target, and before/after.
- **Gate G:** approve the same request twice → exactly one player, one role set, one 1,000 SP transaction. **Passed locally** (`approval is atomic and idempotent (Gate G)`); not yet repeatable against the hosted project, which is still missing the two SQL files.

**Group G — as built (v12):**

- **Real session, no fallback.** `features/auth/dev-session.tsx` is deleted. `SessionProvider` reads the
  Supabase session, loads the profile plus role assignments, and exposes `status`, `user`, `signOut`, and
  `refresh` through `session-context.ts`. A missing or invalid env var renders the configuration screen, not a
  blank app; there is no persona or mock identity in any build.
- **Registration is RPC-only.** `submit_registration(p_full_name)` creates or refreshes the caller's `pending`
  profile and one open request, and is idempotent for a pending profile (an active profile is a no-op).
  `policies/004_auth_lifecycle.sql` revokes the old direct `profiles` INSERT grant and drops its policy, so no
  client can create a profile without a matching request. Sign-up calls Auth `signUp` then the RPC; `/pending`
  shows the request, any rejection reason, a status refresh, and a resubmit path, and cannot reach club modules.
- **Approval is atomic.** `approve_registration(p_request_id, p_role_keys, p_player_id)` re-checks
  `super_admin` through `require_super_admin()`, locks the request and profile, creates or links exactly one
  player, assigns roles, awards starting SP, marks the request approved, and writes one audit row — all in one
  transaction. A replay returns the stored outcome with `already_processed = true` and changes nothing. Approval
  refuses an unknown role and refuses a player record already linked to another account.
- **Starting SP is exactly once.** `grant_starting_sp` is internal: execute is revoked from `public`, `anon`,
  `authenticated`, and `service_role`, so only the definer path can call it. It inserts one `initial` ledger row
  guarded by the unique key `player:{id}:initial` and updates the cached balance only when that insert happened.
- **Rejection and access changes.** `reject_registration` requires a 3–1,000 character reason, is audited, cannot
  run after approval, and lets a rejected member submit a fresh request while the old one stays on record.
  `set_profile_status` covers suspend/deactivate/reactivate, refuses pending profiles (those go through
  approval), and refuses self-lockout so a lone Super Admin cannot close their own access.
- **UI.** `/register` (shared Zod schema, email-confirmation-aware), `/admin` with pending-requests and members
  tabs, an approve dialog (multi-role picker, create-or-link player record), a reject dialog with a required
  reason, and suspend/deactivate/reactivate confirmations. Pending and rejected states are explained on
  `/pending`, with the reviewer's reason shown.
- **Verification (local).** `npm run test:db` 56/56 — Gate G double approval, multi-role assignment plus audit,
  unknown role, link/steal protection, rejection idempotency, starting SP once, suspension revoking access,
  self-suspension refusal, and pending activation refusal. `npm test` 52/52. `typecheck` and `lint` clean.
- **Hosted status (v14).** Migration 003 is **live**: a publishable-key probe with the real argument signatures
  resolves all six functions and returns `401 42501 permission denied` for each (before the migration the same
  calls returned `404 PGRST202`, and a deliberately missing function still returns `404 PGRST202`, so the change is
  the migration, not a generic response). Policy 004 only narrows `authenticated`'s grants, which the API cannot
  read back: confirm it in the SQL Editor with
  `select has_table_privilege('authenticated', 'public.profiles', 'INSERT');` — expected `false` — and check that
  `profiles_insert_self_pending` no longer appears in `pg_policies` for `profiles`. Gate G's end-to-end smoke test
  still needs the Super Admin from Group J4.

#### Group H — Ownership and privacy checks ✅ Approved and executed
- [x] H1. A player can read only their own `profiles` row and own private fields.
- [x] H2. A player cannot read another player's contact details.
- [x] H3. No client path can update `sp_accounts.sp`, role tables, or `audit_logs`.
- [x] H4. An unapproved user calling a club RPC gets an authorization error, not empty data.
- **Gate H:** policy tests in `backend/tests/` cover each row of the §5 matrix that Phase 1 touches, including the negative cases. **Passed:** 11 new assertions, 67/67 total.

**Group H — as built (v13):**

- **No policy change was needed.** The ownership and no-write rules already held in `policies/001`–`004`; Group H
  added the missing negative proof and widened the privilege assertions, so the guarantees are tested rather than
  assumed. Nothing new to apply to the hosted project.
- **H1 — own profile only.** `profiles_select_own_or_super_admin` plus the `full_name`-only UPDATE grant mean a player
  reads and renames only their own row; another profile is filtered out of a `SELECT ... WHERE id = ...` and out of
  an `UPDATE`, and `profiles.status` stays unupdatable by any client.
- **H2 — contact details.** Phase 1 stores no contact fields on `profiles` or `players` (asserted against
  `information_schema`), email lives only in `auth.users`, which no client role can read, and
  `registration_requests.email` is visible only to its owner or a Super Admin. `players.gender` is readable by club
  members because Mixed Doubles eligibility (D10) needs it; it is not contact information.
- **H3 — no client writes.** `authenticated` holds SELECT only on `roles`, `user_roles`, `audit_logs`, `sp_accounts`,
  and `sp_transactions`; INSERT/UPDATE/DELETE fail with `permission denied` for a player *and* for a Super Admin,
  and `players.profile_id` remains ungranted, so account linking is RPC-only.
- **H4 — authorization errors, not silence.** A pending account, an account with no profile, and a Tournament Manager
  calling `approve_registration` receive `42501 not authorized`; a suspended Super Admin loses the authority
  immediately; `anon` cannot execute any of the six auth-lifecycle functions.
- **Gate H evidence.** 11 new assertions, total 67/67. The §5 rows Phase 1 touches are covered: approve/assign roles
  (Super Admin only), create/link player records (staff, with linking through the RPC), manual SP adjustment (no
  one), and `anon` holding no table privilege on any of the nine tables.

#### Group I — Seed data ✅ Approved and executed
- [x] I1. `seeds/001_fictional_players.sql` — clearly fictional names, 4–6 players, one per role, mixed statuses.
- [x] I2. Seeding is idempotent and refuses to run against a non-development project.
- [x] I3. No real member data, no real contact details, ever.
- **Gate I:** reset database → migrate → seed → app shows a usable demo state with zero manual clicking. **Passed at the data layer locally (70/70); the hosted seed run and sign-in as a demo account are still developer steps.**

**Group I — as built (v15):**

- **Dataset.** `seeds/001_fictional_players.sql` creates six clearly fictional accounts (`@example.test`, shared
  development password `mbc-demo-2026`), all four roles — Super Admin, Tournament Manager, Trainer, two Players —
  four approved profiles, one pending registration with no player record, and one suspended account. Five linked
  player records each receive 1,000 SP through `grant_starting_sp`, the same RPC approval uses, so the demo ledger
  has the shape of real data. A sixth, unlinked active player (Gabi Walkin) is included for the Phase 2 account-link
  flow and receives no SP until linked. The suspended member also gets an approved historical request.
- **Guard (I2).** The file aborts with `42501` unless `app_settings.club.environment` is exactly `"development"`.
  The owner marks the project once in the SQL Editor; the seed deliberately does not create its own permission, so
  an unmarked or production project cannot be seeded even if the file is pasted there.
- **Idempotency (I2).** Fixed ids plus `on conflict do nothing`, and the ledger's unique `player:{id}:initial` key,
  make a second run add nothing: 6 accounts, 6 identities, 6 profiles, 6 players (five linked and one unlinked),
  5 role assignments, 2 requests, and 5 initial SP rows.
- **No real data (I3).** Every seeded address ends in `example.test`, which the test asserts. The demo password is
  development-only and committed intentionally; no real member data or contact details are present.
- **Verification.** Three new checks — refusal without the marker, full dataset shape (role coverage, mixed
  statuses, pending has no player, five funded linked players, one unlinked player, reserved-domain emails), and a
  second-run no-op. Total **70/70** at Group I; the suite now has **90/90** checks after Groups K–M.
- **Hosted finding and fix (v17–v18).** The hosted walkthrough did exactly what the harness could not: GoTrue
  returned `500 Database error querying schema` for all six demo accounts, while an unknown email correctly returned
  `400 invalid_credentials`. Cause (supabase/auth#1940): GoTrue scans its token/change columns into non-nullable Go
  strings, and the seed left them NULL. A first fix that set five named columns to `''` did **not** clear the hosted
  500, so the repair is now version-proof: on every run the seed walks `information_schema.columns` for
  `auth.users` and sets **every** NULL text/varchar column on a seeded id to `''`. That avoids both a missed
  column (GoTrue's scanned set varies by version) and a hard failure if a named column is absent. Regression
  tests assert no seeded row leaves a string column NULL and that a second run repairs deliberately NULLed ones;
  hosted sign-in still needs a repair re-run to confirm.
- **Second hosted repair failure and the real field set (v19).** The text-only repair also left the hosted 500 in
  place, so the fix was driven by GoTrue's own model instead of by guesswork. `internal/models/user.go` scans, into
  **non-nullable** Go values, the strings `confirmation_token`, `recovery_token`, `email_change`,
  `email_change_token_current`, `email_change_token_new`, `phone_change`, `phone_change_token`,
  `reauthentication_token` (plus `aud`, `role`); the bools `is_sso_user`, `is_anonymous`; and the int
  `email_change_confirm_status`. A NULL in any of them raises the same unnamed
  `500 Database error querying schema` (supabase/auth#1940), so a text sweep is only part of the repair. The seed
  now runs two passes over `information_schema.columns` for `auth.users`: `''` for every text/varchar column, and
  `false`/`false`/`0` for those three non-string fields. The harness models them as nullable so the assertion
  fails if either pass is removed.
- **Unique index on `auth.users.phone` (v20).** The second hosted repair died with `23505 duplicate key value
  violates unique constraint "users_phone_key"` on `update auth.users set phone = ''`: hosted `auth.users` has a
  unique index on `phone`, so six demo rows cannot all hold the empty string. `phone` is `storage.NullString` in
  GoTrue's model, so NULL is safe; the string pass now excludes every column that carries a unique index (read from
  `pg_index`) and every generated column, and wraps each statement so a
  `unique_violation` from an expression index it cannot predict raises a notice instead of aborting the run and
  leaving every later column NULL. The harness now declares `phone text unique`, which reproduces the failure, and
  the repair test asserts `phone` stays NULL while every non-nullable field is restored.

#### Group J — Tests and docs ✅ Approved and executed
- [x] J1. Vitest configured; first tests cover `domain/` placeholders and any pure helper in `lib/format.ts`.
- [x] J2. SQL assertions for: starting SP once, approval idempotency, RLS negatives.
- [x] J3. `README.md`: prerequisites, env vars, how to apply migrations and seeds, how to run tests, how to create the first Super Admin.
- [x] J4. `backend/seeds/bootstrap_super_admin.sql` implementing **D8**: one-time `super_admin` assignment for an existing Auth account, idempotent, safe to leave in the repo, **never callable through the API** (no RPC, no Edge Function, no frontend trigger). Documented in `README.md` as a manual step run by the developer.
- **Gate J:** a new developer can go from clone to running app with seed data using only `README.md`. **Every documented command was run and passes; a genuine fresh-clone walkthrough, including the hosted seed and demo sign-in, has not been performed.**

**Group J — as built (v16):**

- **J1 — frontend tests.** Vitest covers env validation, status labels, navigation/permission unions, formatters,
  auth mapping, and the Zod schemas (52 tests). `domain/` is intentionally empty until the Phase 3 bracket engine, so
  those placeholder tests belong to Phase 3, not here.
- **J2 — SQL tests.** `npm run test:db` holds 75 assertions: schema and RLS coverage, column privileges, starting SP
  once, approval/rejection idempotency, ownership/privacy negatives, the seed (including the GoTrue token repair),
  and the bootstrap.
- **J3 — docs.** The new root `README.md` covers prerequisites, env vars, the seven-file apply order, the development
  seed, the first Super Admin, running the app, checks, and security notes. `backend/README.md` keeps the SQL-only
  detail (apply order, seeds, tests, hosted status).
- **J4 — bootstrap.** `seeds/bootstrap_super_admin.sql` requires the address through
  `set mbc.bootstrap_super_admin_email = '…'` in the same execution, so a copied file cannot grant Super Admin by
  default. It activates a pending profile (nobody exists to approve the first admin), grants `super_admin` once,
  writes one `audit_logs` row with before/after state, refuses unknown or suspended accounts, and is a no-op when
  re-run. It creates no function or endpoint; a test asserts `pg_proc` contains no bootstrap function.
- **Gate J evidence.** `npm run test:db` 75/75, `npm test` 52/52, `typecheck`, `lint`, and `build` all exit 0, and the
  README commands match the actual scripts. The hosted walkthrough then caught a seed defect the harness could not
  (see the Group I v17 note), which is exactly why the gate asks for the human path; it stays open until sign-in and
  approval are demonstrated on the hosted project.

#### Phase 1 definition of done
- Product: pending → approved → player with 1,000 SP works end-to-end and persists.
- Security: every Phase 1 table has RLS plus a negative test; no service-role key in the client.
- Quality: `typecheck`, `lint`, `test` all green; build succeeds; mobile 360px pass.
- Design: matches §3 exactly — near-black surfaces, one green accent, 1px borders, no gradients/shadows/neon.
- Docs: `README.md` complete, decisions in §7 still visible.

**Not in Phase 1:** player directory UI, tournaments, SP engine, challenges, training, jerseys, polls, announcements, seasons. Those are Phases 2–8 and will not be scaffolded early.

---

### Phase 2 — Players
Directory with search/filter, player profile (SP, history, achievements), add player without account, link approved account, role assignment, suspend/deactivate without deleting history.

#### Phase 2 groups

- [x] **K. Player lifecycle RPCs.** `migrations/004_players.sql`: `set_profile_roles` (replaces a role set, refuses empty/unknown sets and self-demotion), `link_player_account` (one approved account to one player record, idempotent), `unlink_player_account` (keeps the record and its history). All Super Admin only and audited; clients still cannot write `players.profile_id` directly. 15 new checks, 90/90.
- [x] **L. Directory and profile UI.** `/players` list with search/filter/sort, `/players/:id` profile, `/profile` self-view, add-player dialog for staff, admin role editor and post-approval link/unlink tools. All writes go through the table grants or the Group K RPCs; SP appears only on a profile, never as a directory column.

**Group L as built (v23):** `features/players/` holds the typed API, Zod form schema, and a pure search/filter/sort module. Staff see "Add player"; every approved member can browse. The profile shows the directory record, linked account (name/status only when RLS allows), roles (self or Super Admin), and the current SP balance where visible. The admin Members tab gains a "Player record" column, a multi-role editor that replaces the set through `set_profile_roles`, and link/unlink controls that call the audited RPCs. Self-demotion from Super Admin is blocked in both the UI and the database. 14 new unit tests cover player validation, filtering, and date formatting; 71/71 frontend tests.
- [x] **M. Seed, types, docs, verification.** An unlinked demo player for linking, refreshed types, README/plan updates, full check suite.

**Group M as built (v24):** The seed adds **Gabi Walkin**, an active female player with no account and no SP ledger, so a Super Admin can unlink an approved member and exercise the audited link flow. The five linked demo players keep their single 1,000 SP starting award. The seed test now distinguishes six player records (five linked, one unlinked) and proves a second run adds no record or SP row. The committed `frontend/src/types/database.ts` already covers the `players` table, its unique profile relationship, and all three Group K RPCs; because the Supabase CLI is unavailable in this environment, those signatures were checked against `migrations/004_players.sql` and the committed file remains authoritative for builds until it is regenerated against the hosted schema. README, backend README, and this plan are current. Verification: 90/90 SQL checks, 71/71 frontend tests, typecheck, lint, Prettier, and production build all clean.

### Phase 3 — Tournament engine
- `domain/bracket.ts`: single elimination (power-of-two + byes), double elimination (incl. grand final reset), round robin generator — **pure, fully unit tested first**.
- `domain/standings.ts`: Round Robin standings with the **approved D9 tie-break chain** — match wins → head-to-head → game difference → point difference → playoff. For 3+ tied participants, compute the mini-table from mutual matches first. Unit tests must cover: clean win order, two-way tie, three-way circular tie (head-to-head skipped), and a tie that reaches the playoff stage.
- `domain/tournament.ts`: entry validation including **D10 Mixed Doubles** (exactly one male + one female per team), mirrored by a database constraint.
- Tournament CRUD, events, entries, doubles teams, seeds, caps — **database gate done (migration 005); UI remains**.
- Result entry → validate → finalize → advance → recompute standings — **database gate done**; enqueue SP at 2x remains blocked by the unapproved SP formula (open rule 1).
- Bracket UI: desktop canvas, mobile round-by-round — **not started**.
- **Exit test:** the `AGENT.md` §9 tournament checklist all passing, including correction + audit behavior; a same-gender Mixed Doubles pair is rejected by the API even when forced from the client.

**Phase 3 domain engine as built (v26):** The pure layer landed before any schema or UI, so bracket and tie-break rules can be proven without a database. `domain/bracket.ts` builds single elimination for any entry count (the next power of two, byes as null slots that advance automatically without match rows), double elimination (winners, the full losers ladder, grand final, and a conditional reset placeholder), and a circle-method round robin that reports a bye per round for odd draws. Losers-round drop-ins are crossed against surviving losers so a team does not immediately replay the opponent it just left the winners bracket. `domain/standings.ts` applies D9: match wins first, head-to-head only for a two-way tie, then a mutual-match mini-table for three or more, game difference, point difference, and finally `playoffRequired` with an `unresolvedGroups` list instead of inventing an order. `domain/tournament.ts` validates the entry cap, participant counts, duplicate players and seeds, missing records, and D10 (both genders recorded; Mixed Doubles exactly one male and one female; gendered doubles match their discipline). Builders take entries already in seed order so callers can shuffle for a random draw or sort manual seeds first. 24 new tests; 95/95 frontend, 90/90 SQL, typecheck, lint, Prettier, and production build clean. Database schema, RLS, RPCs, and UI remain for the next Phase 3 gate.

**Phase 3 database gate as built (v27):** `migrations/005_tournaments.sql` adds `tournaments`, `tournament_events`, `teams`, `team_members`, `tournament_entries`, `matches`, and `match_games`. Every table is SELECT-only to clients; all writes cross audited RPCs. `create_tournament`, `create_tournament_event`, and `update_tournament_event` own the metadata rules; `set_tournament_status` enforces forward-only draft → published → in_progress → completed → archived and refuses publishing without an event. `register_tournament_entry` enforces the event cap, active player records, one entry per player, unique seeds, and D10 in one transaction, with `validate_tournament_entry()` and `validate_team_member()` as database-level backstops (a same-gender Mixed Doubles pair cannot be forced in even with a direct insert). Withdrawal keeps the row and frees the cap and seed until the draw locks entries. `save_tournament_draw` persists either engine's output in dependency order: sources must point at earlier keys, every registered entry must appear exactly once in an elimination draw, every round-robin pair must appear once, and replacement is refused once a result exists. `record_match_result` validates the game list (no level game, no split match), stores `match_games`, advances winner/loser into dependent sides, and cancels an unnecessary grand-final reset. `correct_match_result` requires a reason, rewrites the games, re-advances, and refuses when a downstream match already has a result. Migration 005 and policy 005 are verified locally at 109/109 SQL checks; the committed database types now cover all seven tables and every RPC. Hosted migration 005 and SP enqueueing remain.

**Phase 3 tournament UI as built (v28):** `features/tournaments/` is the staff console over the migration 005 RPCs, and nothing in it writes a table directly. `/tournaments` lists every tournament with a status filter and a create dialog; `/tournaments/:id` shows the record, the forward-only lifecycle actions, and one tab per event. Lifecycle controls are guarded in the UI (a start is blocked until every event has a draw) and re-checked by `set_tournament_status`. The entry dialog offers only active players not already in the event, enforces the doubles pairing and seed rules through `domain/tournament.ts` before the round trip, and lets a manager withdraw an entry until the draw locks. The draw panel converts `domain/bracket.ts` output into `save_tournament_draw` payloads (seed order or a Fisher-Yates random draw), so byes never become match rows. Results are recorded and corrected through `record_match_result`/`correct_match_result`, with the correction requiring a reason; the bracket advances from the stored winner columns rather than client state, a cancelled grand-final reset is shown as not needed, and an unnecessary reset stays pending until it is known. Round robin shows the D9 standings table (built from stored games in `results.ts`, so the tie-break stays in the domain module) beside the round-by-round schedule, and flags a required playoff instead of inventing an order. Bracket rendering is a horizontally scrollable canvas on desktop and stacked rounds below `md`, matching §3.4. Shared additions: `formatDateRange`/`formatDateTime`, and `statusLabel`/`statusTone` coverage for `in_progress`, `registered`, and `disqualified`. Eight draw-conversion tests and four standings-input tests bring the frontend suite to 110; typecheck, lint, Prettier, and production build are clean. Not covered: no hosted database has migration 005 yet, so the UI has only been exercised against types and unit tests, and SP enqueueing stays blocked by the open SP formula (open rule 1).

### Phase 4 — ShuttlePower
- Immutable ledger, `sp_rule_versions`, config-driven engine (defaults documented as **provisional**, disabled in production until approved).
- Doubles: team-average rating, deterministic rounding, documented split.
- Leaderboard (current + seasonal), personal SP history table.
- Reconciliation job: ledger sum must equal cached totals.
- **Exit test:** exactly-once awards, 2x tournament multiplier, strength-based direction, archive immutability.

**Phase 4 ShuttlePower scaffold as built (v29):** this gate ships everything the open rules allow, and nothing they forbid. `migrations/006_shuttlepower_rules.sql` adds `sp_rule_versions`: the calculation config is a JSON document (base change, strength sensitivity, per-match gain/loss caps, floor, tournament multiplier, rounding, doubles split) added one version at a time. The seeded `provisional-2026-11` row carries the proposed defaults for club review, is marked `provisional`, and is **disabled**; a CHECK constraint makes an unapproved row impossible to enable, and a partial unique index allows at most one enabled version. Clients can read rule versions and nothing else — there is no client write grant and no RPC that changes a rule. `reconcile_sp_balances()` is the Phase 4 reconciliation job in its safest form: Super Admin only, it reports every cached balance that differs from its ledger sum and never writes a repair. `domain/sp.ts` is the pure engine: it refuses to calculate unless the rule is approved *and* enabled (provisional always returns `disabled`), applies the already-approved tournament multiplier (2) on both wins and losses, derives doubles strength from the team average, caps and rounds per the config, and splits a team change into whole per-player deltas that sum exactly (equal shares, remainder to the lowest player id). `floor` is `null` while §7 rule 2 is open, and a test proves the engine does not invent one. `/shuttlepower` shows the current-SP leaderboard with shared positions for ties, the reader's own append-only ledger history, the provisional-rule notice, and — for a Super Admin — the balance check. Eighteen engine tests assert direction, caps, determinism, split sums, the disabled states, and the floor; three ranking tests cover order and ties; seven SQL checks cover the seeded rule, the enable guard, the single-enabled rule, client read-only access, reconciliation consistency, drift reporting (without repair), and authority. Deliberately not built here: the tournament award and match enqueue (blocked by §7 rule 1 at the time), and any automatic enabling of a rule. **Updated 2026-11-03:** migration 016 enables the approved `approved-2026-11` rule, and migration 017 adds the tournament award and F4 reversals, so confirmed friendlies and completed tournament matches now award SP. Migration 012's seasonal schema remains inert until a Super Admin creates and starts a season. Hosted migrations 005–006 remain.

### Phase 5 — Friendly matches
Challenge invite → accept → winner submits → loser approves/disputes → **24h server-side auto-approval** via `pg_cron` → SP awarded once with idempotency key. Notifications (in-app first). Dispute escalates to an admin-resolution status, not an invented appeals policy.

**Phase 5 friendly matches as built (v34):** `migrations/010_friendly_matches.sql` adds `friendly_matches` and enables RLS; policy 010 shows a match to its two players and to a Super Admin, and to nobody else. Six player RPCs plus the scheduled job carry the lifecycle: `create_friendly_challenge` (singles only; both players active; the opponent needs a linked account; one open match per pair in either direction, enforced by an expression unique index), `respond_friendly_challenge` (the challenged player accepts or declines), `cancel_friendly_challenge` (the challenger, before a result), `submit_friendly_result` (only the winner submits their own win; stores the server-side 24-hour due time), `approve_friendly_result` and `dispute_friendly_result` (only the losing side; a dispute needs a 5–500 character reason), and `auto_approve_friendly_matches` (any number of overdue results, idempotent because it only touches rows still awaiting approval; a signed-in caller must be a Super Admin, while the scheduler has no JWT). The migration schedules the job every 15 minutes when pg_cron is installed and skips it in the local harness. Confirmed and auto-approved results write no `sp_transactions` or `sp_accounts` row — the formula is unapproved, so the UI states that plain — and SQL tests assert the ledger is untouched. Doubles friendlies wait on §7 rule 7, and a disputed match stays disputed with its reason while §7 rule 8 is open. The UI adds `/matches` (pick an opponent, accept/decline, submit your win, confirm or dispute, see the remaining window and the dispute reason) and stops being a placeholder in the navigation. 14 new frontend tests (170 total) and 8 new SQL checks (142 total); typecheck, lint, Prettier, and build clean. Not built: notifications and any SP award. Hosted migration 010 and policy 010 remain.

### Phase 6 — Training & payments
Sessions, attendance, fee periods, manual payments with paid/partial/unpaid, own-record visibility, audited void/correction.

**Phase 6 training and payments as built (v31):** `migrations/007_training.sql` adds `training_sessions`, `training_attendance`, `training_fee_periods`, and `training_payments`. Every table is SELECT-only to clients; sessions, attendance, fee periods, payments, and voids cross audited RPCs (`create_training_session`, `set_training_session_status`, `mark_training_attendance`, `create_training_fee_period`, `record_training_payment`, `void_training_payment`) guarded by `require_training_staff()` — trainer or Super Admin. Session status is forward-only (scheduled → completed or cancelled) and a replay is a no-op. Attendance is keyed by session and player, so re-marking updates instead of duplicating, and a cancelled session refuses marks. Payments allow partials, refuse overpayment past the period fee, and are never edited or deleted: a mistake is voided with a required reason, the row stays with `voided_at`/`voided_by`, and only recorded rows count toward totals. Policy 007 gives every active member the session schedule and club-wide fee periods, while attendance and payment rows are visible to training staff and to their player only. The UI adds `/training` (staff create sessions, complete/cancel, and mark attendance per active player; players see the schedule with their own status) and `/payments` (staff create fee periods, record partial or full payments, void with a reason; players see the fee, what they paid, and their status). Both modules are now visible to every approved member, because own-record visibility is the point; the role gate stays on the writes. `features/training/money.ts` holds pure, tested helpers for centavo rounding, recorded-only totals, payment state, remaining balance, and attendance counts. 15 new frontend tests (146 total) and 8 new SQL checks (124 total); typecheck, lint, Prettier, and build clean. Not built: recurring fee generation, receipts/export, notifications, and any SP link (payments never touch SP). Hosted migration 007 and policy 007 remain.

### Phase 7 — Jerseys, polls, announcements
Projects + designs + sizes, orders with duplicate prevention and export, polls with single/multi choice, anonymity, closing, one-vote enforcement, announcements with publish/archive.

**Phase 7 club activities as built (v32):** `migrations/008_club_activities.sql` adds `jersey_projects`, `jersey_designs`, `jersey_sizes`, `jersey_orders`, `polls`, `poll_options`, `poll_votes`, and `announcements`. Every table is SELECT-only to clients. Twelve audited RPCs guarded by `require_club_staff()` (trainer or Super Admin) cover projects, designs, sizes, polls, and announcements; `submit_jersey_order` and `cancel_jersey_order` are the two player-facing writes. A project moves draft → open → closed → completed, or to cancelled, and opening requires at least one design and one size; designs and sizes can only be added while the project is draft or open. A player holds at most one active order per project (a partial unique index enforces it), cancelling frees the slot, and a closed project or a passed deadline refuses orders, with design and size checked against the project through composite keys. Polls are draft → open → closed and accept single or multiple choice; votes are stored per option, so re-casting replaces the player's whole submission, a single-choice poll refuses two options, unknown or duplicate options are refused, and a closed poll or a passed window refuses votes. `poll_results()` returns the caller's own choices, plus tallies only when the poll is closed, results are enabled, or the caller is staff, so an open hidden poll leaks no counts. Announcements are draft → published → archived, with `published_at` set once on publish. Policy 008 shows designs to members, orders to staff or their owner, polls and options to every active member while votes stay private, and published announcements to everyone. The UI adds `/jerseys` (staff create projects, add designs and sizes, open or close them, and read or export the order list as CSV; players pick a design and size, then update or cancel their order), `/polls` (staff create and open/close; players vote and see their own choice), and `/announcements` (staff draft, publish, and archive; members read published posts). `features/jerseys/csv.ts` builds the order export as a pure, tested string. Migration 009 adds `jersey_designs.image_path`, the audited `set_jersey_design_image` RPC, and the public `jersey-designs` bucket; policy 009 lets only training staff write objects. `features/jerseys/images.ts` holds the pure upload rules (PNG/JPEG/WebP, 5 MB, `designs/<project>/<image>.<ext>`), the design form accepts an optional mockup, and any design's image can be added, replaced, or removed — the replaced object is deleted only after the pointer moves. 10 new frontend tests (156 total) and 10 new SQL checks (134 total); typecheck, lint, Prettier, and build clean. Not built: notifications and stock limits beyond the per-order quantity check. Hosted migrations 008–009 and policies 008–009 remain.

### Phase 8 — Seasons & archives
Season config (timezone-aware), snapshot rankings, archive achievements, rank-based deduction per approved formula, all written to the ledger as new transactions.

**Implemented locally 2026-11-04 (migration 018); hosted apply pending.** The seasonal business rules are **S1–S23 in §7.3**: separate Current and Seasonal SP; a January 1 – December 31 season in `Asia/Manila`; an idempotent automatic transition with retry, notification, and safe recovery; fixed 40/30/20/10 SP deduction tiers by ranking position, applied to Current SP only through a Super Admin-approved batch; a defined ranking and tie-break order; and a labelled provisional leaderboard. Migration 012 built the storage layer; migration 018 implements the behaviour: `matches.finalized_at` freezes the awarding instant, `season_rankings` and `season_player_stats` compute the S12/S18 order from eligible finalized tournament matches, `season_head_to_head` breaks ties, and `close_season_internal` writes the immutable S19 snapshot with the S16/S17 reason codes. `run_season_transition` closes an ended season, creates the next one, and checkpoints each step with bounded retries and an in-app Super Admin notification; `seasonal_standings` backs the new panel on `/shuttlepower`, and `/admin/seasons` is the recovery and deduction-decision screen. `award_friendly_sp` and `award_tournament_sp` now use `active_season_for(...)` and preserve a correction's original `finalized_at`, so S6/S7 keep a late result out of the closed season and a correction in its original season. Policy 018 keeps `season_transitions` Super Admin-only. Still unbuilt: placement matches (§7.2) and SP for unplayed matches; the hosted project is not yet migrated past 017.

### Phase 9 — Quality & deployment
Full RLS matrix test, mobile + accessibility pass, Playwright on the five critical journeys (register→approve, register for tournament, submit/approve match, record payment, vote), production env, backups/export, UAT with club officers.

---

## 7. Business rules register (open decisions; rows 17–19 approved as D11/D12; rows 3–5, 10, 15, and 23 approved as S1–S15)

Architecture is settled (D1–D10). **These are club rules, not engineering choices.** Do not decide them silently, and do not tune code to a guessed answer.

| # | Topic | Current understanding | Still needs | Blocks |
| --- | --- | --- | --- | --- |
| 1 | SP win/loss formula | **APPROVED 2026-11-03 — D13:** strength-based; `clamp(20 + 0.02 × (opponent SP − player SP), 5, 40)`, 2× for tournaments. Recorded as the enabled `approved-2026-11` rule version (migration 016) | Nothing for the rule; the friendly award (migration 011) and the tournament award (migration 017) both exist | Implementation only |
| 2 | SP lower bound and ceiling | **APPROVED 2026-11-03 — D13:** minimum 0, no hard maximum initially; the enabled config sets `floor: 0` and has no `ceiling` key | Nothing for the rule; a later ceiling needs a new config key and engine support | Implementation only |
| 3 | Seasonal deduction | Higher-ranked players lose more | **APPROVED — S8 (§7.3):** fixed SP amounts by fixed ranking tier (40 / 30 / 20 / 10 SP). Originally: rank tiers and exact deduction amounts | Phase 8 implementation only |
| 4 | Rank basis for deduction | Fixed ranking **positions**, not a percentage of the population | **APPROVED — S8 and S12 (§7.3):** the tier comes from the player's seasonal ranking position (§S12), or from their last known ranking where S10/S11 apply | Phase 8 implementation only |
| 5 | Seasonal SP relationship | **APPROVED — S1 and S8 (§7.3):** Current SP and Seasonal SP are separate balances; Seasonal SP tracks net match SP gains and losses in the season; a deduction reduces **Current SP only** | Nothing for the rule; §7.3 records the full separation | Phase 8 implementation only |
| 6 | Doubles SP split | **APPROVED 2026-11-03 — D13:** split the team adjustment equally; odd point to the lower player id; team basis stays the average SP. The 0-floor/doubles interaction remains open (§7.1.6) | Nothing for the split; the near-zero floor interaction is still open | Phase 4 |
| 7 | Friendly doubles approval | Losing side approves | One losing partner or both | Phase 5 |
| 8 | Dispute resolution | Loser may dispute; an admin path exists | Who decides, and by what process | Phase 5 |
| 9 | Walkover / forfeit / DQ | Supported in tournaments. **Placement eligibility approved by D12:** walkover, no-show, forfeit before play, withdrawal before play, and DQ do not count; retirement after play counts only with an official final result | Whether and how **SP** changes for these outcomes (separate from placement eligibility) | Phases 3, 4 |
| 10 | Season boundaries | **APPROVED — S2 (§7.3): 12 months, fixed calendar year (January 1 – December 31), boundaries in `Asia/Manila`.** This supersedes the earlier "every three months" understanding; that text is retained in the document history only | Nothing for the rule; no quarterly season may be built | Phase 8 implementation only |
| 11 | Maximum SP | **APPROVED 2026-11-03 — D13:** no hard maximum initially (no `ceiling` key exists) | Nothing for the rule; revisit with a new version if the leaderboard runs away | Implementation only |
| 12 | Rounding policy | **APPROVED 2026-11-03 — D13:** half-up on the positive magnitude, rounded before the multiplier; team averages are not rounded | Nothing for the rule; `domain/sp.ts` and the friendly award use the approved order | Implementation only |
| 13 | Per-match cap vs multiplier | **APPROVED 2026-11-03 — D13:** 40 is the normal cap (pre-multiplier); 80 is the tournament-adjusted maximum | Nothing for the rule | Implementation only |
| 14 | Singles vs doubles parameters | **APPROVED 2026-11-03 — D13:** one parameter set for both | Nothing for the rule | Implementation only |
| 15 | Seasonal deduction tiers and rollover | **APPROVED — S8 and S9 (§7.3):** fixed tiers (40/30/20/10 SP by fixed position), deducted from the latest Current SP when a Super Admin approves the batch, capped at the available balance with the remainder permanently waived (no debt, no rollover); batch approval and rejection rules are in S9 | Nothing for the rule; the archive is designed in S19 (§7.3) | Phase 8 implementation only |
| 16 | 10-match placement requirement | **Proposal (§7.2):** a new player starts `UNRATED` and becomes `RATED` after 10 eligible finalized matches | Approve 10 as the requirement, or set a different count and effective rule version | Phases 4, 5 |
| 17 | Eligible match categories for placement | **APPROVED 2026-11-01 — D12.** A confirmed or auto-approved friendly, a friendly resolved in favour of a valid played result, and a completed official tournament match all count | Nothing for the categories; implementation stays gated by rules 16 and 20–25 | None — decision made |
| 18 | Exceptional outcomes and placement eligibility | **APPROVED 2026-11-01 — D12.** A match counts only if actually played and finalized. Retirement after play counts **only with an official final result**; DQ does not count by default; pending, unresolved disputes, cancelled, byes, walkovers, no-shows, forfeits before play, withdrawals before play, declined friendlies, and unplayed fixtures do not count. Historical matches count only when eligibility can be reliably verified | Nothing for the eligibility rule; applying retirement still needs a result/termination marker, and historical verification needs a method (rows 24 and 25) | None for the rule — implementation via rows 24–25 |
| 19 | Rated opponents during placement | **APPROVED 2026-11-01 — D11, Rated-side Option A: no SP change for Rated opponents during placement matches.** No gain, no loss, no ledger transaction; applies to every Rated participant, including doubles partners (§7.2.4) | Nothing for the rule itself; implementation stays gated by rules 1, 16, and 20–25 | None — decision made |
| 20 | Initial provisional SP | **Proposal:** the existing 1,000 starting SP becomes the hidden provisional balance, unchanged | Confirm 1,000 remains the provisional start after approval, or change it with a new approved rule version | Phases 1, 4 |
| 21 | Qualification transaction and concurrency | **Proposal:** one idempotent, row-locked `UNRATED → RATED` transition inside the 10th match-finalization transaction; later corrections do not un-qualify | Approve the transaction shape and the post-qualification correction/back-dating behaviour | Phase 4 |
| 22 | Placement visibility | **Proposal:** hidden from public profiles, ranking tables, and player-facing SP; only progress (`6/10`) is shown to the player; §7.2.6 explains why today's grants cannot express this | Approve who may read provisional values (e.g. Super Admin audit) and whether placement ledger rows become visible history after qualification | Phases 2, 4 |
| 23 | Placement and seasons | **APPROVED — S10 and S11 (§7.3):** a player who is Unrated at the cutoff is excluded from the seasonal ranking and receives no seasonal deduction, keeping any previous ranking; placement matches are not retroactively added to Seasonal SP; a player who becomes Unrated mid-season keeps their Seasonal SP for audit and resumes ranking eligibility if Rated again | Nothing for the rule; the snapshot is designed in S19 (§7.3) | Phase 8 implementation only |
| 24 | Historical placement compatibility | **D12 principle:** historical matches count only when their eligibility can be reliably verified. **Proposal:** never edit migrations 001–010 or the applied `provisional-2026-11` row; add rating status, placement credits, qualification, and exposure rules in a **new** approved migration and rule version. No automatic backfill; existing players backfill `RATED` unless a verified historical placement match exists | Approve the verification standard, the migration/version boundary, the backfill, and whether any historical match is actually credited | Phases 4, 8 |
| 25 | Placement finalization-state sufficiency | **Eligibility approved by D12; implementation open.** The existing friendly states (`confirmed`, `auto_approved`, `cancelled`, `disputed`) and `matches.status` (`pending`, `completed`, `cancelled`) express the ordinary path, but no state expresses retirement, walkover, no-show, forfeit, a played-then-unfinished match, or a resolved dispute | Approve whether existing states are sufficient to apply D12, or require a new result/termination marker and a dispute resolution state | Phases 3–5 |

**Rows 17–19 are no longer open.** Row 17 (eligible categories) and row 18 (exceptional outcomes) were approved on 2026-11-01 as **D12**; row 19 was approved as **D11**. They are retained in place so numbering and earlier cross-references do not shift. Rows 16 and 20–25 remain open. D11 and D12 approve only their stated scopes: the placement system as a whole, the 10-match requirement, the initial provisional value, qualification design, seasonal implementation, and the schema/RLS implementation are still **not approved**. **Rows 1, 2, 6, 11, 12, 13, and 14 are approved by D13 (2026-11-03); the SP formula is no longer an open rule.**

**Rows 3–5, 10, 15, and 23 are also no longer open.** They were answered by **S1–S15** during the seasonal decision review and are retained in place so numbering and earlier cross-references do not shift. Seasonal **implementation** — schema, scheduled job, screens, archive table — remains unapproved, and nothing is built. The design questions that were open in §7.4 are answered by S16–S23.

### Resolved since v2

| # | Topic | Decision |
| --- | --- | --- |
| D8 | First Super Admin | Auth-created account, then a one-time SQL bootstrap assigning `super_admin`. No public admin signup route, no standing bootstrap endpoint. |
| D9 | Round Robin tie-break | Order: **match wins → head-to-head → game difference → point difference → playoff match**. When three or more participants are tied, build a **mini-table from only the matches among the tied players** and apply the same order within it before moving on. Head-to-head is skipped where it cannot resolve the group (more than two tied, or results are circular). Playoff is a scheduled match, not an automatic coin-flip. |
| D10 | Mixed Doubles pairing | Exactly **one male and one female** per team. Enforced in `domain/tournament.ts` and in a database constraint on entry creation. |
| D11 | Rated opponents during placement | **No SP change for any Rated participant in a placement match** (singles or doubles): no gain, no loss, no ledger transaction, balance unchanged. The Unrated participant's provisional SP still updates and the match still counts toward placement. This intentional temporary asymmetry is recorded in §7.2.4; the placement system and the SP formula remain unapproved. |
| D12 | Placement match eligibility | A placement match counts only when an actual match was played and its result finalized. Approves the eight eligible and eleven ineligible situations, the additional conditions, and the credit rules in §7.2.2 and §7.2.5. Retirement counts only with an official final result; DQ, walkover, no-show, forfeit before play, and withdrawal before play do not count; corrections never duplicate a credit; invalidated credits are voided with an audit trail; historical matches count only when reliably verified. This approves eligibility only, not the 10-match system, the initial provisional value, the SP formula, doubles distribution, qualification design, seasons, or the final schema/RLS. |
| D13 | ShuttlePower match formula | **Approved 2026-11-03 by the club owner.** Base 20, sensitivity 0.02, clamp 5–40, floor 0, no ceiling, tournament ×2, half-up rounding before the multiplier, even doubles split with the odd point to the lower player id. Recorded as the enabled `approved-2026-11` rule version in migration 016; the applied `provisional-2026-11` row is unchanged. Approves F1–F3 of `docs/sp-formula-signoff.md`; F4 is approved separately as D14. The near-zero doubles floor interaction remains open. |
| D14 | Corrected and invalidated results (F4) | **Approved 2026-11-03 by the club owner.** A finalized result awards SP once; a change is corrected by append-only compensating `reversal` rows keyed to the original row, in the same transaction as the correction; a winner flip reverses every existing award before re-awarding; a correction re-awards under the **original** rule version; retries and replays are no-ops through the unique key; a closed season's snapshot is never rewritten. Implemented in migration 017 for tournament matches, together with the tournament award. Approves F4 of `docs/sp-formula-signoff.md`; walkover/forfeit/withdrawal/DQ SP treatment and the placement credit-count question remain open. |
| S1–S15 | Seasonal SP decisions | **Separate Current SP and Seasonal SP**; Seasonal SP resets each season, may go negative, and drives the seasonal ranking; **12-month calendar seasons** in `Asia/Manila` with an idempotent automatic January 1 transition; **fixed 40/30/20/10 SP deduction tiers** by fixed ranking position, applied to Current SP only, capped at the available balance with the remainder waived, through a Super Admin-approved batch; a defined ranking order and tie-break chain. Rules approved; **migration 012 (2026-11-02) now stores seasons, seasonal balances, the close snapshot, deduction batches, and transition checkpoints, and closes the season through an audited RPC.** Implemented locally in migration 018 (2026-11-04): the transition scheduler with retries and recovery, the Super Admin notification, the leaderboard screen, the S18 tie-break statistics, and season-aware awards; migration 018 and policy 018 still need applying to the hosted project. Summary in §7.3; the follow-up questions in §7.4 are closed by S16–S23. |

**Standing policy until each is answered:**

1. The value lives in config (`sp_rule_versions`, `app_settings`) — never hardcoded.
2. Any UI affected by it shows a visible **"provisional rule — awaiting club approval"** note.
3. No test asserts an unapproved number. Tests assert direction and invariants instead ("stronger opponent ⇒ higher gain", "ledger sum equals balance", "awarded exactly once").
4. The affected workflow ships disabled in production, not silently live.
5. When a decision is made, it is recorded here with a date and the rule version it produced.

### 7.1 Approved SP calculation rule (approved 2026-11-03)

> **STATUS: APPROVED BUSINESS RULE — IMPLEMENTED FOR FRIENDLIES AND TOURNAMENTS.** The club owner approved the formula on 2026-11-03 (D13) and F4 on the same date (D14). Migration 016 records the formula as the enabled `approved-2026-11` rule version; the applied `provisional-2026-11` row remains provisional and disabled for audit. `domain/sp.ts`, `award_friendly_sp()` (migration 011), and `award_tournament_sp()` (migration 017) use the approved order (clamp → round → multiply), and confirmed friendlies and completed tournament matches now award SP. Migration 017 also implements F4's compensating reversals, so a corrected tournament result reverses its prior rows and re-awards under the original rule version. Placement and walkover/forfeit SP remain unbuilt or unapproved; the seasonal rules are implemented locally in migration 018.

**Already implemented club rule (not a proposal, not under review):** every approved player starts with exactly **1,000 SP**, granted once by the internal `grant_starting_sp` with the unique idempotency key `player:<player_id>:initial` and recorded as an `initial` ledger row referenced to the registration. Repeated approval cannot grant it twice: migration 003 enforces that with the unique idempotency key. This section does not propose changing it.

#### 7.1.1 Approved parameters and reasoning

All values are configuration, never constants. The **Approved** column is D13 (2026-11-03); the **Provisional row** column is the older `provisional-2026-11` proposal kept for audit.

| Config key | Approved (2026-11-03) | Provisional row (disabled) | Why |
| --- | ---: | ---: | --- |
| `baseChange` | 20 | 20 | 2% of a starting rating at an even matchup |
| `strengthSensitivity` | **0.02** | 0.04 | One point per 50 SP of rating gap |
| `minGainPerMatch` | 5 | 5 | Every win records something |
| `maxGainPerMatch` | 40 | 40 | Normal win cap |
| `minLossPerMatch` | 5 | 5 | Every loss records something |
| `maxLossPerMatch` | 40 | 40 | Normal loss cap |
| `floor` | **0** (minimum SP) | `null` | No negative balances |
| `ceiling` (new key) | **none initially**, no key yet | none | No arbitrary ceiling |
| `tournamentMultiplier` | 2 | 2 | Official matches carry twice the friendly impact |
| `rounding` | **half-up** (`round` means half-up) | `round` | One explicit tie convention |
| `doublesSplit` | `even` — split the team adjustment | `even` | Doubles impact equals singles |

**Why these values:**

- **Base 20.** At an even matchup each player moves exactly 20 points, which is 2% of the 1,000 starting rating: visible on the leaderboard, but not decisive in one match. It also makes the zero-sum pair exactly ±20, the easiest invariant to test.
- **Strength sensitivity 0.02.** Each 50 SP of rating gap changes the adjustment by one point, so a 500-point gap gives +30/−10 and the clamp is reached only at a 1,000-point gap. The shipped 0.04 reaches the clamp at 500, which treats ordinary club-level differences as extreme; halving it keeps more real matches inside the informative middle of the curve.
- **Minimum 5.** A win or loss always moves something. A 0-point delta cannot be written to the ledger (`sp_delta <> 0`), and a player rated far above an opponent would otherwise gain nothing for winning.
- **Maximum 40.** One match moves at most 4% of a starting rating. It bounds upset farming; without a cap, the same curve would move 60 points at a 2,000-point gap.
- **Tournament 2×.** This is the club's confirmed rule that official matches carry twice a friendly's impact; it is already used by the shipped engine and is not proposed here.
- **Minimum SP 0.** Keeps the balance readable and prevents a negative rating that no leaderboard or strength comparison can interpret. The cost is explicit: a loss that would pass zero is truncated, so a floor breaks exact SP conservation (7.1.4). This is the approved floor.
- **No hard maximum initially.** The club has no evidence for a ceiling, and an arbitrary one would penalise the strongest players on arrival. Revisit with a versioned change if the leaderboard becomes runaway. There is no `ceiling` key today, so a later ceiling needs a new config key and engine support; JSONB config alone is not enough.
- **Half-up rounding.** One deterministic convention for wins and losses, applied to the positive magnitude before the sign. Half-up is also what SQL `round()` and JavaScript `Math.round()` do for positive values, so a server calculation and any test agree; banker's rounding would turn 20.5 into 20.
- **Split the team adjustment.** Keeping a doubles match's combined impact equal to a singles match is explained in 7.1.6.

#### 7.1.2 Formula and approved operation order

Let `S_p` be the player's SP and `S_o` the opponent's SP, both immediately before the match. `clamp(v, lo, hi) = min(max(v, lo), hi)`.

```
WIN  gain   G = clamp(20 + 0.02 × (S_o − S_p), 5, 40)
LOSS loss   L = clamp(20 + 0.02 × (S_p − S_o), 5, 40)

result: win → +G, loss → −L
```

`G` and `L` are magnitudes; the ledger delta is positive for a win and negative for a loss.

**Approved operation order (D13, 2026-11-03):**

1. Calculate the normal gain or loss from the two ratings.
2. Apply the normal minimum and maximum clamp (5 and 40).
3. Round the clamped value **half-up** to a whole point.
4. Apply the tournament multiplier (friendly 1×, official tournament 2×).

Consequences of that order:

- The **normal match cap is 40 SP**, and the **tournament-adjusted maximum is 80 SP**. The normal minimum is 5, so the tournament-adjusted minimum is 10.
- Under this order every tournament change is exactly twice the rounded friendly change, and therefore always an even number.
- 40 is a **pre-multiplier cap**, not an all-match cap; D13 approved that scope (§7 rule 13).
- Before D13 the engine clamped, multiplied, then rounded, so the two orders did **not** produce identical numbers. The two orders disagree wherever doubling crosses a rounding boundary that rounding first would have avoided: a 13-point gap (raw 20.26) gave **41** under the old engine against **40** under the approved order, and a 25-point gap (raw 20.5) gave **41** against **42**. Across gaps 0 to +2,000, **500 of 2,001 gaps differ by one point** (875 of 4,001 across the full ±2,000 range). The engine was updated on 2026-11-03 to clamp, round, then multiply. Friendly numbers are identical because the multiplier is 1; only official tournament matches move. The approved order therefore changes tournament results by up to 1 point versus the old engine (7.1.4 #6).

**Doubles.** Team SP is the arithmetic mean of the two partners' SP — the approved team-strength basis, unchanged. Compare the two means with the same formula, then distribute the team adjustment as described in 7.1.6.

#### 7.1.3 Worked examples

The eight approved examples recompute exactly as shown. The tournament column applies 2× after rounding.

| Player SP | Opponent SP | Result | Raw value | Clamped | Normal change | Tournament |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 1,000 | 500 | Win | 20 + 0.02 × (−500) = 10 | — | **+10** | +20 |
| 1,000 | 500 | Loss | 20 + 0.02 × 500 = 30 | — | **−30** | −60 |
| 1,000 | 1,000 | Win | 20 | — | **+20** | +40 |
| 1,000 | 1,000 | Loss | 20 | — | **−20** | −40 |
| 1,000 | 1,500 | Win | 20 + 0.02 × 500 = 30 | — | **+30** | +60 |
| 1,000 | 1,500 | Loss | 20 + 0.02 × (−500) = 10 | — | **−10** | −20 |
| 1,000 | 2,000 | Win | 20 + 0.02 × 1,000 = 40 | at max | **+40** | +80 |
| 1,000 | 2,000 | Loss | 20 + 0.02 × (−1,000) = 0 | raised to 5 | **−5** | −10 |

Additional boundary cases the proposal implies but does not list:

| Player SP | Opponent SP | Result | Raw value | Normal change | Why it matters |
| ---: | ---: | --- | ---: | ---: | --- |
| 1,000 | 200 | Win | 4 | **+5** | Exercises the lower clamp on a win |
| 1,000 | 2,500 | Win | 50 | **+40** | Exercises the upper clamp; the table stops at exactly 40 |
| 1,000 | 1,025 | Win | 20.5 | **+21** | Fractional result; approved half-up |
| 1,000 | 975 | Loss | 20.5 | **−21** | Same, on the loss side; the sign follows the rounded magnitude |

Doubles worked example: team A is 1,000 and 1,200 (average 1,100); team B is 1,300 and 1,500 (average 1,400). A wins. `G = 20 + 0.02 × (1,400 − 1,100) = 26`, and B's loss magnitude is the same 26. **Approved distribution:** split each team's 26 into +13/+13 and −13/−13 (7.1.6), so the team totals remain +26 and −26 and total SP is unchanged.

#### 7.1.4 Consistency checks

1. **All eight approved examples are arithmetically correct.** Row 7 lands exactly on the 40 maximum; row 8 (raw 0) is the only case that relies on the lower clamp.
2. **The formula is exactly zero-sum while no floor applies.** The winner's gain and the loser's loss are the same expression evaluated on `S_loser − S_winner`, so the pair is always `+d` and `−d`. This is not ELO — there is no expected-score probability — but it does mean the curve conserves SP rather than redistributing it. The approved minimum SP of 0 deliberately gives up exact conservation only when a loss is truncated at zero.
3. **Zero-sum depends on symmetric caps and no floor.** Different gain and loss caps, or a non-zero floor, break it. The approved rule keeps the gain and loss caps symmetric (5–40 both) and adds a 0 floor, so the trade-off is explicit rather than accidental.
4. **Saturation is reachable and not symmetric in rating gaps.** The adjustment leaves the linear range above `S_o − S_p = +1,000` (gain 40) and below `−750` (gain 5). A 2,000-point gap therefore moves the same 40 points as a 1,000-point gap. The disabled `provisional-2026-11` row's 0.04 coefficient would have saturated at a 500-point gap (gain) and −375 (loss); the approved 0.02 coefficient doubles the usable strength range before clamping.
5. **The loss curve is the same curve read from the loser's side.** Losing to a stronger opponent costs less (10 in row 6), losing to a weaker one costs more (30 in row 2). That direction matches `AGENT.md` §4.4 and the existing scaffold.
6. **The approved order of operations changed tournament numbers.** (Corrected 2026-11-02 after the technical review; the earlier text claimed the two orders agreed at 2×.) The old engine clamped, multiplied, then rounded; D13 approved clamp, round, then multiply, and `domain/sp.ts` was updated on 2026-11-03. Both still treat 40 as a pre-multiplier cap and reach 80 in a tournament, but the arithmetic is not equivalent: `round(2x)` and `2·round(x)` disagree whenever the fractional part of `x` is small enough that `2x` crosses a boundary, which is about half of all rating gaps inside the 5–40 clamp (875 of the 1,751 gaps from −750 to +1,000; 875 of 4,001 across ±2,000). Worked cases: a 13-point gap (raw 20.26) gave 41 under the old engine against 40 under the approved order; a 25-point gap (raw 20.5) gave 41 against 42. Friendly results are unaffected because the multiplier is 1. The club was told this was "up to 1 point different on tournament matches" before approval, and the order is recorded in the `approved-2026-11` rule version. §7 rule 13 records the separate question of whether 40 should instead be an all-match cap; D13 approved the pre-multiplier scope.
7. **The approved rule changes one shipped parameter and adds a floor.** D13 created a **new** rule version with `strengthSensitivity: 0.02` and `floor: 0`; migration 006 and its disabled `provisional-2026-11` row are already applied to the hosted project and were not edited. The engine already read the coefficient and floor from config, so those two values needed no code change.
8. **Doubles already splits in the scaffold.** The shipped engine uses `distributeEqually`, which matches the approved split; the remaining open question is the interaction with the 0 floor, not the distribution direction.
9. **Half-up is unambiguous on magnitudes, and the shipped engine already behaves that way.** Rounding the positive value first and applying the sign afterwards gives 20.5 → 21 and −20.5 → −21; banker's rounding would give 20 in both cases. `roundMagnitude` already uses `Math.round` on the positive magnitude, so D13 records the convention in the rule version rather than changing behaviour. The sign must never be part of the rounding input.
10. **Odd splits preserve the exact team total.** A +25 team adjustment becomes +13/+12 and a −25 adjustment becomes −13/−12; each pair sums exactly to the adjustment, so no SP is created or destroyed by the split itself.
11. **Normal and tournament caps are distinct.** Normal cap 40 → tournament-adjusted maximum 80; normal minimum 5 → tournament-adjusted minimum 10. A tournament result therefore moves 10–80 points, never 5–40.
12. **The 0 floor can prevent a ledger row.** A player at exactly 0 SP receiving a loss moves 0, and the ledger rejects a zero delta (`sp_delta <> 0`). The engine's `applyFloor` already drops a zero share, so the awarding RPC must treat a missing delta as "no row" rather than an error. The floor itself is approved; this remains an implementation requirement for the awarding RPC.

#### 7.1.5 Edge cases

1. **Starting SP.** 1,000 per player, once. Aggregate SP grows only when a new player is funded, and the ledger must be reconciled before any award is computed.
2. **Equal ratings.** ±20; the simplest sanity check for any implementation.
3. **Extreme gaps.** Beyond +1,000 / −750 the curve is flat, so an upset against a far stronger player still pays only 40 and a loss to a far weaker player costs only 5.
4. **Fractional results.** `0.02 × 25 = 0.5` produces a half point (e.g., 20.5). The approved rule fixes this as half-up (21), applied to the positive magnitude before the sign; half-even would give 20. A half point can decide a leaderboard tie, so the convention is recorded in the rule version.
5. **Doubles averages.** Averages can be fractional (1,000 and 1,001 → 1,000.5). Using the exact mean, or rounding each team average first, can change the resulting delta by 1 point at a clamp or rounding boundary.
6. **Doubles amount.** The approved split halves the team adjustment per partner, so a doubles match moves the same combined total as an equivalent singles match (7.1.6). The rejected alternative — the full adjustment to each partner — would double the team total.
7. **Floor / negative SP.** The approved rule sets minimum SP to 0, so a balance cannot go negative. The cost is explicit: a loss that would pass zero is truncated (a player at 4 SP losing 20 moves only −4), a player at exactly 0 would move 0 and therefore cannot receive a ledger row, and the opponent's gain can then exceed the loser's loss. Conservation is given up only in that case, and D13 accepted that trade-off.
8. **No maximum initially.** The approved rule leaves the ceiling open. An undefeated player can climb without bound, which eventually makes the leaderboard less competitive and pushes a runaway leader's losses to the 40 cap; adding a ceiling later needs a new config key and engine support.
9. **Lopsided matches move very little when the favourite wins.** A 2,500-rated player beating a 1,000-rated player gains 5 and the loser drops 5; the reverse upset moves 40 each. The incentive is deliberate, and the pair still moves the same magnitude, so there is no within-match accounting asymmetry.
10. **Walkovers, forfeits, withdrawals, disqualifications.** No rule is approved; therefore no SP may move for them. Tournament matches that are cancelled or never played award nothing. This is the open F4 scope.
11. **Disputes and voids.** No SP until a result is official. A disputed friendly has no confirmation, so it cannot award; a correction must be a new ledger row, never an edit.
12. **Duplicate processing.** Submission, approval, auto-approval, a retried job, or two concurrent approvals must not award twice. The ledger already enforces this with a unique `idempotency_key`; the award key should be `match:<match_id>:<player_id>` and the awarding RPC must be idempotent under retry.
13. **Stale balance cache.** Awards must read the ledger-reconciled balance (or lock the account row) so two matches finishing at once cannot both spend the same cached value.
14. **Rule version drift.** A match approved after a rule change must record the version that actually computed it (`rule_version` on the ledger row).
15. **Manual adjustment.** Trainers and managers must never set SP directly; there is no such grant today, and corrections are new `correction`/`reversal` rows.
16. **Seasonal deduction.** Must stay a separate `season_deduction` transaction referenced to a season, never folded into match calculations (§7 rules 3–5, 10).
17. **Friendly doubles.** Undefined until §7 rule 7 is answered; only singles friendlies ship.
18. **Splitting at the floor.** If one partner is clamped at 0 while the other is not, the team total no longer equals the team adjustment. Whether the other partner's share is reduced (preserving the team total) or left as calculated is still open; D13 approved the split, not this interaction.
19. **Exact arithmetic.** `0.02 = 1/50`, so the normal value is `(1,000 + rating gap) / 50`; the clamp and half-up result can be computed with integer arithmetic server-side. Relying on binary floating point can turn a true `.5` boundary into `.4999…` and flip a rounding decision.

#### 7.1.6 Doubles distribution (approved split; floor interaction open)

**Approved rule (D13):** compute one team adjustment from the two team averages, then **split it equally between the partners**. Each partner's rating moves half the team adjustment, and the combined team change equals the computed adjustment.

Worked example: team adjustment +26 SP → Partner A +13, Partner B +13, team total +26. A loss of 26 → −13 and −13, team total −26.

**Why split instead of giving each partner the full adjustment:** the full-adjustment reading would move +52 for that same match, making a doubles match worth twice a singles match in combined SP. That rewards format rather than result, lets pairs climb faster than singles players of equal strength, and breaks the intuitive rule that one match has one impact. Splitting keeps a doubles match's combined effect equal to an equivalent singles match, which is also what the shipped `distributeEqually` already does.

**Odd team adjustments.** A +25 team adjustment cannot be divided into two whole points (12.5 each). The approved deterministic rule:

1. Work with the magnitude only: `base = floor(25 / 2) = 12`, `remainder = 1`.
2. Give the extra point to the partner whose **player id sorts first under a byte-order comparison** (the database's `ORDER BY player_id`), applied to both teams. This does not depend on names, join order, or which partner was entered first.
3. Apply the sign after the split.

Results: +25 → **+13 / +12**; −25 → **−13 / −12**. Each pair sums exactly to the team adjustment, so no SP is created or destroyed, and the choice is repeatable and auditable from the ledger.

**Team rating basis:** still the arithmetic average of the two partners' SP. Do **not** round that average before the formula — compute the team adjustment from the exact mean, round the team adjustment once (half-up), then split. Rounding the averages first adds a second rounding step and can shift the result by a point.

**Interaction with the 0 floor.** Clamp each partner after the split. If one partner's share is truncated at zero, the team total falls below the team adjustment; whether the other partner's share is reduced to compensate (preserving the team total) or left alone remains open (7.1.5 #18).

**Server-side only.** The split and remainder assignment must be computed by the awarding RPC, never by the browser, so two clients cannot disagree and the ledger is the only record. Order partners with a stable database ordering (e.g. `ORDER BY player_id` under a deterministic collation), not a locale-sensitive client sort, so the same match always gives the same partner the extra point. The JS helper previously used `localeCompare`, which varies with the runtime's ICU data; it now uses a plain code-unit comparison and a test pins the mixed-case case, so the client and the server agree on which partner receives the odd point. This fixes the comparison only — it does not decide the filtered case described in §7.2.4 (the odd point when one partner is Rated and therefore receives nothing), which is still open.

#### 7.1.7 Ledger contract (already available)

The approved rule's required fields already exist on the append-only `sp_transactions` table. No schema change is needed to record an award later.

| Requirement | Column / mechanism | Status |
| --- | --- | --- |
| Value before / delta / after | `sp_before`, `sp_delta`, `sp_after` + `sp_before + sp_delta = sp_after` check | Exists |
| Reason | `transaction_type` (`friendly` / `tournament`) plus `metadata` detail | Exists (no dedicated `reason` column) |
| Match reference | `reference_type = 'match'`, `reference_id` | Exists |
| Rule version | `rule_version` | Exists |
| Timestamp | `created_at` | Exists |
| Idempotency key | `idempotency_key`, unique | Exists |
| Who recorded it | `created_by` | Exists |
| Immutability | update/delete/truncate blocked by triggers | Exists |
| Duplicate prevention | unique key + idempotent RPC (friendly and tournament awards built) | **Both built** |
| Historical replay | `rule_version` on each row + append-only table | Exists; a new version must never rewrite old rows |
| Zero-delta player at the floor | no row when the clamped delta is 0 (`sp_delta <> 0`) | Approved; the awarding RPC must treat a missing delta as "no row" (7.1.5) |

#### 7.1.8 Decision register (formula and F4 approved; walkover SP and edge cases open)

Rows 1–6, 10, and 12 are approved by D13 and D14 (2026-11-03). Row 7 (walkover/forfeit SP) and the residual items in row 11 remain open; recommendations are recorded above but are **not** decisions.

| # | Decision | Detail | Blocks |
| --- | --- | --- | --- |
| 1 | Final formula parameter approval | **APPROVED 2026-11-03 — D13:** base 20, coefficient 0.02, 5–40 normal clamp, 2× tournament multiplier, half-up rounding | Implementation only |
| 2 | Minimum and maximum SP | **APPROVED 2026-11-03 — D13:** minimum 0, no hard maximum initially; the floor's truncation behaviour is accepted | Implementation only |
| 3 | Tournament cap behavior | **APPROVED 2026-11-03 — D13:** 40 is the normal (pre-multiplier) cap and 80 the tournament-adjusted maximum | Implementation only |
| 4 | Singles vs doubles parameters | **APPROVED 2026-11-03 — D13:** one shared parameter set | Implementation only |
| 5 | Doubles adjustment distribution | **APPROVED 2026-11-03 — D13:** split the team adjustment; the rejected alternative was the full adjustment to each partner | Implementation only |
| 6 | Doubles odd-number rounding policy | **APPROVED 2026-11-03 — D13:** remainder to the lower player id, sign applied after the split; team averages are not rounded. The 0-floor interaction remains open (7.1.5 #18) | Phase 4 — floor interaction only |
| 7 | Walkover / forfeit / withdrawal / DQ | No **SP** rule approved; no SP may move for a walkover, forfeit, withdrawal, or disqualification. F4 (D14) covers a **played** result that is later corrected or invalidated, not an unplayed match. Placement eligibility for these outcomes is approved in §7.2.2 (walkover, no-show, forfeit before play, withdrawal before play, and DQ do not count; retirement after play is approved but blocked) | Phases 3, 4 |
| 8 | Seasonal deduction target balance | **APPROVED — S8 (§7.3):** Current SP only. A seasonal deduction never reduces Seasonal SP | Phases 4, 8 — implementation only |
| 9 | Seasonal deduction tiers and rollover | **APPROVED — S8 and S9 (§7.3):** fixed 40/30/20/10 SP by fixed position, applied to the latest Current SP at batch approval, capped at the available balance, remainder permanently waived (no rollover, no debt). Archive retention is settled by S19 (§7.3): permanent | Phase 8 — implementation only |
| 10 | Rounding tie-breaking policy | **APPROVED 2026-11-03 — D13:** half-up on the magnitude before the sign, rounded before the multiplier; integer arithmetic must replace float boundaries | Implementation only |
| 11 | Additional edge cases from review | Floor truncation (zero delta, team total), duplicate/concurrent awards, rule-version drift, disputed/void results, stale balance cache, friendly doubles eligibility. The floor, split, rounding, tournament idempotency, and F4 voids are approved and implemented; the team-total-at-floor case, walkover SP, and friendly doubles remain open | Phases 4, 5 |
| 12 | Corrected and invalidated results | **APPROVED 2026-11-03 — D14, implemented in migration 017:** compensating `reversal` rows only, keyed to the original row, written in the same transaction as the correction; a winner flip reverses then re-awards; the re-award uses the original rule version; a closed season's snapshot is never rewritten; the SP side of a void resolves to Option R. The placement credit-count question in §7.2.5 stays open | Nothing for a played result; walkover/forfeit SP (row 7) and the placement credit count remain open | Phase 4 — done for tournaments |

#### 7.1.9 Approval procedure

A printable, owner-facing summary of every open number is kept at `docs/shuttlepower-decision-brief.md`. It is a
convenience copy with a sign-off table, not the authoritative record; this section and the §7 register are.

A focused package for the formula alone — §7 rules 1, 2, and 6, with the exact rule-version configuration and the
list of what is still missing before an award can run — is `docs/sp-formula-signoff.md`. It is the shortest path to
approving SP awards, because it excludes placement, unplayed matches, and disputes.

Until every number above is approved, the workflow stays disabled. D13 completed steps 1–5 for **friendly** matches on 2026-11-03, and D14 plus migration 017 completed them for **tournament** matches, including corrections/reversals. Placement and unplayed-match SP remain. Approving the formula is a deliberate, recorded act:

1. Record the decision here with the date, the approver, and the exact parameters, including the floor, rounding convention, and doubles remainder rule. **Done — D13 and D14, 2026-11-03, club owner.**
2. Insert a **new** `sp_rule_versions` row marked `approved` but **disabled**, carrying those parameters. The applied `provisional-2026-11` row is never edited, so existing calculations stay auditable against their original version. **Done — migration 016 inserts `approved-2026-11`; it was enabled in the same reviewed migration.**
3. Implement the approved operation order (clamp → round → multiply), the half-up definition, and the doubles split/remainder rule in `domain/sp.ts` and the awarding RPC. These are code changes; the coefficient and floor already exist in config, but ordering and remainder rules do not. **Done for the engine and both awards.**
4. Enable the approved version in a separate reviewed step (one enabled version at a time is already enforced). **Done — `approved-2026-11` is the single enabled row.**
5. Implement the awarding RPC for the owning match source with the idempotency key, ledger fields, and tests for exactly-once processing. **Done for friendlies (`award_friendly_sp`, migration 011) and tournaments (`award_tournament_sp`, migration 017).**
6. Only then may a match move SP. **Confirmed friendlies and completed tournament matches now move SP; placement and unplayed matches still do not.**

#### 7.1.10 Seasonal rules (approved as S1–S23; implemented in migration 018)

> **UPDATED during the seasonal decision review; implementation status corrected 2026-11-04.** The seasonal business
> rules that this subsection listed as unresolved are now approved as **S1–S23 in §7.3** and implemented in migration
> 018. The original text below is retained for history; where it conflicts with §7.3, §7.3 governs. Specifically: the
> Current SP / Seasonal SP separation is now a **confirmed club rule** (S1), a deduction applies to **Current SP only**
> (S8), and the boundaries, tiers, and deduction amounts are settled (S2, S8). Migration 012 built the seasonal schema
> and lifecycle RPCs; migration 018 adds the ranking computation, the S19 snapshot, the S20 transition job with
> retries and recovery, the seasonal leaderboard, and the S6/S7 award guards. Placement matches and SP for unplayed
> matches remain unbuilt.

Seasonal scoring is **not** part of the SP formula rule, and nothing here authorizes building it. The following constraints must survive any later approval:

- **Current SP and Seasonal SP stay conceptually separate.** `AGENT.md` describes Current SP as the persistent competitive rating used to compare strength, and Seasonal SP as the points earned inside a season for the seasonal leaderboard. That separation is a recommended design, not a confirmed club rule. **Superseded: S1 (§7.3) confirms the separation as an approved club rule, including that Seasonal SP resets each season while Current SP carries over.**
- **Season history and snapshots are preserved.** A season archive is an immutable snapshot of final position, SP, and achievements; completed seasons and their ledger rows are never rewritten by a reset, a deduction, or a later rule version.
- **Rank-based deduction remains unresolved.** The club has confirmed that current SP is not reset to zero and that higher-ranked players lose more, but the tiers, the exact amounts, and the rank basis are open. **Resolved by S8 and S12 (§7.3): fixed tiers of 40 / 30 / 20 / 10 SP by fixed ranking position, with the ranking order and tie-break chain in S12. S2 also confirms that Current SP carries over while Seasonal SP resets.**
- **The balance a deduction applies to must be explicitly approved.** Current SP, Seasonal SP, or both is unresolved; a deduction must be a new `season_deduction` ledger row referenced to a season, never an edit. **Resolved by S8 (§7.3): Current SP only. S9 requires every deduction to be linked to its originating season and applied exactly once, and the ledger-row requirement below stands.**
- **Tier amounts, deduction timing, rollover behaviour, and archive retention require separate decisions** before Phase 8.
- **Seasonal scope is now implemented locally.** **Updated 2026-11-04:** migration 012 built the tables and lifecycle RPCs; migration 018 adds the S18 tie-break statistics, the S19 snapshot, the S20 transition job with retries, notification, and recovery, the seasonal leaderboard, and the S6/S7 award guards. Policy 018 keeps transition rows Super Admin-only. Migration 018 is local only; apply it to the hosted project after 017 and before policy 018. Placement matches and unplayed-match SP remain unbuilt.

#### 7.1.11 Corrected and invalidated results (approved 2026-11-03 — D14, implemented in migration 017)

> **STATUS: APPROVED BUSINESS RULE — IMPLEMENTED FOR TOURNAMENT MATCHES.** The club owner approved F4 on 2026-11-03
> (D14). Migration 017 adds `reverse_tournament_sp()` and supersedes `correct_match_result()`, so a winner-flip
> correction reverses its prior rows and re-awards under the original rule version in the same transaction; a
> score-only correction that keeps the winner writes no SP rows.
> The friendly award still has no correction path because a confirmed friendly cannot be corrected; if that changes,
> the same helper pattern applies. Walkover/forfeit/withdrawal/DQ SP remains unapproved.

**Core rule.** A finalized result awards SP **once**. If the result later changes, SP is corrected by **compensating
rows only**: the ledger is append-only, so no row is edited or deleted, and the compensation is written in the **same
transaction** as the correction itself.

| Change to a finalized result | Award rows | Compensation |
| --- | --- | --- |
| Winner unchanged, scores or games changed | None | None — the change moves no SP |
| Winner flipped | One new award per player for the corrected result | Every existing award on that match reversed first |
| Match invalidated, cancelled, or voided | None | Every award on that match reversed |
| Result submitted or approved twice (retry, replay, auto-approval) | No second row | None — the unique key makes the replay a no-op |
| Correction to a match awarded under a superseded rule version | One award under the **original** version | The original row reversed |

**Reversal row shape.** `transaction_type = 'reversal'` (already permitted by `002`), `reference_type = 'correction'`,
`reference_id = <original transaction>`, `sp_delta = −(original delta)`, `metadata.original_transaction_id = <original row>`, `metadata.original_key`, `metadata.match_id`, the
**original** row's `rule_version`, and its own idempotency key. It is an ordinary ledger row: it must satisfy
`sp_before + sp_delta = sp_after` and `sp_delta <> 0`; a reversal is clamped so the balance never falls below 0.

**Idempotency keys.**

- Award: `tournament:<match_id>:<player>` for the first award, then `tournament:<match_id>:<player>:2`, `:3`, … for each re-award after a reversal generation.
- Reversal: `<original_key>:reversal`.

The reversal key derives from the **row it negates**, not from the match. A second correction of the same match
therefore cannot reverse the same award twice, and a winner flip that is later corrected back still nets to zero for
every player.

**Which rule version re-applies.** A correction re-awards under the rule version recorded on the **original** award,
never the currently enabled one. Consequences: a formula change never restyles completed matches, correcting an old
result cannot silently apply this season's numbers, and every ledger row stays replayable against the version that
produced it.

**Balance and ordering.** The correction locks the affected account rows, reads the stored balance, and writes the
reversal and the new award in one transaction. A partial failure rolls back both, so a player can never hold a stale
award, and no compensation is computed from a client-supplied balance.

**Placement (D11) is unchanged.** An Unrated player's reversal moves only their hidden provisional balance and is
hidden the same way every other provisional row is; a Rated participant has no row to reverse, because D11 never
writes one. For the **SP** side this settles the contradiction recorded in §7.2.5 rule 4: a voided match's SP is
removed by a reversal row (**Option R**). The **placement-credit count** in that rule — whether the credit is voided
or kept — remains a separate open question and is not decided here.

**Closed seasons (S7, S19).** A correction to a match finalized in a closed season adjusts **Current SP**, leaves the
closed season's Seasonal SP and ranking untouched, and never rewrites the published snapshot.

**Not permitted.** No editing or deleting a ledger row, no manual SP, no "repair" row invented by reconciliation, and
no reversal without a recorded reason, actor, and timestamp.

**Tests required before the awarding RPC ships.**

1. Correct a completed match without flipping the winner — each player's delta sum is unchanged.
2. Flip the winner — each player's sum equals the **new** result only, with one reversal and one award.
3. Invalidate a finalized match — both sides net to zero and the balance returns to its pre-match value.
4. Replay the correction or the auto-approval job — no second row for any player.
5. Correct a match from a closed season — Current SP moves, Seasonal SP and the snapshot do not.

### 7.2 Unrated players and the 10-match placement system (eligibility approved by D12; system still unapproved)

> **STATUS: PARTIALLY APPROVED — the placement system as a whole remains NOT APPROVED.** Two decisions are approved: **D11**, the Rated-side rule in §7.2.4 (no SP change for Rated participants), and **D12**, the Placement Match Eligibility Policy, both approved 2026-11-01. D12 approves the core eligibility principle, the eight eligible and eleven ineligible match situations, the additional conditions, and the placement credit rules recorded in §7.2.2 and §7.2.5. D12 does **not** approve the 10-match requirement, the initial provisional SP value, qualification and concurrency design, seasonal rules, or the final schema/RLS implementation. The §7.1 formula and even doubles split are approved separately by D13 (2026-11-03). The rest of this section remains unapproved. This section documents the club's selected direction, **Option A — Hidden Provisional SP**, for the remaining approvals. It is documentation only: no source file, SQL migration, SP engine, rule configuration, test, screen, seed, or database row was changed by this revision, and nothing was staged or committed. The current implementation still behaves as before — registration approval grants 1,000 SP once, the balance is stored in `sp_accounts.current_sp`, and every club member can read it under `policies/003_shuttlepower.sql`. Until the club approves the remaining decisions in this section, no placement status, hidden balance, placement count, or qualification can exist in the running system.

#### 7.2.0 The selected approach

Option A keeps the competitive number continuous from a player's very first match while keeping it out of public view until the sample is meaningful:

- A new player is publicly **Unrated**.
- Their provisional SP is maintained internally from the first eligible finalized match.
- It is hidden from public profiles, ranking tables, and ordinary player-facing SP displays.
- The player sees placement progress (for example `6/10 matches`), not the number.
- At the 10th eligible finalized match the player becomes **Rated**, and the accumulated value is published exactly as calculated — no reset, no bonus, no recomputation.

**Selection status versus approval status.** On 2026-11-01 the club selected Option A as the direction to document. That selection is why this section exists, but it is **not** a business-rule approval, not a decision to change the database, and not authorization to build anything. The rules below become binding only through a recorded approval of the kind described in §7.1.9, including a new rule version and a separate reviewed activation.

**Two sub-decisions are approved.** On 2026-11-01 the club approved **D11**: a Rated participant receives no SP change in a placement match (§7.2.4). It also approved **D12**: the Placement Match Eligibility Policy in §7.2.2 and the placement credit rules in §7.2.5. Those are the only approved parts of §7.2. The placement system as a whole, the 10-match requirement, the starting provisional value, visibility, qualification, the D11 Unrated-share question, seasons, and the schema/RLS design remain **not approved**; the §7.1 formula and even split are approved by D13.

Only Option A is in scope here. Its interaction with the approved §7.1 formula is addressed in §7.2.3 and §7.2.9.

#### 7.2.1 Player status

| State | Meaning | Public SP | The player sees |
| --- | --- | --- | --- |
| `UNRATED` | approved player with fewer than 10 eligible finalized matches | hidden | placement progress (`6/10 matches`) |
| `RATED` | 10 eligible finalized matches reached; qualification complete | official current SP | own SP and own ledger per the existing rules |

Documented rules:

1. A new player starts with status `UNRATED`.
2. The player must complete **10 eligible matches** to become `RATED`.
3. During placement the system internally maintains provisional SP.
4. Initial provisional SP is **1,000**, subject to the existing starting-SP implementation (`grant_starting_sp`, migration 003, key `player:<player_id>:initial`) and to a future approved migration or rule-version change.
5. Provisional SP is hidden from public profiles, ranking tables, and ordinary player-facing SP displays.
6. The player may see their placement progress, such as `6/10 matches`.
7. After the 10th eligible match is finalized, the system changes the player's status to `RATED`.
8. Their accumulated provisional SP becomes their visible official SP, unchanged.
9. Normal SP rules apply after qualification.

Additional proposals (still unapproved):

10. **Rating status is not membership status.** `players.status` is constrained to `active`, `inactive`, and `suspended` and describes the club relationship; overloading it with `unrated`/`rated` would break existing filters, suspension behaviour, and RLS predicates. A separate rating-status field or record is proposed (§7.2.7).
11. **Placement ends once per player.** Qualification is permanent; later corrections, voids, or additional matches do not return a player to `UNRATED` (open details in §7.2.5 and §7.2.10).
12. **No placement bonus.** Qualification itself awards nothing; the visible SP is exactly the sum already accumulated.
13. While `UNRATED`, the player is omitted from official SP standings and is labelled `Unrated` with progress in the directory. Their match history remains visible under the normal match rules.
14. The directory label and progress display must not reveal the number, including through ordering, percentages, or placeholders derived from the balance.

#### 7.2.2 Eligible matches and counting — APPROVED 2026-11-01 (D12)

> **APPROVED 2026-11-01 — D12 (eligibility and credit rules only).** This subsection is the approved placement-match eligibility policy. D12 does **not** authorize implementation: no credit table, eligibility check, RPC, test, or screen exists, and applying retirement still requires a result/termination marker (row 25). The 10-match requirement (row 16), the initial provisional value (row 20), the SP formula (§7.1), doubles distribution, qualification design, seasons, and the final schema/RLS remain unapproved.

**Core principle (approved).** A placement match counts **only when an actual badminton match has been played and its result has been finalized through the applicable match workflow.** Recording a fixture is not enough: a challenge, a scheduled tie, a bye, or an unplayed entry is not a match. "Finalized" means the result has reached the state the existing workflow already treats as final — friendly `confirmed` or `auto_approved`, tournament `completed` — not merely submitted, accepted, scheduled, or entered.

Both friendly matches and official tournament matches may qualify; this is approved by D12 (§7 #17). A match is a **placement match for each participant who is `UNRATED` when it is finalized**; it is not a separate match type, and the same result still counts normally for everyone else's history.

**Approved eligible situations (D12)**

| # | Situation | Existing state that identifies it | Unrated participants credited |
| --- | --- | --- | --- |
| E1 | Friendly confirmed by the required participant | `friendly_matches.status = 'confirmed'`, `confirmed_at` set, `winner_id` set | Both singles players, one each — minus any who is `RATED` |
| E2 | Friendly automatically approved after the 24-hour period | `friendly_matches.status = 'auto_approved'`, `confirmed_at` set, `winner_id` set | Same as E1 |
| E3 | Friendly dispute resolved in favour of a valid played result | Final state `confirmed` or `auto_approved` after resolution; **never** while `disputed` | Same as E1. **Eligibility approved by D12**; no resolution path exists today (§7 rule 8), so it is not yet reachable |
| E4 | Official tournament match completed with a valid finalized result | `matches.status = 'completed'` after `record_match_result`, or after a reasoned `correct_match_result` that leaves it completed; scores validated by the RPC | Singles: both players, one each. Doubles: all four, one each |
| E5 | Doubles match | E4 for tournaments; friendly doubles are not implemented (migration 010 is singles-only) | Every Unrated participant, one each, regardless of team composition |
| E6 | Match involving two Unrated players | A finalized E1–E4 match where both sides are `UNRATED` | Both, one each |
| E7 | Match involving one Unrated and one Rated player | A finalized E1–E4 match with mixed status | **Only the Unrated participant**, one credit. The Rated participant gets none (D11) |
| E8 | Retirement **after actual play has begun**, with an official finalized result recorded as a valid played match | Requires `matches.status = 'completed'` plus an approved retirement/termination marker and a recorded result; **that marker does not exist today** | Every Unrated participant in the match, one each. **Eligibility approved by D12**; applying it is blocked by the missing result type (row 25) |

**Approved ineligible situations (D12)**

| # | Situation | Why it does not count |
| --- | --- | --- |
| I1 | Pending friendly (`pending`, `accepted`) | No result submitted; nothing has been finalized |
| I2 | Unresolved disputed friendly (`disputed`) | The result is contested; no final result exists. A later resolution can make it eligible once (E3) |
| I3 | Cancelled match (friendly `cancelled`, tournament `cancelled`) | Not played, or deliberately reset; never a played match |
| I4 | Tournament bye | No opponent and no played match; `AGENT.md` §4.2 already says a bye must not create a played match |
| I5 | Walkover | No actual play |
| I6 | No-show | No actual play |
| I7 | Forfeit **before play begins** | No actual play |
| I8 | Withdrawal **before play begins** (`tournament_entries.status = 'withdrawn'`) | An entry state, not a match result |
| I9 | Disqualified match (`tournament_entries.status = 'disqualified'`) | **Approved ineligible by D12.** It may count only if a later approved rule explicitly changes this policy and establishes both eligibility and evidence of actual play |
| I10 | Declined friendly (`declined`) | Never accepted or played |
| I11 | A match that exists only as a scheduled fixture or grand-final placeholder | No result; a cancelled conditional reset is not a match |

**Retirement is not withdrawal.** The distinction is *when* the player stopped:

- **Retirement after play begins.** The match has started; at least one rally/point has been played. The official result records the opponent as winner because the player retired. **Approved eligible by D12 if and only if** an official final result exists and is recorded as a valid played match (E8).
- **Withdrawal before play begins.** The player or team is removed before the first point (`tournament_entries.status = 'withdrawn'`). There is no played match and no match result, so it is **approved ineligible** (I8).
- **Why this cannot be credited yet.** The applied schema has `matches.status` values `pending`, `completed`, and `cancelled` only, plus `friendly_matches` statuses with no retirement outcome. `completed` alone cannot prove the match was played to a legitimate finish rather than ended by retirement, forfeit, or no-show. The eligibility rule is approved, but the **implementation** cannot distinguish a genuine retirement until a result/termination marker is approved (row 25). This revision invents no new status and writes no migration.

**Additional approved conditions (D12)**

- Retirement after actual play begins counts **only when an official final result exists**.
- Disqualification does **not** count by default.
- Walkovers, no-shows, forfeits before play, and withdrawals before play do **not** count.
- Corrected matches must **never** create a second placement credit.
- Historical matches count **only when their eligibility can be reliably verified**; the verification method is still open (row 24).

**Approved credit rules (D12)**

1. A match earns placement credits only after the core principle is satisfied: actually played **and** finalized.
2. Each eligible match gives an individual Unrated participant **exactly one** placement credit.
3. **Singles:** each Unrated participant receives one credit.
4. **Doubles:** each Unrated participant receives one credit, regardless of team composition; a doubles match is not split into halves or shares.
5. **Rated participants receive no placement credit.** They are already qualified, and their participation neither adds a credit nor reduces an Unrated participant's credit.
6. **Rated participants receive no SP adjustment** during placement matches, as approved by D11 (§7.2.4).
7. A player cannot receive multiple credits for the same match.
8. A corrected, resubmitted, or replayed result must not duplicate an already-earned credit.
9. Placement progress is the count of **unique eligible finalized match credits**, never a raw transaction count, submission count, game count, or ledger row count. The existing 1,000-SP `initial` row and the absence of any Rated-side row make ledger counting wrong in both directions.
10. The credit is a durable per-player record unique on `(match source, match id, player id)`, written server-side at finalization. It is the authoritative source for progress and for the "this match involved placement" marker. The exact table design remains an implementation decision (§7.2.7).
11. A credit may be **voided** (never silently deleted) if the match is later cancelled or invalidated; a voided credit stops counting and keeps its audit trail (§7.2.5).
12. A result that is merely submitted, awaiting approval, or disputed does not create a credit, even if it is later approved.

**Approved examples**

| Match | Participants | Credits |
| --- | --- | --- |
| Singles, Unrated vs Unrated, finalized friendly | U1, U2 | U1 +1, U2 +1 |
| Singles, Unrated vs Rated, finalized friendly | U1, R1 | U1 +1, R1 0 (D11) |
| Doubles, U1 + R1 vs R2 + R3, completed tournament match | U1, R1, R2, R3 | U1 +1; R1, R2, R3 each 0 |
| Doubles, U1 + U2 vs R1 + R2, completed tournament match | U1, U2, R1, R2 | U1 +1, U2 +1; R1, R2 0 |
| Doubles, U1 + U2 vs U3 + U4, completed tournament match | U1–U4 | One credit each (four total) |
| The same corrected tournament result, re-submitted twice | same four players | Still one credit each; no second credit |
| A pending or disputed friendly | both players | No credit until confirmed/auto-approved or resolved in favour (E3) |
| A walkover, no-show, or forfeit before play | both sides | No credit |

**Implementation check: can the approved policy be applied with existing states?** The eligibility rules are approved by D12; this table records what the schema can and cannot express for future implementation. Ordinary cases are covered; retirement cannot be represented, and DQ/walkover/no-show/forfeit have no marker.

| Source / state | What exists today | Sufficient to apply D12? |
| --- | --- | --- |
| Friendly final states | `confirmed`, `auto_approved`, both requiring `confirmed_at` and `winner_id`; `disputed` requires a reason and timestamp | **Yes for E1–E2.** E3 is expressible only once a resolution path ends the match in `confirmed`/`auto_approved`; there is no dedicated `resolved` state today |
| Dispute resolution | `dispute_friendly_result` sets `disputed`; **no resolution path is built** while §7 rule 8 is open | **No implementation path.** E3 is approved but unreachable; this revision does not invent a workflow |
| Tournament match state | `matches.status in ('pending', 'completed', 'cancelled')`; results are written by `record_match_result` and corrected by `correct_match_result` | **Yes for the ordinary path**; **no marker** for E8, and no way to distinguish walkover, no-show, or forfeit-before-play from a completed match |
| Tournament entry state | `tournament_entries.status in ('registered', 'withdrawn', 'disqualified')` | Identifies I8 and I9, but it is an entry state, not proof about when play stopped |
| Per-player participation | Friendly: `challenger_id` / `opponent_id`. Tournament: entries and `team_members` | Sufficient to derive participants, but there is no per-player placement credit or participation marker |
| Result validation | `record_match_result` validates games/scores; friendly approval requires the losing player or auto-approval | Sufficient as the validation gate, but not as evidence of *how* the match ended |

**Conclusion of the implementation check.** The ordinary path — confirmed/auto-approved friendly or completed tournament match — is identifiable from existing states. The approved policy still needs an implementation path for a resolved dispute (row 8) and a result/termination marker that can represent retirement and distinguish the ineligible exceptional outcomes (row 25). Those are implementation decisions, not reasons to reopen the approved eligibility list. Nothing here authorizes a schema change.

Implementation notes (required by the approved rules, not authorized):

- Enforce rules 7–9 structurally with a credit row unique on `(match source, match id, player id)` rather than with a mutable counter.
- A source discriminator is required: `matches` and `friendly_matches` are different tables, and `sp_transactions.reference_type = 'match'` does not say which one (§7.2.6).
- Friendly matches are **singles only** today (migration 010; doubles friendlies are blocked by §7 rule 7). The four-player credit for friendly doubles is therefore prospective; the tournament path already supports four players.
- A corrected tournament result is still the same match row, so it must not create a second credit.
- The credit must be written inside the same transaction as the awarding write for the match, or idempotently with a unique key; a retry may not duplicate it.
- No credit is ever derived from a ledger row. The `initial` row is not a match, and a Rated participant has no row at all.

#### 7.2.3 Provisional SP calculation and ledger

Intended behavior:

1. Provisional SP starts at 1,000 (the existing, already-implemented starting award in §7.1).
2. Eligible finalized matches (D12, §7.2.2) update provisional SP using the applicable SP calculation rule.
3. Friendly matches use the normal multiplier.
4. Official tournament matches use the tournament multiplier.
5. The provisional value remains hidden while the player is `UNRATED`.
6. The provisional ledger preserves before, delta, after, reason, match reference, timestamp, idempotency key, and rule version.
7. **Only Unrated participants move (D11, approved).** In a placement match the provisional balance changes only for participants who are `UNRATED`. Rated participants receive no row, so the match is intentionally not two-sided; this is the approved exception analysed in §7.2.4, not a change to the calculation itself.

The required ledger fields already exist on the append-only `sp_transactions` table:

| Requirement | Actual column / mechanism | Note |
| --- | --- | --- |
| Before / delta / after | `sp_before`, `sp_delta`, `sp_after`, with `sp_before + sp_delta = sp_after` | Exists; applies to hidden rows too |
| Reason | `transaction_type` (`friendly` / `tournament`) plus `metadata` | Exists; there is no dedicated `reason` column, so placement context belongs in `metadata` |
| Match reference | `reference_type = 'match'`, `reference_id` | Exists but is not source-specific (§7.2.6) |
| Timestamp | `created_at` | Exists |
| Idempotency key | `idempotency_key`, unique | Exists |
| Rule version | `rule_version` | Exists; the starting row uses `starting-sp-v1` |
| Who recorded it | `created_by` | Exists |
| Immutability | UPDATE/DELETE/TRUNCATE blocked by triggers | Exists |

Applied-schema constraints that shape the proposal:

- `transaction_type` already allows `friendly` and `tournament`; a placement award is one of those types, not a new type, so no check change is needed for match rows.
- `sp_delta <> 0` means **qualification cannot be recorded as a zero-delta ledger row**. Qualification is a status transition plus an audit/qualification record, not a transaction — which also matches the "no placement bonus" rule.
- The ledger is append-only: nothing already written may be rewritten, re-keyed, or deleted at qualification.
- D11 means a placement match writes rows only for its Unrated participants. There is no Rated-side row to balance the pair, and no compensating entry is created; the missing row is the approved representation of "no SP change".

**The §7.1 formula is approved (D13, 2026-11-03) but placement is not implemented.** D13 settles its base, coefficient, clamp, floor, rounding, cap order, and doubles split. If those parameters change later, placement matches must record the rule version that actually computed each row, and old rows are never recalculated. One practical consequence: **friendlies and completed tournament matches award SP today**, because both awards exist (migrations 011 and 017) and the approved rule is enabled (migration 016). Every placement path is still unbuilt, so Option A cannot be exercised until placement is approved and implemented.

#### 7.2.4 Interaction with already-rated opponents — approved Rated-side rule (D11)

> **APPROVED 2026-11-01 — D11, Rated-side Option A: a Rated participant receives no SP change in a placement match.** (This "Option A" is the Rated-side rating option; it is not the same label as the "Option A — Hidden Provisional SP" placement approach in §7.2.0.) This approval is limited to the asymmetry. It does not approve the placement system, the 10-match requirement, the hidden-balance design, the starting provisional value, or the qualification mechanics. The §7.1 formula is approved separately by D13.

Scenario: an `UNRATED` player competes against a `RATED` player.

**Approved behavior**

| Participant | Provisional SP | Placement credit | SP ledger |
| --- | --- | --- | --- |
| Unrated | Updated using the applicable provisional calculation rule | +1 after the match is finalized and confirmed eligible | One provisional row, hidden until qualification |
| Rated | No gain, no loss; balance unchanged | None — already qualified | **None.** No zero-delta row, no reversal, no placeholder |
| Match | Recorded and finalized normally; score validation, approval/dispute handling, and audit requirements unchanged; must not be counted twice | Counts toward the Unrated participant's requirement when eligible | Must identify that the match involved placement |

Unrated participant:

- Their hidden provisional SP is updated using the applicable provisional calculation rule.
- Their placement-match count increases by one after the match is finalized and confirmed eligible.
- Their provisional balance remains hidden until qualification.

Rated participant:

- Receives no SP gain.
- Receives no SP loss.
- Does not receive an SP ledger transaction for that placement match.
- Receives **no placement credit**; a credit is only ever created for an `UNRATED` participant (§7.2.2).
- Their existing SP balance remains unchanged.

Match:

- Is still recorded and finalized normally.
- Remains subject to score validation, approval, dispute handling, and audit requirements.
- Counts toward the Unrated participant's 10-match placement requirement when eligible.
- Must not be counted twice.

**Why the Rated side does not move.** The v37 analysis showed the reverse-inference problem. If the §7.1 curve were applied to the Rated participant against the hidden value:

```
d = clamp(20 + 0.02 × (S_unrated − S_rated), 5, 40)
S_unrated = S_rated + 50 × (d − 20)      [inside the clamp, with S_rated known]
```

The Rated opponent knows `S_rated` (public), would observe `d` (their own visible ledger), and could recover `S_unrated` from one match. With no Rated-side movement there is no delta to invert and no transaction-history entry to read, so the hidden provisional balance is not exposed through the opponent. The Unrated player's own calculation still uses the Rated participant's actual SP, which is already public, so that input reveals nothing new. D11 therefore chooses confidentiality and simplicity over two-sided movement.

**Trade-off: intentional temporary rating asymmetry.**

- The Unrated participant can gain or lose provisional SP while the Rated participant's SP remains unchanged. The two sides of the same match are intentionally no longer equal and opposite.
- SP is **not conserved** across the participants during a placement match. This is an intentional exception to normal two-sided rating updates and to the §7.1.4 zero-sum property; it changes neither the formula nor the ledger contract for any other match.
- The asymmetry is temporary: it applies only while a participant is `UNRATED`. Normal two-sided SP calculation applies to every subsequent match after qualification, with no retroactive adjustment (§7.2.5).
- The reasons are deliberate: it protects hidden provisional SP from being reverse-engineered through a Rated opponent's rating change, keeps placement simple, prevents placement matches from changing established public ratings, and avoids exposing provisional SP through a Rated opponent's transaction history.
- The system must **not** fabricate zero-delta transactions for Rated opponents. The applied `sp_delta <> 0` constraint already forbids a zero row, and "played, counted, no award" is represented by the match and placement records, never by a fake ledger entry.
- Per-account reconciliation is unaffected: an Unrated player's cached balance still equals their own provisional ledger sum, and a Rated player's cached balance still equals their own unchanged ledger sum. The asymmetry is between participants, not inside an account.

**Doubles.** The same principle applies to every participant.

- Every participating Unrated player receives their own provisional SP processing and their own placement credit.
- Every participating Rated player receives no SP adjustment, including the Rated partner of an Unrated player and every Rated opponent.
- A Rated participant is not awarded or deducted SP merely because a teammate is Unrated.
- The existing doubles team-average calculation is preserved for provisional participants: each team's strength is the arithmetic mean of the applicable partner values — a Rated partner's public SP, and an Unrated partner's hidden provisional SP — subject to the unresolved doubles rules (§7 rules 6, 12, and 13).

| Team composition | Unrated participants | Rated participants |
| --- | --- | --- |
| Unrated + Unrated vs Unrated + Unrated | All four receive normal provisional processing and a credit; the pair is two-sided | None |
| Unrated + Unrated vs Rated + Rated | Both Unrated receive processing and a credit | Both Rated receive nothing |
| Unrated + Rated vs Unrated + Rated | Both Unrated receive processing and a credit; their Rated partners receive nothing | Both Rated partners receive nothing |
| Unrated + Rated vs Rated + Rated | The one Unrated receives processing and a credit | The Rated partner and both Rated opponents receive nothing |
| Rated + Rated vs Rated + Rated | None — no participant is in placement | Normal rules apply to all four |

Singles compositions follow the same logic: `UNRATED` vs `RATED` is the asymmetric case above; `UNRATED` vs `UNRATED` is two-sided (both provisional balances move and both receive a credit); `RATED` vs `RATED` is an ordinary match.

Worked doubles example, consistent with §7.1.6: Team A is U1 (hidden provisional 1,000) and R1 (1,200), average 1,100. Team B is R2 (1,300) and R3 (1,500), average 1,400. A wins, so the approved team adjustment is `+26`, split `+13 / +13`. **Under D11**, U1 receives `+13` provisional (hidden), R1 receives nothing, and R2 and R3 receive nothing. Whether the Unrated participant should instead receive the whole `+26`, and what happens to the share that would have gone to the Rated partner, is **not decided here**; it belongs to the unresolved doubles distribution and rounding rules (rules 6, 12, and 13). With two Unrated partners, both receive their split and that team's combined change equals the ordinary team adjustment, while the opposing Rated team still receives nothing.

**What remains open in this subsection** (D11 does not answer these):

- Whether a Rated player can decline or avoid placement matches, and whether that affects tournament entry.
- How "played, counted, no award" is presented on a Rated player's match history without implying a hidden zero transaction.
- Whether the unapplied share of a Rated doubles partner is discarded or redistributed to the Unrated partner (belongs to the doubles rules).
- How D11 is encoded in the placement rule version and in the match/placement-credit record (belongs to the schema design in §7.2.7).
- The exact ordering of the 10th-match award and the qualification transition when that match itself has a Rated participant (belongs to rule 21). D11 already settles that the Rated side receives no retroactive change.

#### 7.2.5 Finalization, credit integrity, qualification, and publication

**Finalization and credit integrity — D12 approved for eligibility and credit outcomes; implementation mechanism NOT APPROVED.** D12 approves the outcomes in rules 1–6 and 8–9: validation before a credit, no credit for pending or unresolved matches, a resolved dispute counting once, voiding rather than deleting on cancellation or invalidation, no duplicate credit on correction, no double counting from any source, and no Rated credit row. The **mechanism** — transaction shape, unique keys, retry protocol, and schema — remains an implementation decision (rows 5, 11, 21, and 25). This block does not invent a dispute workflow; it relies on the workflows that already exist or are already approved elsewhere.

1. **Result validation is required.** A credit may be written only after the applicable validation has passed: `record_match_result` validates the games and scores for a tournament match, and a friendly reaches `confirmed`/`auto_approved` only through the required approval or the trusted 24-hour auto-approval. A submission that fails validation creates nothing.
2. **Pending matches do not count.** Friendly `pending`, `accepted`, and `awaiting_approval`; tournament `pending`. Nothing is finalized yet.
3. **Disputed matches do not count until resolved.** A friendly in `disputed` has no final result. A resolved dispute **may count once** if the final result represents a valid played match (E3, §7.2.2). This revision adds no resolution workflow: `dispute_friendly_result` currently has no resolution path while §7 rule 8 is open, so E3 is proposed but unreachable until the club approves one.
4. **Cancelled or invalidated matches must not retain credit.** If a finalized match is later cancelled or invalidated, its credit must stop counting. The credit is **voided** (timestamp, reason, and actor recorded) rather than deleted, so the audit trail shows that the match once qualified and later did not.

   **Contradiction with step 6 below (found by the 2026-11-02 technical review, not yet resolved).** Voiding the credit removes it from the placement *count* but leaves its SP in the ledger, and step 6 publishes the ledger sum — so a match later ruled invalid would still have moved the player's permanent rating. The ledger is append-only, so the only way to remove the SP is a compensating row. Two options, both unapproved: **Option R (reverse)** — invalidation writes a `reversal` row that negates the original delta, so the published value excludes the match, the reversal is keyed to the original row for idempotency, and a reversal arriving after qualification must be handled by the qualification transaction; or **Option K (keep)** — the SP stands and only the count is voided, which must then be stated in the brief. Nothing writes a `reversal` today. **The SP half is now proposed in §7.1.11** (Option R: a reversal row removes the SP); the credit-count half — whether the placement credit is voided or kept — stays open and is not decided there.
5. **Corrections preserve audit and must not duplicate.** `correct_match_result` rewrites the games on the same match row and records an audit entry. Because the credit is keyed on `(source, match_id, player_id)`, a correction or resubmission cannot create a second credit. A correction that leaves the match completed keeps the existing credit. A correction that invalidates the result voids it under rule 4.
6. **Replays and retries are idempotent.** A retried finalization, a replayed request, or a repeated approval returns the existing credit ("already counted") instead of inserting another, following the `already_processed` pattern used by `approve_registration`.
7. **Processing is atomic or safely idempotent.** The business requirement — a retried or replayed finalization must not duplicate a credit — is **approved by D12**. The mechanism is an implementation decision: preferably the credit is written in the same transaction as the match finalization and its provisional SP row, with a unique key plus a reconciliation path if the write is separated. The exact transaction shape and schema remain open (rows 5, 11, and 25).
8. **No double counting from any source.** Progress is derived from credit records, not from submissions, games, ledger rows, clock jobs, or UI state. Re-running an auto-approval job over an already-counted match is a no-op.
9. **Rated participants never receive a credit row.** D11 also means no Rated-side SP row; a Rated participant is simply not a credit subject (§7.2.4).

The transition is `UNRATED → RATED` and must happen exactly once, when the player reaches 10 eligible finalized matches.

Proposed steps, all inside the transaction that finalizes the 10th eligible match:

1. **Verify the count from durable records** — the placement credits (or an equivalent derived count), never a client-supplied number.
2. **Lock the player's rating state** (row lock on the player/qualification record) so two concurrent finalizations cannot both qualify.
3. Confirm the status is still `UNRATED` and the verified count is at least 10.
4. **Prevent duplicate qualification** with one unique qualification record per player; a replay or retry returns "already qualified" and changes nothing, following the existing `already_processed` pattern in `approve_registration`.
5. **Preserve the complete provisional ledger** — no deletion, rewriting, re-keying, or summarising.
6. **Publish the accumulated SP without resetting it** — the visible official SP equals the ledger sum that already existed; no reset to 1,000, no bonus, no recalculation. This is the statement that conflicts with rule 4: unless Option R is chosen, a match voided for placement still contributes SP to the published value.
7. **Record the qualification timestamp and applicable rule version** on the qualification record.
8. **Make the player eligible for official SP rankings** from that point on; the leaderboard includes them with the published value.
9. **Do not create a separate bonus** for completing placement.
10. **Resume normal two-sided calculation, with no retroactive adjustment.** After qualification, ordinary matches update both participants under the normal rules. No Rated participant receives a retroactive award or deduction for an earlier placement match, and the qualification transition never edits a Rated balance (D11, §7.2.4).

Concurrency and atomicity notes:

- Qualification belongs to the same transaction as the awarding write for the 10th match. If either half fails, both roll back and the player stays `UNRATED` with 9 credits.
- The transition must be one privileged, security-definer operation (not a client sequence of updates), matching the existing RPC-only pattern.
- Open: the exact behaviour after later events — a corrected result, a reversal, a disputed match confirmed after qualification, a voided credit, or a back-dated finalization. The proposal is that none of them re-qualifies or un-qualifies a player; a late finalized match simply adds an 11th eligible match to an already-Rated player. A credit voided after qualification stops counting as a placement match but does not reverse the already-completed transition under this proposal; whether an un-qualification path should ever exist is open (row 21).
- If the 10th match itself is against a Rated participant, D11 still governs that match: the player is `UNRATED` when it is finalized, their provisional balance moves, and the Rated side receives nothing. The qualification transition happens in the same transaction and does not retroactively change the Rated side; the exact ordering belongs to rule 21.

#### 7.2.6 What the current implementation actually contains

This is the accurate starting point; it is not an assumed schema.

| Requirement | Present today | Gap for Option A |
| --- | --- | --- |
| Unrated / Rated public status | No rating status. `players.status` supports only `active`, `inactive`, `suspended` | Need a separate rating status; must not overload membership status |
| Provisional vs official SP | One value, `sp_accounts.current_sp`, readable by every club member (policy 003) | No hidden/provisional distinction and no read restriction |
| Placement match count | Nothing | No credit table, counter, or derivation |
| Qualification record | Nothing | No timestamp, rule version, or unique exactly-once guard |
| Ledger | `sp_transactions` supports before/delta/after, reason via type + metadata, match reference, timestamp, unique idempotency key, rule version, actor, immutability | No placement-phase marking; `reference_type = 'match'` does not distinguish friendly from tournament source |
| Starting SP | `grant_starting_sp` writes 1,000 with `rule_version = 'starting-sp-v1'`, `reference_type = 'registration'`, key `player:<player_id>:initial` (migration 003) | None for the amount; it must not be edited, and its row is **not** a match credit |
| Rule configuration | `sp_rule_versions` JSON config; the `provisional-2026-11` row is disabled and `approved-2026-11` is enabled (D13); a CHECK forbids enabling an unapproved version | No placement keys; a new approved version (or separate placement config) is required |
| Placement identification | No match or per-player marker. `sp_transactions.reference_type = 'match'` cannot say "placement", and a Rated participant has no ledger row at all | No field or record identifies that a finalized match was a placement match for a participant |
| Match result vocabulary | `matches.status` allows only `pending`, `completed`, `cancelled`; friendly statuses allow `pending`, `accepted`, `declined`, `cancelled`, `awaiting_approval`, `confirmed`, `auto_approved`, `disputed` | No retirement, walkover, no-show, forfeit, DQ, or "played but unfinished" marker; `completed` cannot prove how the match ended |
| Entry status | `tournament_entries.status` allows `registered`, `withdrawn`, `disqualified` | An entry state, not a match result; it cannot show whether withdrawal happened before or after play |
| Dispute state | `disputed` exists with a reason and timestamp; no resolution path or resolved state | E3 cannot be reached today without an approved resolution workflow |
| Reconciliation | `reconcile_sp_balances()` compares `sp_accounts.current_sp` with the ledger sum for every account | A hidden balance cannot be implemented by leaving the cache at 0 |

Three implementation facts matter more than they look:

1. **Hiding is not an accounting change.** `reconcile_sp_balances()` defines the cached balance as the ledger sum for every account. If provisional match rows are written to the ledger while `sp_accounts.current_sp` stays at 0, the next reconciliation reports a mismatch and the "ledger equals balance" guarantee in §4 is lost. Hiding must be solved at the **exposure** layer, or the reconciliation function must knowingly account for a second store (§7.2.7).
2. **Today's grants disclose the value.** `sp_accounts` is SELECT-able by every active member, and `sp_transactions` is SELECT-able by the owning player (policy 003). Both would expose provisional rows and the 1,000 starting balance. A UI-only hide is not sufficient and would violate the `AGENT.md` rule that hiding a control is not security.
3. **The ordinary eligibility path is expressible; the exceptional ones are not.** A confirmed/auto-approved friendly and a completed tournament match can be identified from existing states, but the schema cannot say "retirement after play", "walkover", "no-show", "forfeit before play", or "resolved dispute". **D12 nonetheless approves the eligibility policy**: retirement counts only with an official final result, and the other outcomes do not count. Applying that policy still needs a result/termination marker and a dispute resolution path, which is why row 25 (and the dispute rule, row 8) remain implementation questions even though the policy is settled.

The read paths follow the same table: `/shuttlepower` builds its leaderboard directly from `sp_accounts`, and a player profile renders the current balance where RLS returns it, so both would show a provisional value until the exposure change lands.

**Ledger and security requirements for the approved rules (D11 and D12):**

- Provisional SP transactions must remain fully auditable under the §7.2.3 contract.
- Rated opponents must have **no** SP transaction for these placement matches — no zero-delta row, no correction, no reversal, and no hidden "not moved" entry.
- The finalized match, or its per-player placement credit, must identify that the match involved placement. A Rated participant's history can then show "placement — no SP change" from that record instead of a fabricated ledger row.
- Authorization and visibility must be enforced at the database/exposure layer (grants, RLS, and views or RPCs), not merely hidden in the UI.
- Reconciliation must keep using the actual ledger and the cached balance: the Rated player's cache stays equal to their unchanged ledger sum, the Unrated player's cache stays equal to their provisional ledger sum, and a mismatch must never be "repaired" by inventing a Rated-side row.

#### 7.2.7 Future schema and rule-version changes (indicative, not authorized)

Three viable shapes exist. This revision records them and does **not** choose one.

| Design | Shape | How the value is hidden | Reconciliation | Ledger continuity | Main risk |
| --- | --- | --- | --- | --- | --- |
| 1 — Exposure gating on one account (recommended for review) | Keep one balance that always equals the ledger sum; add a rating status and a qualification record; replace direct club-wide table reads with a view/RPC that returns only `RATED` balances, and gate the player's own ledger read while `UNRATED` | Read layer | Unchanged: cache still equals ledger sum | Full; provisional rows become history after qualification | Replaces the policy-003 read model and every consumer (leaderboard, profile, history); the player and staff no longer query the table directly |
| 2 — Split balances | `sp_accounts.current_sp` (official, visible) plus a new hidden `provisional_sp` and status | Column/table privileges or a view | Must be replaced: reconciliation has to sum both columns | Good | Duplicate balance; an applied function must be superseded in a new migration; every award must write the correct column |
| 3 — Separate provisional store | New hidden placement account/ledger tables; the official ledger is written at qualification | Table privileges | New logic; the existing function no longer describes the whole picture | Weakest unless every provisional row is copied, which then risks double counting | A second ledger to audit, a promotion step that must preserve history, and a ledger type/constraint that cannot currently express a non-zero qualification row cleanly |

Common changes any approved version would need:

1. **A new migration only.** The next free number (for example `011_placement.sql`). Migrations 001–010, policies 001–010, and the applied `provisional-2026-11` row are never edited. Applied functions such as `approve_registration`, `grant_starting_sp`, `reconcile_sp_balances()`, and the match finalizers are superseded with `create or replace` in the new file, which preserves history without rewriting it.
2. **A rating-status field or record.** Existing players backfill as `RATED` (they are already published), unless a historical match is reliably verified under D12's historical condition. Registration approval must explicitly create `UNRATED`. The verification and backfill method is open (row 24).
3. **Placement credits.** A table keyed uniquely by `(source, match_id, player_id)` with `recorded_at` and the rule version; the count is derived from it. The credit row is also the durable marker that the match involved placement for that player; it must be written server-side at finalization, never supplied by the client. Invalidation sets a `voided_at` and reason on the existing row and the progress count filters to active credits, so cancellation removes a credit without deleting its audit trail. If a cached count is ever added, it must be reconcilable like the SP balance.
4. **A qualification record.** Keyed uniquely by player, carrying `qualified_at`, the rule version, and the credit count at qualification; never updated afterwards.
5. **A read-exposure change.** RLS is row-level, so hiding one column cannot be expressed by the current table-wide SELECT grant. A view or RPC plus a successor policy is required, and the leaderboard, profile, and own-history consumers must switch to it.
6. **A rule version carrying the placement parameters.** A new `sp_rule_versions` row (provisional first, then approved; never editing the existing row), with keys such as `placementMatchRequirement: 10`, `initialProvisionalSp: 1000`, counting toggles, and the approved D11 Rated-side behavior — or, if those do not belong in the SP formula document, an equivalent `app_settings` record. Unknown config keys must either be ignored safely by `domain/sp.ts` or be explicitly taught to it; today the config is a free JSON object, but the engine only reads the keys it knows. The existing CHECK still forbids enabling an unapproved version, so placement would ship disabled.
7. **A qualification RPC.** Locked, idempotent, and invoked inside the awarding transaction for both sources.
8. **Awarding keys that name the source.** `match:<source>:<match_id>:<player_id>` is recommended. §7.1.5 #12 writes `match:<match_id>:<player_id>`; that is unambiguous only because UUIDs are globally unique, not because the format names the source. This note does not change §7.1.
9. **Reconciliation proof.** Design 1 needs no change; Designs 2 and 3 must replace `reconcile_sp_balances()` and prove the new invariant with tests.
10. **Tests.** Exactly-once counting, four-player doubles credit, disputed/pending exclusion, correction without a second credit, concurrent finalization at match 10, publication without reset, no bonus row, no Rated-side ledger row for a placement match (including a Rated doubles partner), no fabricated zero-delta row, no retroactive Rated-side adjustment at qualification, no credit for a pending, cancelled, walkover, no-show, forfeit, or withdrawn match, and denied reads of the hidden value for non-staff.
11. **A result/termination marker for the approved retirement rule.** D12 approves retirement after actual play when an official final result exists, but no marker exists to represent it. The marker would distinguish a played-then-retired match from a completed one and from a pre-play withdrawal, and would also help exclude walkovers, no-shows, and forfeits before play. It is required to **apply** D12, not to redefine it (row 25).

None of the above is an implementation plan authorized by this revision.

#### 7.2.8 Interaction with seasons

> **Answered during the seasonal decision review (approval date to be recorded).** S10 and S11 (§7.3) settle the
> placement/seasons interaction: a player who is Unrated at the cutoff is excluded from the seasonal ranking and
> receives no seasonal deduction, keeping any previous seasonal ranking; placement matches are never retroactively
> added to Seasonal SP; a player who becomes Unrated mid-season keeps their Seasonal SP for audit and resumes
> eligibility if Rated again. The questions below are retained for history; the seasonal snapshot design is approved as
> S19 (§7.3).

No seasonal feature exists, and §7.1.10 already forbids building one now. Option A raises questions that must be answered with §7 rules 3–5, 10, 15, and 23:

- Does an `UNRATED` player appear in a seasonal snapshot or leaderboard at all? If yes, what value is shown?
- Do placement matches played before qualification count toward the season's seasonal SP once the player becomes `RATED`, or does seasonal accumulation start at qualification?
- Can a rank-based seasonal deduction touch a hidden provisional balance when the player is still `UNRATED` at season end?
- Does an incomplete placement count carry across a season boundary, or reset?
- Do season archives store only published official SP, and does that mean an Unrated player has no archive entry for that season?

Proposed constraint (not a decision): qualification must never rewrite a completed season snapshot, and a seasonal deduction must remain a separate `season_deduction` ledger row referenced to a season. §7.1.10's constraints survive unchanged.

#### 7.2.9 Compatibility and contradiction check

| Existing rule or section | Position under Option A | Status |
| --- | --- | --- |
| `AGENT.md` §4.3: new player starts with 1,000 SP | Amount unchanged; the award becomes the hidden provisional opening balance | Consistent once approved; no new award is proposed |
| `AGENT.md` §4.3: SP changes automatically from eligible results | Calculation still happens from the first match; only **publication** is delayed | Consistent |
| `AGENT.md` §4.3: tournament matches 2×, friendlies 1× | Unchanged | Consistent |
| `AGENT.md` §4.3: doubles use the team average, then split | Unchanged for the calculation; placement counting is per player | Consistent |
| `AGENT.md` §4.3: no manual SP edits; every change recorded | Unchanged; hidden rows carry the full ledger contract | Consistent |
| `AGENT.md` §4.2: a bye awards no SP | Byes and cancelled resets are not played matches and do not count | Already governed; no new decision |
| `AGENT.md` §4.4: 24-hour loser approval / auto-approval | Stays the finalization point; `awaiting_approval` and `disputed` do not count | Consistent |
| `AGENT.md` §6 registration step 5: "receives 1,000 starting SP exactly once" | Still exactly once; "receives" now means a hidden provisional balance | Requires this approval to be read that way |
| §7.1 formula | **Approved 2026-11-03 — D13** (base 20, coefficient 0.02, clamp 5–40, floor 0, tournament ×2, half-up, even split); no parameter changes here | Consistent |
| §7 rule 19: Rated opponents during placement | **Approved — D11: no SP change for any Rated participant** (singles and doubles), with the trade-off documented in §7.2.4 | Resolved 2026-11-01 |
| §7.2.2 / §7.2.5 eligibility and credit rules | **Approved 2026-11-01 — D12**: played-and-finalized core principle, 8 eligible and 11 ineligible situations, additional conditions, and the one-credit/void-not-delete rules | Resolved as policy; implementation and schema remain unapproved |
| §7.1.4 zero-sum property | Intentionally suspended for a placement match that includes a Rated participant; ordinary matches stay two-sided | Approved exception (D11), not a formula change |
| §4 data model: `sp_accounts` is a cache, ledger is truth | Design 1 preserves it; Designs 2/3 must prove reconciliation | Constraint on the eventual design |
| §7 rule 7: friendly doubles approval undefined | Four-player friendly credit is prospective; doubles friendlies are not implemented | No contradiction, but not exercisable |
| §7 rule 8: dispute resolution open | A disputed friendly does not count; a resolved dispute may count **once** if the final result is a valid played match. No new resolution workflow is introduced | **Approved eligibility (D12)**; the resolution workflow is still an implementation decision |
| §7 rule 17: both match categories count | Both count when finalized; the ordinary friendly and tournament states identify them | **Approved 2026-11-01 (D12)** |
| §7 rule 9 / rule 18: walkovers, forfeits, DQs, withdrawals | Walkover, no-show, forfeit before play, withdrawal before play, and DQ are ineligible by default; retirement after play counts only with an official final result | **Approved eligibility (D12)**; **SP** treatment remains open |
| Existing result vocabulary (`matches.status`) | No retirement, walkover, no-show, forfeit, DQ, or "played but unfinished" marker; `completed` cannot prove how the match ended | Implementation constraint on E8 and row 25; the policy itself is approved |
| Existing entry status (`tournament_entries.status`) | `withdrawn` / `disqualified` are entry states, not match results; withdrawal before play is ineligible | Approved outcome; still cannot show when play stopped |
| §9 status: "No screen awards SP yet" | **Superseded by D13:** confirmed friendlies now award SP; Option A does not change that | Updated |
| §7 standing policy 3: no test locks in an unapproved value | The 10-match count, hidden visibility, and qualification behaviour are all unapproved | Binding on future tests |

Known tensions and how the approved decisions affect them:

1. **"Hidden" versus the Rated-opponent rule — resolved by D11.** The Rated side does not move, so there is no visible delta to invert and no transaction-history entry to read. The cost is the intentional asymmetry recorded in §7.2.4.
2. **"Hidden" versus today's grants.** The current `sp_accounts` club-wide SELECT and the player's own `sp_transactions` SELECT would both disclose the value; changing them is a reviewed policy change, not a UI tweak.
3. **"Once per match" versus corrections.** `correct_match_result` rewrites games on the same match row; the credit must therefore key on the match, not on the submission or game set.
4. **"Exactly once" versus late finalization.** A disputed friendly confirmed after qualification, or a corrected result, must not re-run or duplicate the transition.
5. **Aggregate SP.** §7.1.5 #1 notes that aggregate SP grows when a player is funded; hiding the number does not remove the 1,000 from the system, and any aggregate-only public statistic would still move when a player is created. Whether that is acceptable is a visibility question (§7 rule 22).
6. **Temporary non-conservation.** In a placement match that includes a Rated participant the match is no longer zero-sum: the Unrated participant's change has no matching Rated-side change, so aggregate SP drifts for the duration of placement. This is the approved D11 trade-off, not a ledger defect — reconciliation is per account and remains exact.

#### 7.2.10 Unresolved decisions and approved placement rules

**Approved placement rules** (the only approved parts of §7.2):

| # | Decision | Approved | Detail |
| --- | --- | --- | --- |
| D11 | Rated participants receive no SP change in a placement match | 2026-11-01 | No gain, no loss, no ledger transaction, balance unchanged; the Unrated participant's provisional SP still updates and the match still counts; applies to singles and to every Rated doubles participant; no retroactive adjustment after qualification (§7.2.4) |
| D12 | Placement Match Eligibility Policy | 2026-11-01 | A match counts only when actually played and finalized. Approves the 8 eligible and 11 ineligible situations, the additional conditions, and the credit rules: one credit per eligible Unrated participant, none for Rated participants (D11), progress from unique finalized credits, no duplicate credit on correction/resubmission/replay, void-not-delete on invalidation, historical matches only when reliably verified (§7.2.2, §7.2.5). Approves eligibility and credit outcomes only; implementation, schema, the 10-match count, the initial value, the formula, doubles distribution, qualification design, and seasons remain unapproved |

**Still unresolved.** Each row matches an open entry in the §7 register. Recommendations and analysis are recorded above but are **not** decisions.

| # | Decision | What is proposed or understood | What must still be decided |
| --- | --- | --- | --- |
| 1 | Final approval of the 10-match placement requirement (§7 #16) | 10 eligible finalized matches; permanent `UNRATED → RATED` transition | Confirm 10, the effective date, and the rule version that carries it |
| 2 | Whether the initial provisional value remains 1,000 (§7 #20) | The existing starting award becomes the provisional balance | Confirm the amount, and whether it is ever re-based by a new rule version |
| 3 | Exact qualification transaction and concurrency behavior (§7 #21) | One locked, idempotent transaction at the 10th finalized match; no un-qualification | Approve the transaction shape, retry semantics, and the post-qualification correction/back-dating behaviour |
| 4 | Public and player-facing visibility rules (§7 #22) | Number hidden; progress count shown; staff-only audit reads; placement rows become ordinary history after qualification | Approve exactly who may read provisional values and whether prior placement rows appear in the player's visible history |
| 5 | Interaction with seasons and seasonal deductions (§7 #23) | No seasonal implementation; qualification must not rewrite snapshots | **RESOLVED during the seasonal decision review — S10/S11 (§7.3):** Unrated players are excluded from the seasonal ranking and receive no seasonal deduction; placement matches are not retroactively added to Seasonal SP; qualification does not rewrite a snapshot. The snapshot and archive design is approved as S19 (§7.3) |
| 6 | Historical migration, verification, and ledger compatibility (§7 #24) | **D12 principle:** historical matches count only when eligibility can be reliably verified. No automatic backfill; existing players backfill `RATED` unless a verified historical placement match exists; no edit to migrations 001–010 or the applied rule row | Approve the verification standard, the migration boundary, the backfill, and whether any historical match is actually credited |
| 7 | Doubles distribution and rounding (§7 #6, §7 #12, §7 #13) | **D13 approved the even split, the lower-id odd point, and half-up rounding before the multiplier.** Under D11 the share that would have gone to a Rated partner is not applied. D12 already fixes the credit: one per Unrated participant regardless of composition | Decide only whether an Unrated partner receives their own share (as illustrated in §7.2.4) or the whole team adjustment under the D11 asymmetry |
| 8 | Final approval of the SP formula (§7 #1, §7 #2, §7.1) | **RESOLVED 2026-11-03 — D13:** base 20, coefficient 0.02, clamp 5–40, half-up before ×2, floor 0, no ceiling, even split; `approved-2026-11` is enabled | Nothing — the formula is approved; only implementation remains |
| 9 | Final schema and RLS implementation design (§7 #22, §7 #24, §7.2.7) | Three designs analysed (exposure gating, split balances, separate provisional store); none chosen | Approve the exposure model, the policy successor to 003, placement credits/qualification records, and the migration boundary |
| 10 | Sufficiency of existing finalization states and the result marker (§7 #25) | **D12 policy approved:** the ordinary confirmed/auto-approved friendly and completed tournament match are identifiable, but no state expresses retirement, walkover, no-show, forfeit, or a resolved dispute | Approve the result/termination marker needed to apply D12 to retirement and to exclude exceptional outcomes; decide whether a separate resolved-dispute state is required |
| 11 | Dispute resolution workflow (§7 #8) | **D12 approves the outcome:** a resolved dispute can count once if the final result is a valid played match. No workflow is invented here | Approve who resolves a dispute, by what process, and which final state records the resolution |
| 12 | SP treatment for walkover / forfeit / withdrawal / DQ (§7 #9) | **D12 settles placement eligibility:** these do not count, and retirement counts only with an official final result. SP movement is a separate question | Decide whether and how **SP** changes for these outcomes; this does not reopen D12's eligibility list |

Nothing in §7.2 is authorized for implementation. D11 and D12 approve only their stated scopes; the placement system, the 10-match requirement, the initial provisional value, qualification design, seasons, and the schema/RLS implementation remain unapproved. The §7.1 formula is approved by D13 and enabled, and both friendly and tournament matches use it; placement does not. The order is: approve the remaining placement decisions, then propose the migration and rule version that implement them. Until then, `provisional-2026-11` stays disabled, `approved-2026-11` awards confirmed friendlies and completed tournament matches, and no placement or unplayed match moves SP.

---

### 7.3 Approved seasonal SP decisions (S1–S23)

> **STATUS: APPROVED BUSINESS RULES — IMPLEMENTED IN MIGRATION 018 (LOCAL; HOSTED APPLY PENDING).** S1–S23 are
> approved club rules (S1–S15 in the first seasonal review, S16–S23 in the continued review that closed §7.4).
> **Approval date: approved during seasonal decision review; approval date to be recorded.** Migration 018 implements
> the rules as schema, RPCs, policy 018, the `/admin/seasons` management screen, and the seasonal standings panel on
> `/shuttlepower`. Migration 018 is **not** applied to the hosted project; apply it after 017 and before policy 018.
> Placement matches (§7.2) and SP for unplayed matches remain outside this implementation.

The identifiers are new and deliberately distinct from `D1–D12`: those record the architecture and placement
decisions and keep their meaning. Each S decision answers one or more rows of the §7 register or of §7.4, which are
retained in place with their original text. Where an approved seasonal rule contradicts an earlier statement in this
document, the conflict is listed in the conflicts table below and the earlier statement is annotated, never
deleted.

#### S1 — Seasonal SP structure

- Current SP and Seasonal SP are **separate balances**.
- **Current SP** carries over between seasons and remains the permanent competitive rating.
- **Seasonal SP** resets to zero at the start of every new season.
- Seasonal SP tracks the **net actual SP gains and losses** from eligible finalized matches during the season.
- **Seasonal deductions affect Current SP only.** A deduction never reduces Seasonal SP.
- Seasonal SP **may become negative**.
- A player with negative Seasonal SP is **excluded from seasonal rankings**; a player at exactly zero remains
  eligible.
- Seasonal SP is not a replacement for Current SP.

#### S2 — Season duration and boundaries

- A season lasts **12 months** and follows the fixed calendar year: **January 1 – December 31**.
- Boundaries use **`Asia/Manila` (UTC+8)**: a season starts January 1 at 12:00 AM and ends December 31 at
  11:59:59 PM Philippine time.
- Timestamps may be stored in UTC, but **every season-boundary calculation must use `Asia/Manila`**.

> **Conflict with register row 10:** the earlier understanding was "every three months". S2 supersedes it. The row is
> retained with a dated approval note; no quarterly season may be implemented.

#### S3 — Automatic season transition

Every January 1 the system transitions seasons without manual intervention:

1. Close the previous season.
2. Finalize seasonal standings from the approved cutoff rules (S5, S12).
3. Generate the previous season's deduction batch.
4. Activate the new season.
5. Reset Seasonal SP to zero.
6. Preserve Current SP.
7. Allow the new season to begin even while earlier deduction batches are pending.

**Pending deductions must never block the next season.**

#### S4 — Failed transition handling (requirements, not behaviour)

- Failed transition steps retry automatically.
- Transition operations are **idempotent**; retries must not duplicate a deduction batch, a deduction transaction, or
  a season reset.
- A Super Admin is notified after repeated failures.
- A Super Admin can inspect and safely resume an incomplete transition.
- Completed steps are preserved when a transition resumes.

#### S5 — Seasonal ranking cutoff

- The cutoff is **December 31 at 11:59:59 PM `Asia/Manila`**.
- Only eligible matches finalized by that deadline count toward the final ranking.
- Pending matches, unresolved disputes, and unfinished matches are excluded from that season's final ranking.
- The new season is not delayed for pending results.

#### S6 — Matches finalized after the season closes

A match finalized after the deadline receives normal Current SP processing when otherwise eligible, contributes
**no** SP change to the closed season's Seasonal SP, contributes **no** SP change to the new season's Seasonal SP,
and keeps its match and SP records for audit.

#### S7 — Corrections to matches finalized in a closed season

- Current SP is adjusted using the **original formula version**.
- Original transactions are reversed and re-applied with a complete audit trail.
- The closed season's Seasonal SP is **not** modified.
- Closed-season rankings are **not** recalculated.
- The correction is **not** transferred to the new season's Seasonal SP.

#### S8 — Seasonal deduction policy

- Deductions use **fixed SP amounts by ranking tier**, not percentages.
- Tiers use **fixed ranking positions**, not percentages of the player population.

| Tier | Position | Deduction |
| --- | --- | ---: |
| Tier 1 | 1st–3rd | 40 SP |
| Tier 2 | 4th–10th | 30 SP |
| Tier 3 | 11th–20th | 20 SP |
| Tier 4 | 21st onward | 10 SP |

- Every eligible Rated player is subject to the deduction for their tier.
- The deduction applies to **Current SP only**.
- It is applied to the **latest Current SP balance at the moment a Super Admin approves the batch**.
- The deduction is **capped at the available Current SP**: if the balance is insufficient, only the available amount is
  deducted and **the remainder is permanently waived** — no debt and no carry-forward.
- Every deduction is **linked to its originating season**.
- The deduction **lowers SP numbers**. It does not move a player through named divisions, and no
  Bronze/Silver/Gold label system exists or is created by this rule.
- At these amounts the deduction lowers every eligible balance and generally **compresses the field toward the
  pack**; it does **not** guarantee that any player changes position.

#### S9 — Deduction batch approval

- A batch must be **reviewed and approved by a Super Admin** before it is applied.
- The Super Admin may **approve or reject a batch only**; individual deduction amounts cannot be edited.
- An incorrect amount is fixed by correcting the source data and recalculating, which produces a **new batch**.
- Rejected batches are **preserved for audit**.
- Batches have **no deadline**: pending batches are preserved indefinitely and may be approved or rejected at any
  time.
- An approved deduction is applied **exactly once**.
- A new season may begin while earlier batches are pending, and a pending batch keeps its originating season while
  applying to the latest Current SP at approval time.

#### S10 — Seasonal ranking eligibility

- Only **Rated** players participate in seasonal rankings.
- A player who is Unrated at the cutoff is excluded from that season's ranking, receives **no** seasonal deduction for
  it, and keeps any previous seasonal ranking for future use.
- A player needs **at least one eligible finalized match** in the season to qualify for the current seasonal ranking.
- A player with **zero eligible matches** is ranked by their **previous seasonal ranking**, which stays valid
  indefinitely until a new ranking is earned.
- A newly Rated player accrues Seasonal SP only from eligible matches finalized **after** becoming Rated; placement
  matches are **not** retroactively included.
- If a player becomes Unrated during a season, their existing Seasonal SP is **preserved for audit**, they are excluded
  from the ranking while Unrated, and ranking eligibility **resumes** if they become Rated again.

#### S11 — Negative and zero Seasonal SP

- A player with negative Seasonal SP is excluded from the current seasonal ranking.
- If they have a previous seasonal ranking, **that ranking determines their deduction tier**.
- A Rated player with negative Seasonal SP and **no** previous ranking receives **no** deduction until they earn a
  ranking.
- A player at **exactly zero** Seasonal SP remains eligible for ranking.
- A player at exactly zero with no previous ranking stays eligible but receives **no** deduction until they finish a
  season with positive Seasonal SP.
- A player who is Unrated at the cutoff receives **no** deduction, whatever their previous ranking.

#### S12 — Seasonal ranking order and ties

Ranked by **Seasonal SP, highest to lowest**, then:

1. Seasonal SP.
2. Match wins.
3. Head-to-head mini-table among the tied players.
4. Game difference.
5. Point difference.
6. Shared rank if the tie remains unresolved.

- For three or more tied players the mini-table contains **only matches among the tied players**.
- If the mini-table cannot resolve the tie, game difference, point difference, and shared rank follow in order.
- **Competition ranking** is used: `1, 2, 3, 3, 5`.
- Tied players take their **shared competition rank** for tier purposes, even when the tie crosses a tier boundary.
- The chain is aligned with **D9** where the two overlap; the conflicts table explains that D9 governs tournament
  standings while S12 governs the seasonal ranking.

#### S13 — Match types that contribute

- Both eligible finalized **friendly** matches and **official tournament** matches contribute their actual SP changes
  to Seasonal SP.
- Friendlies keep the **1×** multiplier; official tournament matches keep the **2×** multiplier, and the adjusted
  amount is what reaches Seasonal SP.
- Placement matches follow the separately approved placement rules (§7.2).
- Ineligible outcomes contribute nothing.

#### S14 — Doubles

- Seasonal rankings are **individual** rankings, never permanent doubles-team rankings.
- Each doubles participant contributes **their own** individual SP adjustment to their own Seasonal SP.
- Singles and doubles results feed the **same** individual ranking.
- The existing doubles calculation, even split, and per-player distribution rules apply unchanged.

#### S15 — Seasonal leaderboard visibility

- A **live public seasonal leaderboard** is published throughout the year and updated as eligible matches are
  finalized.
- It is labelled **Provisional** until the December 31 cutoff.
- The final ranking is determined by the approved cutoff and ranking rules (S5, S12).

#### S16 — A Rated player with zero matches and no previous ranking

A Rated player who finishes a season with **zero eligible finalized matches and no previous seasonal ranking** is:

- **not ranked** for that season;
- given **no seasonal deduction**;
- shown **outside** the seasonal ranking as unranked ("no eligible matches this season"), never at 0 SP inside the
  table.

Inactivity never changes another player's position or deduction tier. This also fixes the reading of S11: "remains
eligible for ranking" means that **zero Seasonal SP is not itself a disqualifier**; it does not give a player without
matches a position.

#### S17 — Administrative and membership status changes

- Ranking presence and the seasonal deduction are decided by the player's status **at the cutoff**: `23:59:59` on
  December 31, `Asia/Manila`.
- Only a player who is **Rated and active** at that moment is ranked and deducted.
- A player who is **suspended, deactivated, or whose account is unlinked** at the cutoff is excluded from that
  season's ranking, receives **no deduction**, and keeps:
  - the Seasonal SP already earned, preserved for audit and never rewritten;
  - their Current SP, unchanged by the status change itself;
  - their last known seasonal ranking (S23), which resumes their tier on return.
- **Earned SP is never clawed back** by a suspension or by any other status change.
- A tournament disqualification affects only the matches it invalidates; it never re-scores a completed season.
- A manual rating-status correction takes effect when it is recorded and **never rewrites a completed season**.
- A player reinstated after January 1 simply missed that season's deduction; there is no retroactive charge.

#### S18 — Tie-break source and counting

- Wins, head-to-head, game difference, and point difference are computed from **one set**: eligible finalized
  **official tournament** matches, scored exactly as **D9** scores them.
- Friendlies contribute to **Seasonal SP only** (S13) and are not tie-break evidence.
- Each doubles participant is credited **individually** with their side's win and with the full game and point values
  of that match (S14).
- A match **ineligible for Seasonal SP** — walkover, no-show, forfeit before play, withdrawal before play,
  disqualification, unplayed fixture — contributes **nothing** to the tie-break. One definition of "eligible
  finalized match" serves the whole seasonal system.
- Only matches finalized by the cutoff (S5) count.
- Two tied players use their **direct meetings** within that eligible tournament set; three or more use the **mutual
  mini-table** first, as D9 does.
- If the eligible set is empty for the tied players, the chain falls straight to **shared rank** (S12). No statistic is
  ever fabricated.

**Trade-off recorded deliberately:** friendlies decide Seasonal SP; tournaments decide tie-breaks.

#### S19 — Seasonal snapshot and archive

- Closing a season writes one **immutable snapshot per player**, in the same transaction as the close (S3): final
  position, Seasonal SP, Current SP at the cutoff, matches played, wins, and the **rule version** used.
- Published historical leaderboards read the snapshot. They are never recomputed from live data.
- A player excluded under S16/S17 is recorded in the snapshot with a **reason code**, so the archive shows why they
  are absent.
- Achievements in v1 are **placement facts only** — finished 1st, top 3, top 10. No badge, medal, or award system is
  approved.
- Snapshots are retained **permanently** and are never rewritten; S7's "a closed season is not recalculated" is the
  governing rule.

#### S20 — Transition, notification, and recovery design (approved rules, not built)

- A scheduled job runs at **00:05 `Asia/Manila` on January 1**, using the project's existing scheduling pattern (the
  friendly auto-approval job), calling **one** privileged RPC that performs S3's seven steps as an idempotent
  transaction.
- Every step records a **checkpoint** keyed by `(season, step)`. A retry is a no-op for a step that already
  completed.
- An incomplete transition retries on the same cadence as the existing scheduled job, with a bounded attempt count.
- Repeated failure raises an **in-app notification for Super Admins** plus an `audit_logs` entry. **No email or push
  channel is approved** — that needs a provider decision.
- A Super Admin-only recovery view lists the incomplete transition, its failed step, and the preserved checkpoints,
  and allows a safe re-run.
- A job-written row records a **service identity** in its metadata instead of a fabricated actor, because a scheduled
  job has no signed-in user.

#### S21 — Placement matches and Seasonal SP

**No participant in a placement match accrues Seasonal SP**, and no zero-delta row is written for anyone:

- the **Unrated** participant is not yet Rated, and S10 accrues Seasonal SP only from matches finalized after
  qualification;
- every **Rated** participant receives no SP change at all under D11, so there is no amount to accrue.

This matches D11's "no ledger row" rule and the `sp_delta <> 0` constraint.

#### S22 — No playoff for a seasonal tie

- A tie that survives point difference is **shared**, never settled by a match. D9's playoff remains
  **tournament-only**.
- Per S12, tied players take the tier of their **shared competition rank**, including across a tier boundary: a tie
  at 20th and 21st makes both players 20th, and both take the tier-3 deduction.
- A more lenient treatment for a boundary tie — charging both the lower tier — is **not adopted**; it would need its
  own approval.

#### S23 — Retention of a last known ranking

- A player's last known ranking is the **most recent snapshot in which they actually earned a ranking** (S19).
- It persists **indefinitely**, survives any number of seasons with no eligible matches, is never decayed, and is
  never recalculated.
- It is **not cleared** by a suspension, a deactivation, or becoming Unrated (S17, S10); it resumes the player's
  deduction tier when they return.
- Ranking decay would be a new decision, not an implementation choice.

#### Seasonal SP and Current SP — the approved separation

| | Current SP | Seasonal SP |
| --- | --- | --- |
| Purpose | Persistent competitive rating | Season-specific net balance for the seasonal ranking |
| Carries over | Yes, indefinitely | No — resets to zero each season |
| Fed by | Every eligible SP change | Every eligible SP change inside the season |
| Changed by a seasonal deduction | **Yes** (capped at the available balance) | **No** |
| Changed by a season reset | **No** | **Yes** (to zero) |
| Can be negative | Governed by the approved §7.1 floor (0) | **Yes** |
| Affects | Strength comparison and placement | Seasonal ranking, tier, and deduction |

**No inactivity-based SP deduction has been approved.** Seasonal ranking and seasonal deductions must never be
confused with an inactivity penalty; none exists, and none may be implemented without a separate decision.

#### Conflicts found and how they were handled

| # | Existing text | Conflict | Handling |
| --- | --- | --- | --- |
| 1 | §7 register row 10: "Season boundaries — every three months" | S2 fixes a 12-month calendar year | S2 governs. Row 10 is kept with a dated approval note; no quarterly season may be built. |
| 2 | §7.1.10: the Current/Seasonal split "is a recommended design, not a confirmed club rule" | S1 confirms it | §7.1.10 annotated and the original sentence retained. |
| 3 | §7.1.10: "the balance a deduction applies to is unresolved" | S8 approves **Current SP only** | §7.1.10 annotated; §7.1.8 row 8 marked approved. |
| 4 | §7.1.10: "the tiers, the exact amounts, and the rank basis are open" | S8 and S12 settle all three | §7.1.10 annotated; register rows 3, 4, and 15 marked approved. |
| 5 | §7.1.10: "Phase 8 stays blocked by §7 rules 3–5, 10, and 15" | Those rules are now approved | The block becomes an **implementation** gate. §7.1.10 and §6 Phase 8 updated; no seasonal code authorised. |
| 6 | D9 round-robin tie-break ends in a **playoff match**; S12 ends in a **shared rank** | Apparent conflict in the final tie-breaker | Not a conflict of scope: D9 governs **tournament standings**; S12 governs the **individual seasonal ranking**. A seasonal tie that survives point difference is shared; a tournament tie still reaches a playoff. **D9 text is unchanged.** |
| 7 | §7.2.8, register row 23, and §7.2.10 row 5 ask whether an Unrated player appears in seasonal output and whether a deduction can touch provisional SP | S10/S11 answer both | Those places are annotated as resolved; the snapshot/archive design is now approved as S19. |
| 8 | §7.1.5 #16: a seasonal deduction must stay a separate `season_deduction` transaction referenced to a season, never folded into match calculations | None — S8/S9 require exactly this | Recorded as confirmed, not changed. |
| 9 | `AGENT.md` §4 and §7.1.10: "higher-ranked players lose more" | None — consistent with S8's descending tiers (40 → 10) | No change. S8 uses fixed amounts, so the statement holds **between** tiers, not inside one. |

### 7.4 Seasonal questions closed during the review (S16–S23)

S1–S15 settled the seasonal business rules. The eight items below were open after that review; each is now answered by
S16–S23, with its original rationale retained. Nothing at the business-rule level remains open for the seasonal
system.

| # | Question | Why it was open | Resolution (approved) |
| --- | --- | --- | --- |
| 1 | A player with **no previous ranking and zero eligible matches** | S10 sends a zero-match player to their previous ranking and S11 covers the negative and zero cases, but the combination with no previous ranking at all is not stated | **S16:** not ranked, no deduction, shown outside the ranking as unranked; inactivity never moves another player's position or tier; S11's "eligible" means zero SP is not a disqualifier |
| 2 | Exceptional or administrative rating-status changes | Suspension, deactivation, disqualification, account unlink, a manual rating-status correction, and a later reversal are not covered by S10/S11 | **S17:** status at the cutoff decides; excluded players receive no deduction and keep earned Seasonal SP, Current SP, and their last known ranking; earned SP is never clawed back; a status correction never rewrites a completed season |
| 3 | Tie-break mechanics | S12 fixes the order but not how "match wins", "game difference", and "point difference" are counted for an individual across mixed formats (one game vs best-of-three) and in doubles | **S18:** all four statistics come from eligible finalized official tournament matches using the D9 definitions; doubles credited per player; ineligible matches contribute nothing; an empty set falls to shared rank; friendlies decide Seasonal SP, tournaments decide tie-breaks |
| 4 | Seasonal archive and achievements | `AGENT.md` Phase 8 names an achievement archive and a historical leaderboard; no seasonal decision defines its contents, snapshot timing, or retention | **S19:** one immutable per-player snapshot written in the season-close transaction (position, Seasonal SP, Current SP at cutoff, matches, wins, rule version); history reads the snapshot; excluded players carry a reason code; achievements are placement facts only; permanent retention |
| 5 | Transition, notification, and recovery design | S3/S4 require an automatic January 1 transition with retries, Super Admin notification, inspection, and safe resume; the scheduler, job identity, notification channel, and recovery screen are undecided | **S20:** a scheduled job at 00:05 `Asia/Manila` on January 1 (existing scheduling pattern) calls one idempotent privileged RPC with per-step `(season, step)` checkpoints; bounded retries; in-app Super Admin notification plus audit entry (no email or push); a Super Admin recovery view with safe re-run; job rows carry a service identity |
| 6 | Seasonal SP for a Rated participant in a placement match | D11 gives them no SP change, so S13 implies no Seasonal SP movement, but this is not stated explicitly | **S21:** no participant in a placement match accrues Seasonal SP and no zero-delta row is written — the Unrated player is not yet Rated (S10) and the Rated side has no SP change (D11) |
| 7 | Whether a season-ending tie should ever be played off | S12 ends in a shared rank while D9 permits a playoff for tournament standings; the scope split is recorded, but the club has not said whether a **tier-deciding** seasonal tie may ever be resolved by a match | **S22:** no playoff. A surviving tie is shared, and the shared competition rank sets the tier even across a boundary (a tie at 20th/21st gives both the tier-3 deduction). D9's playoff stays tournament-only; a lenient boundary treatment is not adopted |
| 8 | Retention of a "last known ranking" | S10/S11 say it stays valid indefinitely; archive retention and whether it survives several seasons with no eligible matches are undefined | **S23:** the most recent snapshot in which a ranking was actually earned; persists indefinitely without decay or recalculation; not cleared by suspension or by becoming Unrated; resumes the tier on return; any decay would be a new decision |

All eight rows are answered and implemented in migration 018. What remains is **placement** (§7.2) and SP for
unplayed matches; neither is authorised. The seasonal scheduler, ranking and deduction RPCs, recovery view, snapshot,
and leaderboard are built locally and still need applying to the hosted project after 017.

---

## 8. Non-goals for v1

Payment gateway integration, ELO ratings, public API, native mobile app, light theme, multi-club tenancy, chat/messaging beyond challenge invitations, and AI features.

---

## 9. Status — Phases 1–8 implemented locally

| Group | State |
| --- | --- |
| A — Baseline | ✅ Complete (one initial commit, `.gitignore`, `.gitattributes`) |
| B — Frontend scaffold | ✅ Complete (Vite + React + TS, Tailwind, tokens, ESLint, Vitest) |
| C — Design system foundation | ✅ Complete (19 primitives, 8 shared components, `/dev/ui` gallery at `dev-gallery.html`) |
| D — App shell and routing | ✅ Complete and approved (shell, role-aware nav, guards, 403/404/loading/error, dev-only session) |
| E — Supabase wiring | ✅ Complete (E1–E5; E4 closed in F; client typed; Gate E reconciled) |
| F — Identity migration | ✅ Complete — local 41/41; five SQL files applied to the hosted project; anon is denied on all nine tables |
| G — Auth lifecycle | ✅ Complete — implemented, 67/67 SQL (56 at v12, plus 11 Group H negatives) and 52/52 frontend checks locally; migration 003 and policy 004 confirmed on the hosted project, and the Gate G replay passed there on 2026-11-01 |
| H — Ownership and privacy | ✅ Complete — 11 new negative checks; 67/67 locally; no policy change required |
| I — Seed data | ✅ Complete — seed shape and idempotency checks; hosted re-run repaired the GoTrue 500 |
| J — Tests and docs | ✅ Complete — SQL, frontend, typecheck, lint, format, and build clean; the hosted walkthrough is complete |
| K — Player lifecycle RPCs | ✅ Complete — migration 004 and three Super Admin RPCs; 15 new checks; hosted application verified and anon denied |
| L — Directory and profile UI | ✅ Complete — directory, profiles, add/edit, role editor, and link/unlink tools; 71/71 frontend |
| M — Seed, types, docs, verification | ✅ Complete — unlinked demo player, types validated against migration 004, docs current; 90/90 SQL, 71/71 frontend, build clean |
| N — Tournament engine (Phase 3) | ✅ Complete — pure engines, migration 005 + policy 005, and the staff UI; 109/109 SQL, 110/110 frontend at that gate, checks clean; hosted migration 005 and policy 005 applied and the Phase 3 walkthrough passed on 2026-11-01 |
| O — ShuttlePower scaffold (Phase 4) | ✅ Complete in code — migration 006 (rule versions + reconciliation), pure config-driven engine, `/shuttlepower`; 116/116 SQL, 131/131 frontend, checks clean; hosted migration 006 and policy 006 applied, rule reads and reconciliation verified. **D13 (2026-11-03) enabled the approved `approved-2026-11` rule (migration 016), and migration 017 (D14) adds the tournament award and F4 reversals, so confirmed friendlies and completed tournament matches now award SP** |
| P — Training and payments (Phase 6) | ✅ Complete and hosted-verified — migration 007 (sessions, attendance, fee periods, soft-voided payments), audited RPCs, `/training` and `/payments`, own-record visibility; 124/124 SQL, 146/146 frontend at that gate, checks clean. Hosted migration 007 and policy 007 applied; the 2026-11-01 walkthrough created a session, marked three attendance rows, opened a 300-peso fee period, accepted a partial 150 payment (remaining 150), refused an overpayment, and confirmed a player can read only their own payment |
| Q — Club activities (Phase 7) | ✅ Complete and hosted-verified — migration 008 (jersey projects, designs, sizes, and orders; polls with option-level votes; announcements) with twelve audited RPCs, `/jerseys`, `/polls`, `/announcements`; migration 009 (design mockups in a public storage bucket, staff-only `set_jersey_design_image`); 134/134 SQL, 156/156 frontend at that gate, checks clean. Hosted migrations 008–009 and policies 008–009 applied; the 2026-11-01 walkthrough opened a project, submitted and then updated one order without a duplicate, opened and closed a poll (one vote row after a re-vote, tallies hidden until close), and kept a draft announcement hidden until publication |
| R — Friendly matches (Phase 5) | ✅ Complete and hosted-verified — migration 010 (`friendly_matches`, six player RPCs, 24-hour auto-approval job), policy 010, `/matches`; **confirmed results now award SP under D13** (migration 016 enabled the approved rule); 142/142 SQL, 170/170 frontend at that gate, checks clean. Hosted migration 010 and policy 010 applied; the 2026-11-01 walkthrough ran challenge → accept → winner submits → loser approves to `confirmed`, blocked the challenger accepting, the loser submitting, and the winner approving, hid the match from a non-participant, wrote no SP row (the rule was disabled then), and left the second match `awaiting_approval` because the auto-approval job returned 0 before the deadline |
| S — Seasons (Phase 8) | ✅ Implemented locally — migration 012 built the seasonal tables and lifecycle; migration 018 adds the S18 ranking and tie-break statistics, the S19 immutable snapshot, the S20 transition job with retries and Super Admin recovery, the seasonal leaderboard panel on `/shuttlepower`, `/admin/seasons`, and the S6/S7 award guards; policy 018 keeps transition rows Super Admin-only. 185/185 SQL and 228/228 frontend at this gate, checks clean. **Hosted apply pending: run migration 018 after 017, then policy 018.** |

**What exists now:** the production frontend with real Supabase authentication, the player directory, the tournament console, the ShuttlePower leaderboard with live friendly and tournament awards, training and payments, jerseys, polls, announcements, and friendly matches, backed by eighteen migrations (ten applied to the hosted project) and fifteen policy files. `backend/` holds the identity/SP tables plus `sp_rule_versions`, the tournament tables, the training tables, the club-activity tables, `friendly_matches`, the seasonal tables, the auth-lifecycle functions, the player lifecycle, tournament, training, club-activity, and friendly-match RPCs, the friendly and tournament SP awards with F4 reversals, the seasonal ranking, transition, and deduction RPCs, and `reconcile_sp_balances()`. Sign-up, pending review, approval/rejection, role assignment, suspension, the one-time 1,000 SP award, directory and profile management, audited role/link changes, tournaments with draws and corrections, the current-SP leaderboard, personal ledger history, the balance check, training sessions and attendance, manual payments with soft voids, jersey projects and orders, polls, announcements, the challenge-to-approval friendly workflow, the seasonal leaderboard, and Super Admin season management are implemented end to end. Local verification: 185 SQL assertions and 228 frontend tests, with build clean (typecheck and lint still report the pre-existing unused jersey-payment declarations). Hosted verification (2026-11-01): `anon` is denied on every new table and on the reconciliation RPC, a signed-in demo Super Admin reads the provisional rule and a consistent ledger, policy 004 is confirmed, demo sign-in works, and the Phase 3 walkthrough, the Phase 5–7 walkthrough, the Gate G replay, and the owner Super Admin bootstrap are done. **Confirmed friendlies and completed tournament matches now award SP under the approved D13 rule, and a corrected tournament result reverses and re-awards under D14; placement and unplayed matches still award nothing.** The remaining product work is the placement system (§7.2) and SP for unplayed matches; migration 018 is local only and must be applied to the hosted project after 017, before policy 018.

**Supabase status (Groups E–F):** the project is connected and verified with the publishable key: GoTrue v2.197.0,
database API reachable, no stored session. Migrations 001–002 and policies 001–003 are committed, verified locally,
and **applied to the hosted project**; `npm run check:supabase` passes. Generated types for every table and RPC live
in `frontend/src/types/database.ts`, and the client is typed; the committed file covers migrations 001–010.
Email confirmation is disabled for development and
verified (`mailer_autoconfirm: true`, Email provider enabled); production must require confirmation. Group G's
real session provider, registration UI, and approval RPCs are implemented and **migration 003 is live** there: a
publishable-key probe resolves all six functions and denies `anon` with `42501`.Policy 004 narrows only `authenticated` grants, so it cannot be read back through the API; the owner confirmed
`has_table_privilege('authenticated', 'public.profiles', 'INSERT')` is `false` and that `profiles_insert_self_pending`
is gone. Migration 004 adds the Group K RPCs, migration 005 the tournament tables and RPCs, migration 006 the
rule versions and reconciliation, migrations 007–008 the training and club-activity tables and RPCs, migration 009
the jersey-design storage bucket, and migration 010 the friendly-match table and RPCs; every migration and policy
file through 010 is applied. On 2026-11-01 a publishable-key probe returned `42501` for the tournament and rule tables
and for `reconcile_sp_balances()`, while a deliberately missing function still returned `404 PGRST202`; a signed-in
demo Super Admin then read `provisional-2026-11` (provisional, disabled) and `{"checked":7,"consistent":true}`, and
the Phase 5–7 walkthrough passed with the same consistent reconciliation.

**Design note (Group C):** `--color-text-faint` was raised from `#61707F` to `#7A8998` because the original
measured 3.64:1 and failed WCAG AA for small text. It now measures 4.83:1 on the darkest surface and 5.43:1 on `bg`.

**Verification note (Group D):** 32 browser checks passed against the dev build (route guards, direct URL
access, role unions for 1/2/3 roles, unknown routes, skip link, mobile bar at 390px and 360px, dialog focus
trap and focus return, persona persistence) and the production build was checked separately: `/` and
`/players` both resolve to `/sign-in`, and the dev persona strings are absent from `dist/`.

Next action: **apply migration 018, then build the placement system.** The seasonal implementation is complete locally (migration 018, policy 018, `/admin/seasons`, and the `/shuttlepower` standings panel) and the hosted project is migrated only through 017, so apply migration 018 after 017 and then policy 018. After that, resolve the placement gates in §7.2 (the 10-match requirement and rules 20–25; rules 17–19 are approved as D12 and D11) and the unplayed-match SP rule (the open part of §7 rule 7). Record each remaining decision here before starting its implementation.

**Placement decisions (v40 — D11 and D12 approved, the rest not approved):** §7.2 records Option A — Hidden Provisional SP: new players remain publicly Unrated for their first 10 eligible finalized matches while a provisional balance is maintained internally and published unchanged at qualification. On 2026-11-01 the club approved **D11**: a Rated participant receives no SP gain, no SP loss, no ledger transaction, and no placement credit in a placement match (singles and doubles), which creates an intentional temporary rating asymmetry. It also approved **D12**, the Placement Match Eligibility Policy: a match counts only when an actual match was played and its result finalized; confirmed/auto-approved friendlies, resolved-in-favour friendlies, and completed tournament matches count; pending, unresolved disputes, cancelled matches, byes, walkovers, no-shows, forfeits before play, withdrawals before play, disqualifications, declined friendlies, and unplayed fixtures do not; retirement after play counts only when an official final result exists. Every eligible Unrated participant receives exactly one credit (each Unrated player in singles and doubles, regardless of composition); Rated participants receive none; progress comes from unique eligible finalized credits, not transactions; corrections, resubmissions, or replays cannot duplicate a credit; and invalidated matches have their credits voided with an audit trail. The 10-match system, the initial provisional value, visibility, qualification design, the D11 Unrated-share question, seasons, and the final schema/RLS remain unapproved; the §7.1 formula and even doubles split are approved by D13 (2026-11-03). D12's retirement rule is approved, but it cannot yet be applied because the current schema has no result/termination marker. The analysis confirms the **current schema has no rating status, no placement credit or count, no placement marker, no qualification record, and no retirement/walkover/no-show/forfeit/DQ result marker**; `sp_accounts.current_sp` is a single club-readable balance, and the player's own ledger rows are readable under policy 003, so a hidden value cannot be produced by a UI change alone. It also records that `reconcile_sp_balances()` requires the cached balance to equal the ledger sum, so hiding must be an exposure-layer decision, not an accounting one. No source file, migration, policy, engine, configuration, test, or seed changed by that revision; migrations 001-010 and the disabled `provisional-2026-11` rule were untouched. The §7.1 formula was approved later by D13 (2026-11-03).

**Steps only you can do:**

- Create the Supabase project and keep the credentials (Group E1) — **done**.
- Copy `frontend/.env.example` to `frontend/.env.local` and paste `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API — **done**. Never put the service-role or secret key in a `VITE_` variable; `.env.local` is gitignored and must stay uncommitted.
- Email confirmation is disabled for development and verified (`mailer_autoconfirm: true`, sign-ups allowed). Production must require confirmation.
- **Apply the migrations (Group F) — done.** The five SQL files were run in order in the Supabase SQL Editor;
  PostgREST now resolves all nine tables and denies `anon` with `42501`.
- Optionally regenerate types against the hosted project now that migrations 001–010 are applied:
  `supabase gen types typescript --project-id ehftzafmsirzrffrekzk --schema public > frontend/src/types/database.ts`.
  The committed types cover migrations 001–010 and typecheck cleanly; regeneration is the final authoritative
  refresh, not a blocker (the Supabase CLI is not installed in the development environment).
- **Migration 003 — applied and verified.** All six functions resolve and deny `anon` with `42501`.
- **Migration 004 — applied and verified.** All three player-directory functions resolve, and `anon` receives
  `42501 permission denied` for each. A rerun of the migration correctly fails because it is intentionally not
  idempotent; do not paste it again.
- **Policy 004 — confirmed (2026-11-01).** `has_table_privilege('authenticated', 'public.profiles', 'INSERT')`
  returns `false`, and `profiles_insert_self_pending` is absent from `pg_policies`.
- **Migrations 005–006 and policies 005–006 — applied and verified (2026-11-01).** `tournaments`, `matches`,
  `sp_rule_versions`, the tournament RPCs, and `reconcile_sp_balances()` all resolve; `anon` receives `42501` for
  the tables and the RPC, and a deliberately missing function still returns `404 PGRST202`.
  `npm run check:supabase` passes.
- **Migrations 007–010 and policies 007–010 — applied and verified (2026-11-01).** `training_sessions`,
  `training_attendance`, `training_fee_periods`, `training_payments`, `jersey_projects`, `jersey_designs`,
  `jersey_sizes`, `jersey_orders`, `polls`, `poll_options`, `poll_votes`, `announcements`, and `friendly_matches`
  all resolve and deny `anon` with `42501`; a signed-in demo member reads every one of them, and
  `create_training_session`, `create_jersey_project`, `cast_poll_vote`, `create_friendly_challenge`,
  `approve_friendly_result`, and `set_jersey_design_image` all resolve while denying `anon`. No further hosted
  migration work is outstanding.
- **Re-run the development seed (Group I) — done.** The re-run repaired the GoTrue `500 Database error querying
  schema` by normalizing every NULL value it scans into non-nullable Go fields, skipping unique-indexed columns like
  `phone`. Demo sign-in as `ada.demo@example.test` / `mbc-demo-2026` works.
- **Bootstrap the owner's Super Admin (Group J) — done (2026-11-01).** The owner's own account was activated and
  granted `super_admin` once through `set mbc.bootstrap_super_admin_email = '…';` plus
  `backend/seeds/bootstrap_super_admin.sql`.
- **Gate G approval — done (2026-11-01).** The pending request was approved twice; the second call reported
  `already_processed` with exactly one player, one role set, and one 1,000 SP row.
- **Phase 3 hosted walkthrough — done (2026-11-01).** Create → publish → enter → draw → start → record → correct ran
  against the hosted project, including the rejection and correction paths.
- **Phase 5–7 hosted walkthrough — done (2026-11-01).** Through the real RPCs as the seeded demo accounts:
  training session + three attendance rows, a 300-peso fee period with a partial 150 payment, an overpayment
  refusal, and own-payment-only visibility; jersey project with design and size, one order submitted and then
  updated in place (one row), a poll opened, voted, re-voted, closed, and tallies hidden until close; a draft
  announcement hidden until publication; and a friendly match taken from challenge through acceptance, winner
  submission, and loser approval to `confirmed`, with the challenger/loser/winner guards enforced, the match hidden
  from a non-participant, no SP row written, and a second match left `awaiting_approval` because the auto-approval
  job returned 0 before the deadline. `reconcile_sp_balances()` returned `{"checked":7,"consistent":true}` after
  the run. The walkthrough left labelled `Walkthrough …` rows in the development project (one session, one fee
  period, one partial payment, one jersey project and order, one closed poll, one published announcement, one
  confirmed and one awaiting friendly match); they are demo data and can be ignored or removed by the owner.

**Resolved:** first Super Admin bootstrap method (D8), Round Robin tie-break (D9), Mixed Doubles pairing (D10). Remaining open items are the SP and season rules in §7.

---

## Document history

| Version | Date | Change |
| --- | --- | --- |
| v52 | 2026-11-04 | **Seasonal implementation (S1–S23, migration 018).** Adds `matches.finalized_at` with a preservation trigger so a correction keeps its original awarding instant; `season_player_results` gains the S18 tie-break statistics (`tournament_matches`, `tournament_wins`, `game_difference`, `point_difference`), `deduction_position`, `previous_position`, and new exclusion reasons. New `season_transitions` table and policy 018; `active_season_for`, `tournament_entry_players`, `season_player_stats`, `season_head_to_head`, and `season_rankings` compute the S12/S18 order from eligible finalized tournament matches, and `seasonal_standings` backs the leaderboard. `close_season_internal` writes the immutable S19 snapshot, `start_season_internal` activates the next season, and `run_season_transition` checkpoints each step with bounded retries and a Super Admin notification. `award_friendly_sp` and `award_tournament_sp` now resolve the season from the immutable finalization time and enforce the S6/S7 guards. Frontend: a seasonal standings panel on `/shuttlepower` and a Super Admin `/admin/seasons` page for create/start/close, deduction-batch approval and rejection, and transition inspection/re-run, plus manually extended database types. 9 new SQL checks (185 total) and the existing 228 frontend tests pass; typecheck, lint, Prettier, and build clean. **Placement (§7.2) and unplayed-match SP remain open; migration 018 is local only and must be applied to the hosted project after 017, before policy 018.** |
| v51 | 2026-11-03 | **D14 — F4 approved and the tournament SP award implemented (migration 017).** A completed tournament match now awards SP from the enabled `approved-2026-11` rule: one team adjustment from the two team averages using the approved order (clamp → round half-up → ×2), split across the rated players, with an even doubles split and the odd point to the lower player id. Guests and unlinked players without an account are skipped rather than blocking the result; Seasonal SP accrues for the active season (S1, S13). Ledger rows are keyed `tournament:<match>:<player>` and the award is idempotent per player. `reverse_tournament_sp()` writes append-only `reversal` rows keyed to the original row, and `correct_match_result()` now reverses a winner flip and re-awards under the **original** rule version (F4); a score-only correction that keeps the winner writes no SP rows. A reversal never pushes a balance below 0 and never rewrites a closed season's snapshot. Both helpers are internal; clients still cannot award or reverse SP. Seven new SQL checks (176 total) cover the 2× award, replay idempotency, doubles splitting, correction/re-award, the score-only no-op, the disabled-rule no-op, seasonal accrual, and helper privileges. `PLAN.md`, `AGENT.md`, both READMEs, `docs/sp-formula-signoff.md`, and `docs/shuttlepower-decision-brief.md` record F4 as approved; **placement, walkover/forfeit SP, and seasonal implementation remain open.** |
| v50 | 2026-11-03 | **D13 — the §7.1 ShuttlePower formula approved and enabled; rank titles and per-rank positions added to the leaderboard UI.** The club owner approved base 20, strength sensitivity 0.02, the 5–40 per-match clamp, floor 0, no ceiling, tournament ×2, half-up rounding on the magnitude **before** the multiplier, and an even doubles split with the odd point to the lower player id. Migration 016 (`016_approved_sp_rule.sql`) inserts the new `approved-2026-11` rule version and enables it; the applied `provisional-2026-11` row is untouched, so confirmed friendlies now award SP and every prior calculation stays auditable. `domain/sp.ts` was reordered to clamp → round → multiply and its guard now refuses any version that is not both approved and enabled. The five existing SP divisions gained display rank titles (Feather → Rookie, Rally → Challenger, Smash → Striker, Apex → Elite, Legend → Champion) without changing the divisions or the formula; `rankLeaderboard` now carries a `divisionId` and a `divisionPosition`, and `/shuttlepower`, the overview ladder, the fighter card, and the player profile show "rank title · #position" while keeping the overall club position. Tests: 168 SQL checks (including a proof that an equal-rating friendly awards +20/−20 under the approved rule) and 228 frontend checks (including division positions, ties, and the approved operation order), all passing. `PLAN.md`, `AGENT.md`, both READMEs, `docs/sp-formula-signoff.md`, and `docs/shuttlepower-decision-brief.md` now record F1–F3 as approved; **F4 (corrected and invalidated results), tournament awarding, placement, and seasonal implementation remain open.** |
| v49 | 2026-11-02 | **Development tournament demo seed.** `backend/seeds/002_tournament_demo.sql` adds eight unlinked sample players and a published **Sample Open 2026** tournament with two single-elimination events: eight paid singles entries and four paid mixed-doubles teams (one male and one female per team). Every participant is marked paid, so both draws generate immediately from the tournament screen; marking one participant unpaid demonstrates the draw-exclusion rule. The seed uses fixed ids and per-row guards so a re-run adds nothing, and it keeps the `club.environment = development` guard. Group I now also generates both draws through `save_tournament_draw` (162 SQL checks, all passing). Root and backend READMEs document how to load it. |
| v48 | 2026-11-02 | **Tournament registration, player IDs, friends, and notifications (migrations 013–014).** Migration 013 adds a generated `players.player_code` (`MBC-` + the first and last four hex characters of the id), `player_friendships` (request then accept; active linked players only; one pair, retryable after a decline), and `notifications` (per profile, optional tournament link and actor). Six RPCs cover sending, accepting/declining, and removing a friend plus reading and clearing notifications; clients hold SELECT only. Migration 014 adds `tournaments.poster_path` (constrained to `posters/<tournament-id>/<image-id>.(png\|jpg\|jpeg\|webp)`), `tournaments.entrance_fee`, `team_members.id` with nullable `player_id` and `guest_name`/`guest_gender`, `tournament_entry_payments` (one row per participant, fee snapshotted, `unpaid`/`paid`/`waived`), and `tournament_partner_invitations`. New RPCs: `set_tournament_poster`, `set_tournament_entrance_fee`, `set_entry_payment`, `join_tournament_event` (self-entry: singles and guest doubles immediately; a club partner invitation creates the entry only after acceptance), `respond_tournament_partner_invitation`, `cancel_tournament_partner_invitation`, and `withdraw_own_tournament_entry`. Draw coverage counts only fully paid or waived entries; existing entries were backfilled as `waived` at zero. Publishing notifies active club members except the actor. Policies 013–014 show friendships to the two players, notifications to their recipient, payments to staff/the payer/teammates, and invitations to the two players and staff. Frontend: `/tournaments` and `/tournaments/:id` are open to approved members; tournaments carry a poster and per-player fee; staff upload posters, edit the draft fee, add entries, and set each payment; players join singles or doubles with an accepted-friend partner or a guest, answer invitations, withdraw their own entry, and follow the draw; the player profile shows the ID and friend controls; a topbar bell links to `/notifications`. Pure helpers for poster validation/path, guest display, friend pairing, and payment eligibility have tests. 9 new SQL checks (161 total) and 21 new frontend tests (196 total); typecheck, lint, Prettier, and build clean. Migrations 013–014 and policies 013–014 are not yet applied to the hosted project. |
| v47 | 2026-11-02 | **Migration 012 — the seasonal schema (S1–S23), implementation only.** Adds six tables: `seasons` (calendar dates, `scheduled → active → closed`, one active season enforced by a partial unique index), `season_balances` (Seasonal SP per player per season, allowed to go negative), `season_player_results` (the immutable per-player snapshot: position, Seasonal SP, Current SP at cutoff, rule version, and a `negative_seasonal_sp` reason code), `season_deduction_batches` (one pending and at most one approved batch per season, rejection reason preserved), `season_deduction_entries` (fixed 40/30/20/10 tier amounts with applied and waived columns), and `season_transition_steps` (one checkpoint per season and step). Four guarded RPCs: `create_season` (overlap refused), `start_season` (one active), `close_season` (snapshot with `rank()` competition ranking, negative balances excluded, one pending batch generated, checkpoints written, replay a no-op), and `decide_season_deduction_batch` (approve applies to the latest Current SP capped at the balance with the remainder permanently waived and each ledger row keyed `season:<season>:<player>:deduction`; reject needs a reason and applies nothing). `award_friendly_sp` is superseded to accrue Seasonal SP for the active season in the same transaction. Policy 012 keeps balances and snapshots member-readable for the published seasonal leaderboard while deduction batches and checkpoints stay Super Admin-only; no client write grant exists. 6 new SQL checks (152 total, all passing). **Not built:** the S18 tie-break statistics (snapshot columns reserved, left null), the scheduled January 1 job and its recovery screen, seasonal leaderboard UI, and any season-aware placement. No rule version is enabled and migration 012 is not applied to the hosted project. |
| v46 | 2026-11-02 | **Migration 011 — the friendly SP award (implementation, inert).** `011_friendly_sp_award.sql` adds the internal `award_friendly_sp` helper: it reads the single rule version that is both approved and enabled, returns `status: disabled` and writes nothing when there is none, computes the singles change from config with exact integer halving (0.02 = 1/50) and half-up rounding before the multiplier, locks both accounts in player-id order, writes one append-only row per player keyed `friendly:<match_id>:<player>`, honours the configured floor (a zero delta writes no row), and updates the cached balance in the same transaction. `approve_friendly_result` and `auto_approve_friendly_matches` are superseded to call it, so the award is in the confirmation transaction. No new table, policy, or client grant; the helper is revoked from `public`, `anon`, and `authenticated`. 4 new SQL checks (146 total, all passing) cover: nothing awards while no version is enabled; an enabled synthetic rule awards both players exactly once with a replay skipping both and reconciliation still exact; the half-up case (20.5 → 21); and auto-approval awarding once while the helper is uncallable by members or `anon`. The club formula is still unsigned, `provisional-2026-11` is still disabled, no tournament award, reversal, placement, season, or screen exists, and migration 011 is **not** applied to the hosted project. |
| v45 | TBD (formula package follow-up) | **Proposed §7.1.11 — corrected and invalidated results (sign-off decision F4).** Documentation only: a finalized result awards SP once; a changed result is corrected by compensating `reversal` rows keyed to the original row and written in the same transaction as the correction; winner flips reverse then re-award; invalidation reverses every award; retries and replays are no-ops through the unique key; a correction re-awards under the **original** rule version, never the currently enabled one; corrections to a closed season adjust Current SP only (S7, S19); the SP side of the placement void resolves to Option R while the credit-count question in §7.2.5 stays open; no edits, deletions, manual SP, or reconciliation repairs; and five required tests are listed. Added unresolved row 12 to §7.1.8 and cross-linked §7.2.5 rule 4. Also added decision F4 to `docs/sp-formula-signoff.md` and updated that document's "still missing" list. **Not approved and not built:** no code, migration, rule version, test, or seed changed; `provisional-2026-11` remains disabled and no match can move SP. |
| v44 | TBD (continued seasonal review) | **Approved S16–S23 — the eight follow-up seasonal decisions.** Documentation only: added S16 (a Rated player with zero matches and no previous ranking is unranked, undeducted, and shown outside the table, with S11's "eligible" reading fixed), S17 (status at the December 31 cutoff decides ranking and deduction; excluded players keep earned Seasonal SP, Current SP, and their last known ranking; earned SP is never clawed back; a status correction never rewrites a closed season), S18 (the tie-break uses eligible finalized tournament matches only, scored as D9 does, credited per player in doubles, with ineligible matches contributing nothing and an empty set falling to shared rank), S19 (an immutable per-player season snapshot with a reason code for excluded players; placement facts only as achievements; permanent retention), S20 (a January 1 job at 00:05 `Asia/Manila` calling one idempotent RPC with per-step checkpoints, bounded retries, in-app Super Admin notification and recovery view, service-identity attribution, and no email or push in v1), S21 (no participant in a placement match accrues Seasonal SP and no zero row is written), S22 (no playoff for a seasonal tie; the shared rank sets the tier, including across a boundary), and S23 (last known ranking from the most recent earned snapshot, never decayed or cleared). Retitled §7.4 and resolved all eight rows while keeping their original rationale; added the decisions-table and resolved-table rows; updated the header, §7.1.10, §7.2.8, §7.2.10 row 5, the §7.3 conflict row, §6 Phase 8, §7 register closing paragraph, and §9. Phase 8 implementation remains **not authorised** and nothing is built; the §7.1 formula is still unapproved. No code, SQL, migration, policy, engine, configuration, test, or seed changed; nothing staged or committed. |
| v43 | TBD (seasonal decision review) | **Approved S1–S15 — seasonal SP decisions.** Documentation only: added §7.3 with the fifteen approved seasonal rules (separate Current and Seasonal SP with the seasonal balance resetting and allowed to go negative; 12-month calendar seasons in `Asia/Manila`; the automatic idempotent January 1 transition with retry, notification, and recovery requirements; the December 31 cutoff and post-season finalization and correction rules; fixed 40/30/20/10 SP deduction tiers by fixed ranking position, applied to Current SP only, capped at the available balance with the remainder waived, through Super Admin batch approval; Unrated, zero-match, negative, and zero Seasonal SP eligibility rules; the ranking order and tie-break chain with competition ranking and shared ranks; the 1× friendly and 2× tournament contribution and per-player doubles contribution; and the labelled provisional live leaderboard), the Current SP / Seasonal SP separation table, and a conflict register. Added §7.4 for the eight remaining open seasonal questions. Marked register rows 3–5, 10, 15, and 23 approved; annotated §7.1.10, §7.1.8 rows 8–9, §7.2.8, §7.2.10 row 5, §5's seasonal tables, and §6 Phase 8; updated the header, decisions table, resolved table, and §9 next action. The seasonal **schema, scheduler, notifications, recovery, archive, and ranking computation remain unapproved and unbuilt**, as do the §7.1 formula and the placement system. No code, SQL, migration, policy, engine, configuration, test, or seed changed; nothing staged or committed. |
| v1 | 2026-10-30 | Initial plan from `AGENT.md`: architecture options, design system, schema, roadmap, open decisions. |
| v2 | 2026-10-30 | D1–D7 approved. Supabase-only settled. Final folder structure. Full Phase 1 checklist (§6.1). §7 converted to a tracked business-rule register with standing provisional policy. |
| v3 | 2026-10-30 | D8 (first Super Admin via one-time SQL bootstrap), D9 (Round Robin tie-break chain + mini-table rule), D10 (Mixed Doubles one male + one female) approved. §4 gains `players.gender` and Mixed Doubles integrity rules; §7 register drops the two resolved rows into a "Resolved since v2" table; Phase 3 scope updated; Phase 1 Group J4 now specifies the bootstrap script. Group A executed. |
| v4 | 2026-10-30 | Groups B and C executed. `text-faint` token raised to meet AA. Component library and dev-only gallery recorded in §9. |
| v5 | 2026-10-30 | Group D executed. §6.1 gains a "Group D — as built" note recording guarded placeholder routes for later modules, the single navigation/permission config, and the development-only session adapter. §9 status updated with verification evidence. |
| v6 | 2026-10-30 | Group E started. E2/E3/E5 implemented and tested (env validation rejects service-role keys; single lazy client). E1/E4 blocked: no Supabase project or credentials exist and no CLI/Docker is available. Gate E not attempted; F–H remain unstarted. |
| v7 | 2026-10-30 | E1 verified against the live `mbc-arena` project (GoTrue v2.197.0, publishable key accepted, empty `public` schema, no stored session) and `npm run check:supabase` added. E4 remains blocked: no CLI/access token and no tables yet, so types are deferred to F. Gate E not passed. Recorded that email confirmation is still enabled (`mailer_autoconfirm: false`) despite the development decision. |
| v8 | 2026-10-30 | Email confirmation disabled for development. Status fixed as: E1 verified, E4 deferred to Group F, email confirmation disabled for development, Gate E not passed pending formal E4 deferral reconciliation. A live probe still reports the Email provider off (`email_provider_disabled`), recorded as a pre-G check. Group F remains blocked on explicit approval. |
| v9 | 2026-10-30 | Email provider re-enabled with confirmation off. Live verification: `mailer_autoconfirm: true`, sign-ups allowed, and a sign-in probe returns `invalid_credentials` rather than `email_provider_disabled`. Email configuration marked verified for development; production must require confirmation. Gate E still open on the E4 deferral; Group F still awaits explicit approval. |
| v10 | 2026-10-30 | Group F executed. Added the identity migration (7 tables), the minimal Phase 1 SP bootstrap (accounts + append-only ledger), three RLS/policy files with least-privilege column grants and `has_role()`, and a PGlite-backed `npm run test:db` harness (41/41 checks). Decided checked text over Postgres enums. Generated and wired the `Database` types, closing E4 and reconciling Gate E. Hosted application of the five SQL files and a type refresh against the hosted schema remained manual developer steps. Group G not started. |
| v11 | 2026-10-30 | Hosted application confirmed. The developer ran migrations 001–002 and policies 001–003 in the Supabase SQL Editor. Verification: `npm run check:supabase` passes; a PostgREST probe with the publishable key returns `42501 permission denied` for all nine tables to `anon`, so the tables exist and anon grants are revoked. Gate F recorded as passed; Group G still awaits explicit approval. |
| v12 | 2026-10-31 | Group G approved and executed. Real Supabase session provider replaced the dev persona adapter; registration became RPC-only; atomic approval (roles, player create/link, starting SP), rejection with a required reason, and suspend/deactivate/reactivate were added, each `super_admin`-guarded and written to `audit_logs`. Local verification: 56/56 SQL checks including Gate G replay, 52/52 frontend tests, typecheck and lint clean. Hosted project still lacks migration 003 and policy 004 — a publishable-key probe returns `PGRST202` for all six functions. |
| v13 | 2026-10-31 | Group H executed. No policy change was required. Added 11 ownership/privacy negatives: own-profile-only reads and updates, no contact columns, `auth.users` and other members' request emails unreachable, no client writes to roles/`user_roles`/`audit_logs`/SP tables even as a Super Admin, authorization errors for pending, profile-less, manager, and suspended-admin callers, and `anon` holding no table privilege. Widened the column-privilege assertions; 67/67 SQL checks. |
| v14 | 2026-10-31 | Hosted auth lifecycle applied by the project owner. A publishable-key probe with real argument signatures resolves all six functions and returns `42501 permission denied` (they returned `404 PGRST202` before); a missing-function control still returns `404`, confirming the difference is the migration. Policy 004's grant revocation cannot be read back through the API, so the dashboard check is recorded. Local checks unchanged at 67/67. |
| v15 | 2026-10-31 | Group I executed. Added `seeds/001_fictional_players.sql`: six fictional accounts with email identities and hashed development passwords, all four roles, mixed statuses, five player records, an approved and a pending registration request, and five 1,000 SP awards through `grant_starting_sp`. The seed refuses any project not marked `club.environment = "development"` and is idempotent (fixed ids + `on conflict do nothing` + the ledger idempotency key). Three new checks, 70/70. Hosted seed run is still a developer step; the harness stubs auth/pgcrypto. |
| v16 | 2026-10-31 | Group J executed, closing Phase 1. Added the root `README.md` (prerequisites, env vars, seven-file apply order, seed, first Super Admin, commands, security notes) and `seeds/bootstrap_super_admin.sql` (requires a session email, activates a pending profile, grants `super_admin` once, audits once, refuses unknown/suspended accounts, creates no callable function). Four new checks, 74/74; `typecheck`, `lint`, and `build` pass. Remaining: the hosted walkthrough (policy 004 check, seed, bootstrap, demo sign-in) and Gate G/I end-to-end demos. |
| v17 | 2026-10-31 | Hosted walkthrough found a real seed defect. All six demo accounts returned `500 Database error querying schema` on password sign-in while an unknown email returned `400 invalid_credentials`, proving the rows existed but were unreadable by GoTrue. Cause: NULL `confirmation_token`/`recovery_token`/`email_change`/`email_change_token_new`/`email_change_token_current` (supabase/auth#1940). The seed now sets those to `''` and its conflict path repairs existing rows; a regression test covers both. 75/75. Hosted sign-in stays open until the seed is re-run. |
| v18 | 2026-10-31 | The first hosted repair re-run still returned `500 Database error querying schema`. The named-column repair was replaced with a version-proof one: on each run, every NULL text/varchar column in `auth.users` for seeded ids is set to `''`, so a missed, renamed, or version-specific string column (`phone`, tokens, change fields) cannot leave sign-in broken. Tests cover the phone and reauth columns; 75/75. Hosted sign-in remains open pending another seed re-run. |
| v20 | 2026-10-31 | The second hosted repair aborted with `23505` on `users_phone_key`: hosted `auth.users.phone` is unique, so six demo rows cannot share `''`. `phone` is NULL-safe in GoTrue (`storage.NullString`), so the string pass now excludes unique-indexed and generated columns (read from `pg_index`/`information_schema`) and turns an unpredicted `unique_violation` into a notice instead of an abort. The harness declares `phone text unique`, reproducing the failure; 75/75. Hosted sign-in remains open pending the re-run. |
| v21 | 2026-10-31 | Root-caused the surviving hosted 500. Supabase's token indexes (`confirmation_token_idx`, `recovery_token_idx`, `email_change_token_new_idx`, `email_change_token_current_idx`, `reauthentication_token_idx`) are *partial* unique indexes (`WHERE token !~ '^[0-9 ]*$'`), so `''` is outside the index and all six rows can share it. The v20 filter skipped every unique-indexed column, silently skipping exactly the token columns GoTrue scans into plain Go strings, so they stayed NULL. The repair now skips only unconditional unique indexes (`i.indpred is null`) — in practice `phone` alone, which GoTrue reads into `storage.NullString`. The harness declares the five partial indexes and breaks all six rows, so reverting the predicate fails the suite; 75/75. Hosted sign-in remains open pending the re-run. |
| v19 | 2026-10-31 | The text-only repair still left the hosted 500. Rather than guess again, the repair was derived from GoTrue's `internal/models/user.go`: besides the strings, it scans `is_sso_user` and `is_anonymous` into plain `bool` and `email_change_confirm_status` into plain `int`, so a NULL in any of them raises the same unnamed `500 Database error querying schema`. The seed now runs two `information_schema`-driven passes over `auth.users` — `''` for every text/varchar column, `false`/`false`/`0` for those three fields. The harness declares them nullable and the repair assertion covers them, so dropping either pass fails the suite; 75/75. Hosted sign-in remains open pending the re-run. |

| v22 | 2026-10-31 | Phase 2 started. Group K adds migration 004 with three Super Admin RPCs: `set_profile_roles` (replaces a member role set, refuses empty/unknown sets and self-demotion), `link_player_account` (one approved account to one player record, idempotent), and `unlink_player_account` (keeps the record and its history). Each is audited, and clients still cannot write `players.profile_id` directly. The harness covers authority, idempotency, both one-to-one conflicts, pending accounts, direct-write denial, and anon denial; 90/90. Migration 004 is not yet applied to the hosted project. Groups L and M remain. |

| v23 | 2026-10-31 | Group L executed. Added `/players` (search, status filter, three sort orders), `/players/:id` and `/profile` profiles, a staff add/edit dialog, and admin role editing plus link/unlink tools in the Members tab. `MemberSummary` now carries the linked player; role changes refresh the current session. The directory omits SP; a profile shows the current balance where RLS returns it. Fourteen new tests cover player validation, filtering, and date formatting; 71/71 frontend, 90/90 SQL. Migration 004 is still not applied to the hosted project; Group M (unlinked demo seed, type refresh, final docs and suite) remains. |

| v24 | 2026-10-31 | Group M executed, closing Phase 2. The seed adds Gabi Walkin, an active unlinked player with no account or SP ledger, so the audited link flow can be demonstrated; the five linked demo players keep their single 1,000 SP award. Seed assertions now distinguish six player records (five linked, one unlinked) and still prove a second run adds nothing. The committed database types cover migrations 001–004, including the Group K RPCs; the Supabase CLI was unavailable, so those signatures were validated against `004_players.sql` and the file remains authoritative until regenerated against the hosted schema. Root README, backend README, and the plan are current. Full verification is clean: 90/90 SQL, 71/71 frontend, typecheck, lint, Prettier, and production build. Migration 004 and the hosted Phase 1 gates remain developer steps. |

| v25 | 2026-10-31 | Confirmed migration 004 is already applied on the hosted project after a rerun correctly failed with `42723 function "set_profile_roles" already exists`. A publishable-key probe resolves `set_profile_roles`, `link_player_account`, and `unlink_player_account`, each returning `42501 permission denied` to `anon`. No schema repair is needed; migrations are intentionally not idempotent. Docs now record hosted step 8 as applied. Remaining hosted steps are the policy 004 check, the Gate G replay, and the owner's Super Admin bootstrap. |

| v26 | 2026-10-31 | Phase 3 pure domain gate. Added `domain/bracket.ts` (single/double elimination with byes, losers ladder, grand final and conditional reset; circle-method round robin), `domain/standings.ts` (D9 chain with a two-way head-to-head, mutual mini-table for 3+, game/point difference, and a playoff flag for unresolved groups), and `domain/tournament.ts` (cap, duplicates, seeds, missing records, gendered doubles, and D10 Mixed Doubles). Losers-round drop-ins are reversed before pairing to avoid immediate rematches. Twenty-four new tests; 95/95 frontend and 90/90 SQL, typecheck, lint, Prettier, and build clean. Tournament schema, RLS, RPCs, and UI are next; SP enqueueing stays blocked until the SP formula is approved. |

| v42 | 2026-11-01 | Added `docs/shuttlepower-decision-brief.md`, a printable owner-facing summary of every open SP number: the formula parameters, floor and ceiling, doubles split and odd point, the placement system with Path A (formula only) versus Path B (formula plus placement), the unplayed-match rule, a list of decisions that can wait, the post-approval procedure, and a sign-off table. Linked from §7.1.9 and the next-action note; the plan remains the authoritative record. No code, migration, policy, rule, test, or seed changed. |
| v41 | 2026-11-01 | Hosted verification closed. Confirmed migrations 007–010 and policies 007–010 are already applied: every new table and the six probed RPCs resolve and deny `anon` with `42501`, and a signed-in demo member reads all thirteen. Ran the Phase 5–7 hosted walkthrough through the real RPCs (training and payments, jerseys, polls, announcements, friendly matches) with the documented guards, hidden-tally behaviour, no SP movement, no early auto-approval, and a consistent seven-account reconciliation. Corrected the stale status, group table, "What exists now", steps, and next-action text. No code, migration, policy, rule, test, or seed changed. The only remaining product work is the §7 SP and season rules. |
| v40 | 2026-11-01 | **Approved D12 — Placement Match Eligibility Policy.** Documentation only: §7.2.2 now records the approved core principle, eight eligible situations, eleven ineligible situations, the additional conditions (retirement only with an official final result; DQ excluded by default; walkover, no-show, forfeit before play, and withdrawal before play excluded; no duplicate credit on correction; historical matches only when reliably verified), and the approved credit rules. §7.2.5 marks the D12-approved credit outcomes while leaving the transaction/schema mechanism open. Added D12 to the decisions table, the §7 register (rows 17–18 approved; row 19 remains D11), §7.2.0, §7.2.10, §7.2.9, and §9; updated row 24 (historical verification) and row 25 (result/termination marker); restructured the unresolved list so implementation, historical compatibility, doubles, qualification, visibility, seasons, formula, and schema items are retained. D11 is unchanged. The 10-match system, initial provisional value, §7.1 formula, doubles distribution, qualification design, seasons, and schema/RLS remain **unapproved**. No code, migration, policy, engine, configuration, test, or seed changed; nothing staged or committed. |
| v39 | 2026-11-01 | **Proposed placement eligibility policy documented — NOT APPROVED.** Documentation only: §7.2.2 now states the core principle that a match counts only when an actual match was played and its result finalized; lists eight proposed eligible situations (confirmed friendly, 24-hour auto-approved friendly, dispute resolved in favour of a valid played result, completed tournament match, doubles with one credit per Unrated player, two-Unrated matches, Unrated-vs-Rated with the Unrated credited only, retirement after play) and eleven ineligible situations (pending, unresolved dispute, cancelled, bye, walkover, no-show, forfeit before play, withdrawal before play, disqualification, declined, unplayed fixture); distinguishes retirement after play from withdrawal before play; and adds worked singles/doubles/mixed/correction examples. Adds credit rules (exactly one per eligible Unrated participant, none for Rated participants per D11, no duplicates from corrections/resubmissions/replays, progress from unique finalized matches) and the finding that existing friendly/ tournament finalization states cover the ordinary path but cannot express retirement or other exceptional outcomes. §7.2.5 adds finalization, dispute, invalidation/voiding, audit, and atomic/idempotent credit processing. Updated §7 register rows 17, 18, 24 and added row 25; added unresolved rows 12–16 (policy acceptance, retirement, DQ, state sufficiency, historical compatibility); updated §7.2.4, §7.2.6–§7.2.9, §9, and the header. D11 stays approved and unchanged; the 10-match system, eligibility policy, and §7.1 formula remain **unapproved**. No code, migration, policy, engine, configuration, test, or seed changed; nothing staged or committed. |
| v38 | 2026-11-01 | **Approved D11 — Rated opponents receive no SP change during placement.** Documentation only: §7.2.4 now records the approved Rated-side rule (no gain, no loss, no ledger transaction, balance unchanged; every Rated doubles participant included; the Unrated participant still updates and counts), the rationale against reverse-inference, and the intentional temporary asymmetry (SP not conserved across participants, no fabricated zero-delta rows, per-account reconciliation unaffected). Added the approved/resolved records to the decisions table, the §7 register (row 19 marked approved and retained for history), and §7.2.10; updated the counting rules, ledger/security requirements, post-qualification behaviour, schema analysis, compatibility table, and status notes. The 10-match placement system, starting value, visibility, qualification, doubles distribution, seasons, schema, and the §7.1 formula remain **unapproved**. No code, migration, policy, engine, configuration, or test changed; nothing staged or committed. |
| v37 | 2026-11-01 | Unrated players and the 10-match placement system (documentation only; **not approved**). Added §7.2 documenting the selected **Option A — Hidden Provisional SP**: `UNRATED` at approval, 10 eligible finalized matches (friendly and official tournament, one credit per player, all four doubles players), hidden provisional SP starting at 1,000 from the existing `grant_starting_sp` award, publication without reset or bonus at the exactly-once `UNRATED → RATED` qualification, and normal rules afterwards. §7.2.4 analyses Rated opponents and shows that a normal Rated-side delta computed from the hidden value makes it recoverable from one match; no option is chosen. §7.2.6 records the actual schema state (no rating status, placement credit, or qualification record; `sp_accounts` is club-readable; `reconcile_sp_balances()` requires cache = ledger sum) and §7.2.7 lists the future migration/rule-version changes without authorizing them. Added §7 register rows 16–24 and a nine-item decision table. §7.1 remains provisional and NOT APPROVED; migrations 001–010, policies, engine, config, tests, and seeds are untouched. |
| v36 | 2026-11-01 | Provisional SP proposal revised (still unapproved, documentation only). Recommendations: base 20, coefficient 0.02, normal clamp 5–40, half-up rounding before the 2× multiplier (normal cap 40, tournament maximum 80), minimum SP 0, no hard maximum initially, doubles split equally with the odd point to the lower player id, team averages unrounded. Starting SP of 1,000 once per player remains an implemented rule, not a proposal. Added per-parameter reasoning, expanded consistency checks and edge cases (zero-sum vs floor, cap scope, odd splits, exact arithmetic), and an 11-item unresolved register. No code, migration, test, or configuration changed; `provisional-2026-11` stays disabled. |
| v35 | 2026-11-01 | Provisional SP formula proposal documented in §7.1 (base 20, coefficient 0.02, clamp 5–40, 2× tournaments, doubles team averages, 1,000 starting SP already implemented). Eight supplied examples verified, four boundary examples added, zero-sum and saturation properties analysed, and ten unresolved decisions listed. Documentation only: no code, test, or migration changed, and the disabled `provisional-2026-11` row remains the shipped rule. |
| v34 | 2026-11-01 | Phase 5 friendly matches. Migration 010 adds `friendly_matches` with challenge → accept → winner-submits → loser-approves/disputes → 24-hour auto-approval, six player RPCs, one open match per pair, and the pg_cron schedule. Policy 010 exposes a match to its two players and to a Super Admin only. Confirmed and auto-approved results write no SP row, because §7 rule 1 is unapproved; doubles waits on rule 7 and dispute resolution on rule 8. `/matches` replaces its placeholder and states the no-award policy. 14 new frontend tests (170 total) and 8 new SQL checks (142 total); typecheck, lint, Prettier, and build clean. Hosted migration 010 remains. |
| v33 | 2026-11-01 | Jersey design images. Migration 009 adds `jersey_designs.image_path` (constrained to `designs/` paths), the audited staff-only `set_jersey_design_image(uuid,text)` RPC, and a public `jersey-designs` Storage bucket limited to 5 MB PNG/JPEG/WebP. Policy 009 lets only trainers and Super Admins write objects; members read the mockups through the public bucket URL. The design form uploads an optional mockup and every design can have its image added, replaced, or removed, with the old object deleted only after the pointer moves. `features/jerseys/images.ts` holds the pure validation and path rules. 6 new frontend tests (156 total) and 1 new SQL check (134 total); typecheck, lint, Prettier, and build clean. Hosted migration 009 and policy 009 remain. |
| v32 | 2026-11-01 | Phase 7 jerseys, polls, and announcements. Migration 008 adds `jersey_projects`, `jersey_designs`, `jersey_sizes`, `jersey_orders`, `polls`, `poll_options`, `poll_votes`, and `announcements`; twelve audited RPCs guarded by `require_club_staff()`, with `submit_jersey_order` and `cancel_jersey_order` as the only player-facing writes. One active order per player and project, opening requires a design and a size, polls replace the whole submission on re-vote and refuse late or duplicate votes, tallies stay hidden until the poll closes unless results are enabled, and announcements publish once. Policy 008 shows designs to members, orders and votes staff-or-own, and published announcements to everyone. `/jerseys`, `/polls`, and `/announcements` replace their placeholders, with a pure CSV export for the order list. 4 new frontend tests (150 total) and 9 new SQL checks (133 total); typecheck, lint, Prettier, and build clean. Hosted migration 008 remains; design image upload is out because no storage bucket is configured. |
| v31 | 2026-11-01 | Phase 6 training and payments. Migration 007 adds sessions, attendance, fee periods, and soft-voided payments; audited RPCs (`create_training_session`, `set_training_session_status`, `mark_training_attendance`, `create_training_fee_period`, `record_training_payment`, `void_training_payment`) are guarded by `require_training_staff()`. Attendance upserts per session and player, sessions are forward-only, partial payments are allowed while overpayment is refused, and voids require a reason without deleting the row. Policy 007 exposes the schedule and fee periods to all active members while attendance and payments stay staff-or-own. `/training` and `/payments` replace their placeholders, with training and payment modules now visible to players so they can see their own records. 15 new frontend tests (146 total) and 8 new SQL checks (124 total); typecheck, lint, Prettier, and build clean. Hosted migration 007 remains. |
| v30 | 2026-11-01 | Hosted completion. The owner applied migrations 005–006 with policies 005–006 and confirmed policy 004; the Phase 3 walkthrough, the Gate G replay, and the owner's Super Admin bootstrap were completed on the hosted project. Agent-side probes: `anon` receives `42501` for `tournaments`, `matches`, and `sp_rule_versions` and for `reconcile_sp_balances()`, a missing-function control still returns `404 PGRST202`, a signed-in demo Super Admin reads `provisional-2026-11` (provisional, disabled), and reconciliation returns `{checked: 7, consistent: true}`. Status, group table, and "Steps only you can do" now reflect a closed hosted checklist; the next action is choosing Phase 5, 6, or 7, with Phase 4 activation still gated on §7 rules 1–6. |
| v29 | 2026-10-31 | Phase 4 ShuttlePower scaffold. Migration 006 adds versioned `sp_rule_versions` (one provisional, disabled default; an unapproved version cannot be enabled; at most one enabled version) and the Super Admin `reconcile_sp_balances()` report. `domain/sp.ts` is the pure config-driven engine: it refuses provisional or disabled rules, keeps the approved 2× tournament impact and team-average doubles basis, and makes the curve, caps, floor, rounding, and split configuration rather than code. `/shuttlepower` replaces the Phase 4 placeholder with the current-SP leaderboard, the reader's own ledger history, the provisional notice, and a Super Admin balance check. Twenty-one new frontend tests (131 total) and seven SQL checks (116 total); typecheck, lint, Prettier, and build clean. No SP-awarding RPC exists by design, so no balance can move before the formula is approved; hosted migrations 005–006 remain. |
| v28 | 2026-10-31 | Phase 3 tournament UI. `/tournaments` and `/tournaments/:id` replace the placeholder module: tournament creation, forward-only lifecycle actions, per-event tabs, entry registration and withdrawal with D10/seed/cap validation in the domain layer, draw generation from either bracket engine, bracket and round-robin schedule views, result recording and reasoned correction, and D9 standings built from stored games. Shared formatters and status tones extended. Twenty-four new tests; 110/110 frontend, 95/95 SQL (unchanged), typecheck, lint, Prettier, and build clean. Hosted migration 005 and SP enqueueing remain. |
| v27 | 2026-10-31 | Phase 3 database gate. Migration 005 adds tournaments, events, teams, team members, entries, matches, and match games. All tournament tables are read-only to clients; audited RPCs own metadata, lifecycle, entries, draws, results, and corrections. D10, the cap, seeds, draw coverage, bracket advancement, grand-final reset cancellation, and correction order are enforced in the database. Policy 005 exposes drafts to staff only and published tournaments to active club members. The committed types cover the new tables and RPCs. Verification: 109/109 SQL and 95/95 frontend, typecheck, lint, Prettier, and build clean. The tournament UI and hosted migration 005 remain; SP enqueueing stays blocked by the open SP formula. |
