# MBC Arena — Implementation Plan

> **Source of truth for requirements:** `AGENT.md`
> **This document:** the approved working plan — architecture, design system, schema, phases, Phase 1 checklist, and open business rules.
> **Status:** v27 - architecture, stack, design, and roadmap approved. **Groups A-M are complete; Phase 3 now has its pure engines and database gate.** Phase 1 and Phase 2 are code- and docs-complete. Phase 3 ships `domain/bracket.ts`, `domain/standings.ts`, and `domain/tournament.ts` with unit coverage for elimination draws, byes, the double-elimination reset, round-robin generation, D9 standings, and D10 entry validation, plus migration 005 (tournament tables, RLS, audited entry/draw/result RPCs) and updated client types. Verification: 109/109 SQL checks, 95/95 frontend tests, typecheck, lint, format, and build all clean. On the hosted project, migrations 003 and 004 are live, the seed ran, the GoTrue `500 Database error querying schema` was repaired, and all three player RPCs are verified with `anon` denied. Remaining hosted steps: apply migration 005, confirm policy 004/005, run the Gate G replay, and bootstrap the owner's Super Admin.

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
| Git | Initialized, branch `main`; Phase 1 (Groups A-J) and Phase 2 (Groups K-M) are committed |
| Tracked files | `AGENT.md`, `PLAN.md`, `frontend/`, `backend/`, root test tooling |
| `frontend/` | React + TS + Vite app: design system, shell, routing, guards, Supabase client, auth/admin screens, player directory and profiles |
| `backend/` | SQL migrations 001–004, policies 001–004, seeds, and the PGlite verification harness |

**Conclusion:** the Phase 1 foundation and the Phase 2 player directory now exist. The hosted database still needs
migration 004 applied by the project owner, and the hosted Phase 1 walkthrough is still open (see §9).

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

**Phase 3 database gate as built (v27):** `migrations/005_tournaments.sql` adds `tournaments`, `tournament_events`, `teams`, `team_members`, `tournament_entries`, `matches`, and `match_games`. Every table is SELECT-only to clients; all writes cross audited RPCs. `create_tournament`, `create_tournament_event`, and `update_tournament_event` own the metadata rules; `set_tournament_status` enforces forward-only draft → published → in_progress → completed → archived and refuses publishing without an event. `register_tournament_entry` enforces the event cap, active player records, one entry per player, unique seeds, and D10 in one transaction, with `validate_tournament_entry()` and `validate_team_member()` as database-level backstops (a same-gender Mixed Doubles pair cannot be forced in even with a direct insert). Withdrawal keeps the row and frees the cap and seed until the draw locks entries. `save_tournament_draw` persists either engine's output in dependency order: sources must point at earlier keys, every registered entry must appear exactly once in an elimination draw, every round-robin pair must appear once, and replacement is refused once a result exists. `record_match_result` validates the game list (no level game, no split match), stores `match_games`, advances winner/loser into dependent sides, and cancels an unnecessary grand-final reset. `correct_match_result` requires a reason, rewrites the games, re-advances, and refuses when a downstream match already has a result. Migration 005 and policy 005 are verified locally at 109/109 SQL checks; the committed database types now cover all seven tables and every RPC. The tournament UI, hosted migration 005, and SP enqueueing remain.

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

## 9. Status — Phase 1 and Phase 2 complete

| Group | State |
| --- | --- |
| A — Baseline | ✅ Complete (one initial commit, `.gitignore`, `.gitattributes`) |
| B — Frontend scaffold | ✅ Complete (Vite + React + TS, Tailwind, tokens, ESLint, Vitest) |
| C — Design system foundation | ✅ Complete (19 primitives, 8 shared components, `/dev/ui` gallery at `dev-gallery.html`) |
| D — App shell and routing | ✅ Complete and approved (shell, role-aware nav, guards, 403/404/loading/error, dev-only session) |
| E — Supabase wiring | ✅ Complete (E1–E5; E4 closed in F; client typed; Gate E reconciled) |
| F — Identity migration | ✅ Complete — local 41/41; five SQL files applied to the hosted project; anon is denied on all nine tables |
| G — Auth lifecycle | ✅ Complete — implemented, 67/67 SQL (56 at v12, plus 11 Group H negatives) and 52/52 frontend checks locally; migration 003 confirmed live on the hosted project, policy 004 pending the dashboard check |
| H — Ownership and privacy | ✅ Complete — 11 new negative checks; 67/67 locally; no policy change required |
| I — Seed data | ✅ Complete — seed shape and idempotency checks; hosted re-run repaired the GoTrue 500 |
| J — Tests and docs | ✅ Complete — SQL, frontend, typecheck, lint, format, and build clean; hosted walkthrough in progress |
| K — Player lifecycle RPCs | ✅ Complete — migration 004 and three Super Admin RPCs; 15 new checks; hosted application verified and anon denied |
| L — Directory and profile UI | ✅ Complete — directory, profiles, add/edit, role editor, and link/unlink tools; 71/71 frontend |
| M — Seed, types, docs, verification | ✅ Complete — unlinked demo player, types validated against migration 004, docs current; 90/90 SQL, 71/71 frontend, build clean |

**What exists now:** the production frontend with real Supabase authentication and the Phase 2 player directory, plus the Phase 1 and Phase 2 database schema applied locally. `backend/` holds four migrations and four policy files: the nine identity/SP tables, the six auth-lifecycle functions, and the three player lifecycle RPCs. Sign-up, pending review, admin approval/rejection, role assignment, account suspension, the one-time 1,000 SP award, the player directory, staff record management, and audited role/link changes are implemented end to end and covered by 90 local SQL assertions and 71 frontend tests (including the Group H ownership/privacy negatives, the Group I seed, the Group J bootstrap, and the Group K lifecycle RPCs); the development persona adapter is gone. Migration 003 is live on the hosted project — all six functions resolve and `anon` is denied — while policy 004's grant revocation still needs the one-line check listed under "Steps only you can do"; migration 004 is applied and its three RPCs resolve with `anon` denied.

**Supabase status (Groups E–F):** the project is connected and verified with the publishable key: GoTrue v2.197.0,
database API reachable, no stored session. Migrations 001–002 and policies 001–003 are committed, verified locally,
and **applied to the hosted project**; `npm run check:supabase` passes. Generated types for the nine tables and every
RPC live in `frontend/src/types/database.ts`, and the client is typed; the committed file covers migrations 001–004.
Email confirmation is disabled for development and
verified (`mailer_autoconfirm: true`, Email provider enabled); production must require confirmation. Group G's
real session provider, registration UI, and approval RPCs are implemented and **migration 003 is live** there: a
publishable-key probe resolves all six functions and denies `anon` with `42501`. Policy 004 narrows only
`authenticated` grants, so it needs the `has_table_privilege('authenticated', 'public.profiles', 'INSERT')` check
described in the Group G note rather than an API probe. Migration 004 adds the Group K RPCs and is applied:
PostgREST resolves all three functions, and `anon` receives `42501` for each.

**Design note (Group C):** `--color-text-faint` was raised from `#61707F` to `#7A8998` because the original
measured 3.64:1 and failed WCAG AA for small text. It now measures 4.83:1 on the darkest surface and 5.43:1 on `bg`.

**Verification note (Group D):** 32 browser checks passed against the dev build (route guards, direct URL
access, role unions for 1/2/3 roles, unknown routes, skip link, mobile bar at 390px and 360px, dialog focus
trap and focus return, persona persistence) and the production build was checked separately: `/` and
`/players` both resolve to `/sign-in`, and the dev persona strings are absent from `dist/`.

Next action: **confirm policy 004**, **bootstrap the owner's own Super Admin**, and replay the Gate G approval. Migration 004 is applied and its three RPCs are verified, the development seed has been re-run, and demo sign-in works. After that, Phase 3 (tournament engine) is next in §6.

**Steps only you can do:**

- Create the Supabase project and keep the credentials (Group E1) — **done**.
- Copy `frontend/.env.example` to `frontend/.env.local` and paste `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings → API — **done**. Never put the service-role or secret key in a `VITE_` variable; `.env.local` is gitignored and must stay uncommitted.
- Email confirmation is disabled for development and verified (`mailer_autoconfirm: true`, sign-ups allowed). Production must require confirmation.
- **Apply the migrations (Group F) — done.** The five SQL files were run in order in the Supabase SQL Editor;
  PostgREST now resolves all nine tables and denies `anon` with `42501`.
- Optionally regenerate types against the hosted project now that migration 004 is applied:
  `supabase gen types typescript --project-id ehftzafmsirzrffrekzk --schema public > frontend/src/types/database.ts`.
  The committed types cover migrations 001–004 and typecheck cleanly; regeneration is the final authoritative
  refresh, not a blocker.
- **Migration 003 — applied and verified.** All six functions resolve and deny `anon` with `42501`.
- **Migration 004 — applied and verified.** All three player-directory functions resolve, and `anon` receives
  `42501 permission denied` for each. A rerun of the migration correctly fails because it is intentionally not
  idempotent; do not paste it again.
- **Policy 004 — confirm the revocation.** In the Supabase SQL Editor run
  `select has_table_privilege('authenticated', 'public.profiles', 'INSERT');` — expected `false` — and
  `select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles';` —
  `profiles_insert_self_pending` should be absent.
- **Re-run the development seed (Group I) — done.** The re-run repaired the GoTrue `500 Database error querying
  schema` by normalizing every NULL value it scans into non-nullable Go fields, skipping unique-indexed columns like
  `phone`. Demo sign-in as `ada.demo@example.test` / `mbc-demo-2026` works.
- **Bootstrap the owner's Super Admin (Group J) — outstanding.** After the owner's own account exists, run
  `set mbc.bootstrap_super_admin_email = '…';` plus `backend/seeds/bootstrap_super_admin.sql`.
- **Gate G approval — outstanding.** With the demo Super Admin signed in, approve the Erin example pending request
  twice (the second call must report `already_processed`), which closes Gate G end to end.

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

| v27 | 2026-10-31 | Phase 3 database gate. Migration 005 adds tournaments, events, teams, team members, entries, matches, and match games. All tournament tables are read-only to clients; audited RPCs own metadata, lifecycle, entries, draws, results, and corrections. D10, the cap, seeds, draw coverage, bracket advancement, grand-final reset cancellation, and correction order are enforced in the database. Policy 005 exposes drafts to staff only and published tournaments to active club members. The committed types cover the new tables and RPCs. Verification: 109/109 SQL and 95/95 frontend, typecheck, lint, Prettier, and build clean. The tournament UI and hosted migration 005 remain; SP enqueueing stays blocked by the open SP formula. |
