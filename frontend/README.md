# MBC Arena — frontend

React + TypeScript + Vite front end for Matag-ob Badminton Club.
Architecture, design rules, and roadmap live in [`../PLAN.md`](../PLAN.md); requirements live in [`../AGENT.md`](../AGENT.md).

## Requirements

- Node 20.19 or newer (tested on Node 24)
- npm 10 or newer

## Commands

Run from this directory:

```bash
npm install        # install dependencies
npm run dev        # dev server on http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm run typecheck  # tsc, no emit
npm run lint       # eslint
npm run format     # prettier --write
npm test           # vitest run
npm run test:watch # vitest watch
npm run check:supabase # verify .env.local reaches the Supabase project
```

## Supabase configuration

The Supabase client is wired and the local project connection is verified, but **authentication and the
database are not implemented yet** (Groups F–G). Until a project is connected, the production build stays signed out.

```bash
cp .env.example .env.local   # then fill in the two values
npm run check:supabase       # prints PASS/FAIL, never the key
```

| Variable                 | Source                                          |
| ------------------------ | ----------------------------------------------- |
| `VITE_SUPABASE_URL`      | Project Settings → API → Project URL            |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → anon / publishable key |

- `.env.local` is gitignored; `.env.example` stays tracked with empty values.
- `src/lib/env.ts` validates both variables on first use, rejects service-role JWTs and `sb_secret_…` keys, and
  throws a readable `SupabaseConfigError` instead of failing silently.
- `src/lib/supabase.ts` creates the single client, typed with the generated `Database` type (session persistence and
  token refresh enabled).
- `npm run check:supabase` probes GoTrue and the database API with the configured key and reports PASS/FAIL without
  printing secrets. It also checks that all nine Phase 1 tables exist and that `anon` receives `42501` from each
  one; the deliberately missing probe table should still return `PGRST205`. If the Auth health request fails with a
  transient network error, re-run once.
- Never place the service-role key in a `VITE_` variable: Vite inlines those values into the public bundle.
- **Database types** live in `src/types/database.ts` and are generated with `supabase gen types`; never edit them by
  hand. Regenerate after every migration (see `../backend/README.md` for the command).

## Design system

- **`src/styles/tokens.css` is the only place raw colour values may appear.** Every utility in
  `tailwind.config.ts` maps to a CSS variable defined there.
- Minimalist dark only: near-black surfaces, 1px borders, one green accent. No gradients,
  glassmorphism, neon, decorative shadows, or emoji as icons. Icons come from Lucide.
- The only allowed shadow is `shadow-elevated`, used by dialogs, menus, and toasts.
- Numbers that must align (SP, scores, ranks) use the `tabular-nums` utility.

## Component structure

| Path                     | Purpose                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`               | Application shell: router, layouts, guards, navigation config, page-level states.                                                         |
| `src/features/auth/`     | Session contract, roles, and the development-only persona adapter (compiled out of production).                                           |
| `src/components/ui/`     | shadcn-style primitives, re-themed to the tokens. Owned code, no kit dependency.                                                          |
| `src/components/shared/` | Composed pieces: `PageHeader`, `StatusBadge`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog`, `FormField`, `PlayerIdentity`. |
| `src/lib/`               | `cn()`, pure helpers (`format`, `status`), and future query/client utilities.                                                             |
| `src/domain/`            | Pure business logic (brackets, standings, SP). No React, no Supabase.                                                                     |
| `src/dev/`               | Development-only component gallery. Never imported by the app entry.                                                                      |

### Application shell and roles

- `src/app/navigation.ts` is the single source of truth for modules, their icons, their phases, and the roles
  allowed to open them. The sidebar, mobile bar, and route table are generated from it.
- Role checks use `hasAnyRole` and are **any-of**, because one account can hold several roles at once
  (for example Tournament Manager + Trainer). There is no role hierarchy.
- Guards (`RequireAuth`, `RequireApproved`, `RequireRole`) only shape navigation. Supabase RLS and database
  functions remain the authority for real data.
- **There is no real authentication yet.** Development builds show a persona switcher labelled "Not
  authentication"; a production build is signed out, `/sign-in` explains that authentication is not configured,
  and protected routes stay closed. `features/auth/dev-session.tsx` is removed from production bundles.

### Status colours

`src/lib/status.ts` holds the single status vocabulary. Add new statuses there, never as
inline badge colours in a feature.

## Component gallery (development only)

The gallery documents every primitive and its states:

```bash
npm run dev
# then open http://localhost:5173/dev-gallery.html
```

It is **excluded from the production build**: `dev-gallery.html` is not a Vite build entry, so
`dist/` contains only the application. Nothing under `src/dev/` is reachable from `index.html`.

## Conventions

- No business logic in `components/`. Tournament and SP rules belong in `src/domain/` and in
  Postgres functions.
- Every exposed table later gets RLS policies and tests in `backend/` — the frontend never
  enforces authorization on its own.
- Loading, empty, and error states are part of "done", not polish.
