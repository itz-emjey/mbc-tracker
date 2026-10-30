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
```

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
| `src/components/ui/`     | shadcn-style primitives, re-themed to the tokens. Owned code, no kit dependency.                                                          |
| `src/components/shared/` | Composed pieces: `PageHeader`, `StatusBadge`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog`, `FormField`, `PlayerIdentity`. |
| `src/lib/`               | `cn()`, pure helpers (`format`, `status`), and future query/client utilities.                                                             |
| `src/domain/`            | Pure business logic (brackets, standings, SP). No React, no Supabase.                                                                     |
| `src/dev/`               | Development-only component gallery. Never imported by the app entry.                                                                      |

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
