# MBC Arena — Implementation Plan

> **Source of truth for requirements:** `AGENT.md`
> **This document:** the approved working plan — architecture, design system, schema, phases, Phase 1 checklist, and open business rules.
> **Status:** v2 — architecture, stack, design, and roadmap **approved 2026-10-30**. Phase 1 checklist finalized and awaiting go-ahead. No code has been scaffolded.

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

---

## 1. Current repository state

| Item | Finding |
| --- | --- |
| Git | Initialized, branch `main`, **zero commits** |
| Tracked files | None |
| Untracked | `AGENT.md` |
| `frontend/` | Empty directory |
| `backend/` | Empty directory |

**Conclusion:** this is a greenfield project. There is no existing work to preserve, so no migration or rewrite risk. Everything below is a proposal, not a constraint.

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
- `sp_accounts` (current + seasonal totals, derived/cached), `sp_transactions` (**immutable ledger, append-only**), `sp_rule_versions`, `seasons`, `season_player_results`, `season_deductions`.

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
- Repo inspection complete: greenfield, zero commits, `frontend/` and `backend/` empty.
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
  `/profile` are deliberately absent until Group E/G can make them real.
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
  `dist/`). Production renders as signed-out with "Sign-in is not configured" until Group E. No mock
  session is presented as authentication.
- **Shell:** 240px sidebar with persisted icon-rail collapse, mobile bottom bar (4 modules + More
  sheet), skip link, scroll-to-top and `document.title` on route change.

#### Group E — Supabase wiring
- [ ] E1. Supabase project created (**manual step: developer creates it and holds credentials**).
- [ ] E2. `.env.example` with `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` placeholders only; `.env.local` gitignored.
- [ ] E3. `lib/supabase.ts` — single client, typed with `Database` generic.
- [ ] E4. `supabase gen types typescript` wired to a script and committed output.
- [ ] E5. Verify no service-role key exists anywhere in `frontend/` or Git history.
- **Gate E:** app boots against the real project; a failed env var produces a clear error, not a blank screen.

#### Group F — Migration 001 (identity)
- [ ] F1. `backend/migrations/001_identity.sql`: `profiles`, `players`, `roles`, `user_roles`, `registration_requests`, `audit_logs`, `app_settings`.
- [ ] F2. UUID PKs, `created_at`/`updated_at` + trigger, FKs, `CHECK` constraints on status enums (as Postgres enums or checked text — pick one and be consistent).
- [ ] F3. Uniqueness: one account per player (`players.profile_id` unique), one role assignment per (profile, role), one open registration request per email.
- [ ] F4. `has_role(uuid, role)` as `security definer`, `search_path` pinned.
- [ ] F5. RLS enabled on **every** table in the migration, with policies in `backend/policies/`.
- [ ] F6. Column privileges: players cannot write `sp_accounts` or role tables — no policy grants it, and no `INSERT`/`UPDATE` grant exists.
- **Gate F:** migration applies from an empty database without manual dashboard edits; re-running it fails loudly rather than silently.

#### Group G — Auth lifecycle
- [ ] G1. Sign up form (email, password, full name) with Zod validation shared with the server check.
- [ ] G2. Registering creates `profiles` (unapproved) + `registration_requests` (pending). **No player record, no SP yet.**
- [ ] G3. `/pending` explains what happens next; pending users cannot reach club modules.
- [ ] G4. Admin approval screen: list pending requests, approve or reject with a reason; suspension/deactivation supported.
- [ ] G5. On approval, a single RPC (`approve_registration`) atomically assigns roles, creates or links the player record, and grants starting SP.
- [ ] G6. `grant_starting_sp`: inserts one `1000` ledger transaction with idempotency key `player:{id}:initial`, guarded by a unique constraint. Called twice → still one row.
- [ ] G7. Every approval/rejection/role change written to `audit_logs` with actor, target, and before/after.
- **Gate G:** approve the same request twice → exactly one player, one role set, one 1,000 SP transaction.

#### Group H — Ownership and privacy checks
- [ ] H1. A player can read only their own `profiles` row and own private fields.
- [ ] H2. A player cannot read another player's contact details.
- [ ] H3. No client path can update `sp_accounts.sp`, role tables, or `audit_logs`.
- [ ] H4. An unapproved user calling a club RPC gets an authorization error, not empty data.
- **Gate H:** policy tests in `backend/tests/` cover each row of the §5 matrix that Phase 1 touches, including the negative cases.

#### Group I — Seed data
- [ ] I1. `seeds/001_fictional_players.sql` — clearly fictional names, 4–6 players, one per role, mixed statuses.
- [ ] I2. Seeding is idempotent and refuses to run against a non-development project.
- [ ] I3. No real member data, no real contact details, ever.
- **Gate I:** reset database → migrate → seed → app shows a usable demo state with zero manual clicking.

#### Group J — Tests and docs
- [ ] J1. Vitest configured; first tests cover `domain/` placeholders and any pure helper in `lib/format.ts`.
- [ ] J2. SQL assertions for: starting SP once, approval idempotency, RLS negatives.
- [ ] J3. `README.md`: prerequisites, env vars, how to apply migrations and seeds, how to run tests, how to create the first Super Admin.
- [ ] J4. `backend/seeds/bootstrap_super_admin.sql` implementing **D8**: one-time `super_admin` assignment for an existing Auth account, idempotent, safe to leave in the repo, **never callable through the API** (no RPC, no Edge Function, no frontend trigger). Documented in `README.md` as a manual step run by the developer.
- **Gate J:** a new developer can go from clone to running app with seed data using only `README.md`.

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

### Phase 3 — Tournament engine
- `domain/bracket.ts`: single elimination (power-of-two + byes), double elimination (incl. grand final reset), round robin generator — **pure, fully unit tested first**.
- `domain/standings.ts`: Round Robin standings with the **approved D9 tie-break chain** — match wins → head-to-head → game difference → point difference → playoff. For 3+ tied participants, compute the mini-table from mutual matches first. Unit tests must cover: clean win order, two-way tie, three-way circular tie (head-to-head skipped), and a tie that reaches the playoff stage.
- `domain/tournament.ts`: entry validation including **D10 Mixed Doubles** (exactly one male + one female per team), mirrored by a database constraint.
- Tournament CRUD, events, entries, doubles teams, seeds, caps.
- Result entry → validate → finalize → advance → recompute standings → enqueue SP at 2x.
- Bracket UI: desktop canvas, mobile round-by-round.
- **Exit test:** the `AGENT.md` §9 tournament checklist all passing, including correction + audit behavior; a same-gender Mixed Doubles pair is rejected by the API even when forced from the client.

### Phase 4 — ShuttlePower
- Immutable ledger, `sp_rule_versions`, config-driven engine (defaults documented as **provisional**, disabled in production until approved).
- Doubles: team-average rating, deterministic rounding, documented split.
- Leaderboard (current + seasonal), personal SP history table.
- Reconciliation job: ledger sum must equal cached totals.
- **Exit test:** exactly-once awards, 2x tournament multiplier, strength-based direction, archive immutability.

### Phase 5 — Friendly matches
Challenge invite → accept → winner submits → loser approves/disputes → **24h server-side auto-approval** via `pg_cron` → SP awarded once with idempotency key. Notifications (in-app first). Dispute escalates to an admin-resolution status, not an invented appeals policy.

### Phase 6 — Training & payments
Sessions, attendance, fee periods, manual payments with paid/partial/unpaid, own-record visibility, audited void/correction.

### Phase 7 — Jerseys, polls, announcements
Projects + designs + sizes, orders with duplicate prevention and export, polls with single/multi choice, anonymity, closing, one-vote enforcement, announcements with publish/archive.

### Phase 8 — Seasons & archives
Season config (timezone-aware), snapshot rankings, archive achievements, rank-based deduction per approved formula, all written to the ledger as new transactions.

### Phase 9 — Quality & deployment
Full RLS matrix test, mobile + accessibility pass, Playwright on the five critical journeys (register→approve, register for tournament, submit/approve match, record payment, vote), production env, backups/export, UAT with club officers.

---

## 7. Unresolved business rules (still open)

Architecture is settled (D1–D10). **These are club rules, not engineering choices.** Do not decide them silently, and do not tune code to a guessed answer.

| # | Topic | Current understanding | Still needs | Blocks |
| --- | --- | --- | --- | --- |
| 1 | SP win/loss formula | Strength-based; beating stronger awards more, losing to stronger costs less | Exact curve and any per-match caps | Phase 4 |
| 2 | SP lower bound | Not specified | May SP fall below zero? | Phase 4 |
| 3 | Seasonal deduction | Higher-ranked players lose more | Rank tiers and exact deduction amounts | Phase 8 |
| 4 | Rank basis for deduction | Not specified | Final leaderboard position vs. rank tier | Phase 8 |
| 5 | Seasonal SP relationship | Seasonal leaderboard exists | How deduction interacts with current vs. seasonal SP | Phases 4, 8 |
| 6 | Doubles SP split | Team average, then distributed | Deterministic rounding + partner split rule | Phase 4 |
| 7 | Friendly doubles approval | Losing side approves | One losing partner or both | Phase 5 |
| 8 | Dispute resolution | Loser may dispute; an admin path exists | Who decides, and by what process | Phase 5 |
| 9 | Walkover / forfeit / DQ | Supported in tournaments | Whether and how SP changes | Phases 3, 4 |
| 10 | Season boundaries | Every three months | Exact dates and the club timezone | Phase 8 |

### Resolved since v2

| # | Topic | Decision |
| --- | --- | --- |
| D8 | First Super Admin | Auth-created account, then a one-time SQL bootstrap assigning `super_admin`. No public admin signup route, no standing bootstrap endpoint. |
| D9 | Round Robin tie-break | Order: **match wins → head-to-head → game difference → point difference → playoff match**. When three or more participants are tied, build a **mini-table from only the matches among the tied players** and apply the same order within it before moving on. Head-to-head is skipped where it cannot resolve the group (more than two tied, or results are circular). Playoff is a scheduled match, not an automatic coin-flip. |
| D10 | Mixed Doubles pairing | Exactly **one male and one female** per team. Enforced in `domain/tournament.ts` and in a database constraint on entry creation. |

**Standing policy until each is answered:**

1. The value lives in config (`sp_rule_versions`, `app_settings`) — never hardcoded.
2. Any UI affected by it shows a visible **"provisional rule — awaiting club approval"** note.
3. No test asserts an unapproved number. Tests assert direction and invariants instead ("stronger opponent ⇒ higher gain", "ledger sum equals balance", "awarded exactly once").
4. The affected workflow ships disabled in production, not silently live.
5. When a decision is made, it is recorded here with a date and the rule version it produced.


---

## 8. Non-goals for v1

Payment gateway integration, ELO ratings, public API, native mobile app, light theme, multi-club tenancy, chat/messaging beyond challenge invitations, and AI features.

---

## 9. Status — Phase 1 in progress

| Group | State |
| --- | --- |
| A — Baseline | ✅ Complete (one initial commit, `.gitignore`, `.gitattributes`) |
| B — Frontend scaffold | ✅ Complete (Vite + React + TS, Tailwind, tokens, ESLint, Vitest) |
| C — Design system foundation | ✅ Complete (19 primitives, 8 shared components, `/dev/ui` gallery at `dev-gallery.html`) |
| D — App shell and routing | ✅ Complete — awaiting approval (shell, role-aware nav, guards, 403/404/loading/error, dev-only session) |
| E–J | ⏸ Not started |

**What exists now:** a production build (`dist/`) with the real application shell: desktop sidebar,
mobile bottom navigation, role-aware module navigation for multi-role accounts, guarded routes,
and loading / unauthenticated / pending / access-denied / not-found / error states. There is **no
database and no authentication**: the production build is permanently signed out and says so. Development
builds use a clearly labelled local persona switcher (`features/auth/dev-session.tsx`) that is compiled out
of `dist/`. No club module renders data yet — each later-phase route shows a "not built yet" state.

**Design note (Group C):** `--color-text-faint` was raised from `#61707F` to `#7A8998` because the original
measured 3.64:1 and failed WCAG AA for small text. It now measures 4.83:1 on the darkest surface and 5.43:1 on `bg`.

**Verification note (Group D):** 32 browser checks passed against the dev build (route guards, direct URL
access, role unions for 1/2/3 roles, unknown routes, skip link, mobile bar at 390px and 360px, dialog focus
trap and focus return, persona persistence) and the production build was checked separately: `/` and
`/players` both resolve to `/sign-in`, and the dev persona strings are absent from `dist/`.

Next action on approval: **Group E only** (Supabase project wiring), then stop at Gate E and report.

**Steps only you can do:**

- Create the Supabase project and keep the credentials (Group E1).
- Paste `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` into `frontend/.env.local`. I will supply the exact values and will never ask you to commit them.

**Resolved:** first Super Admin bootstrap method (D8), Round Robin tie-break (D9), Mixed Doubles pairing (D10). Remaining open items are the SP and season rules in §7.

---

## Document history

| Version | Date | Change |
| --- | --- | --- |
| v1 | 2026-10-30 | Initial plan from `AGENT.md`: architecture options, design system, schema, roadmap, open decisions. |
| v2 | 2026-10-30 | D1–D7 approved. Supabase-only settled. Final folder structure. Full Phase 1 checklist (§6.1). §7 converted to a tracked business-rule register with standing provisional policy. |
| v3 | 2026-10-30 | D8 (first Super Admin via one-time SQL bootstrap), D9 (Round Robin tie-break chain + mini-table rule), D10 (Mixed Doubles one male + one female) approved. §4 gains `players.gender` and Mixed Doubles integrity rules; §7 register drops the two resolved rows into a "Resolved since v2" table; Phase 3 scope updated; Phase 1 Group J4 now specifies the bootstrap script. Group A executed. |
| v4 | 2026-10-30 | Groups B and C executed. `text-faint` token raised to meet AA. Component library and dev-only gallery recorded in §9. |
| v5 | 2026-10-30 | Group D executed. §6.1 gains a "Group D — as built" note recording guarded placeholder routes for later modules, the single navigation/permission config, and the development-only session adapter. §9 status updated with verification evidence. |

