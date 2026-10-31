import {
  BarChart3,
  CalendarCheck,
  LayoutDashboard,
  Megaphone,
  Shirt,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { hasAnyRole, type Role } from '@/features/auth/types'

export type ModuleGroup = 'main' | 'admin'

export interface AppModule {
  path: string
  label: string
  /** Short label for the mobile bottom bar. */
  shortLabel: string
  icon: LucideIcon
  description: string
  /** Implementation phase from PLAN.md §6. Undefined means available now. */
  phase?: string
  group: ModuleGroup
  /**
   * Roles allowed to open this module. Omit for "any approved member".
   * A user with several roles sees the union of every module they qualify for.
   */
  roles?: Role[]
}

/**
 * Single source of truth for the module list.
 * The sidebar, the mobile bar, and the route table are all generated from it,
 * so navigation and guards can never disagree.
 */
export const APP_MODULES: readonly AppModule[] = [
  {
    path: '/',
    label: 'Overview',
    shortLabel: 'Home',
    icon: LayoutDashboard,
    description: 'Your current standing and what needs your attention.',
    group: 'main',
  },
  {
    path: '/tournaments',
    label: 'Tournaments',
    shortLabel: 'Events',
    icon: Trophy,
    description: 'Create tournaments, generate brackets, and enter official results.',
    group: 'main',
    roles: ['super_admin', 'tournament_manager'],
  },
  {
    path: '/shuttlepower',
    label: 'ShuttlePower',
    shortLabel: 'SP',
    icon: Zap,
    description: 'Seasonal leaderboard, personal SP history, and rule versions.',
    group: 'main',
  },
  {
    path: '/matches',
    label: 'Friendly Matches',
    shortLabel: 'Matches',
    icon: Swords,
    description: 'Challenges, score submission, and the 24-hour approval window.',
    phase: 'Phase 5',
    group: 'main',
  },
  {
    path: '/players',
    label: 'Players',
    shortLabel: 'Players',
    icon: Users,
    description: 'Club directory and player profiles.',
    group: 'main',
  },
  {
    path: '/training',
    label: 'Training',
    shortLabel: 'Training',
    icon: CalendarCheck,
    description: 'Session schedule, attendance, and your own training record.',
    group: 'main',
  },
  {
    path: '/payments',
    label: 'Payments',
    shortLabel: 'Payments',
    icon: Wallet,
    description: 'Manual fee records with a void-not-delete correction workflow.',
    group: 'main',
  },
  {
    path: '/jerseys',
    label: 'Jerseys',
    shortLabel: 'Jerseys',
    icon: Shirt,
    description: 'Jersey projects, designs, sizes, and player orders.',
    group: 'main',
  },
  {
    path: '/polls',
    label: 'Polls',
    shortLabel: 'Polls',
    icon: BarChart3,
    description: 'Club polls with one response per member.',
    group: 'main',
  },
  {
    path: '/announcements',
    label: 'Announcements',
    shortLabel: 'News',
    icon: Megaphone,
    description: 'Published club announcements.',
    group: 'main',
  },
  {
    path: '/admin',
    label: 'Administration',
    shortLabel: 'Admin',
    icon: ShieldCheck,
    description: 'Registration approvals, role assignment, and account access.',
    group: 'admin',
    roles: ['super_admin'],
  },
]

/** Every module the given roles can open, in navigation order. */
export function modulesFor(roles: readonly Role[]): AppModule[] {
  return APP_MODULES.filter((module) => hasAnyRole(roles, module.roles))
}

/** Resolves the module that owns a pathname (supports nested paths). */
export function findModule(pathname: string): AppModule | undefined {
  if (pathname === '/') return APP_MODULES[0]

  return APP_MODULES.filter((module) => module.path !== '/').find(
    (module) => pathname === module.path || pathname.startsWith(`${module.path}/`),
  )
}

/**
 * Where a signed-in account should land.
 *
 * Sign-out and session expiry remember the current path, so the next sign-in
 * can return there. That path may belong to the previous account's role: after
 * a Super Admin signs out on `/admin`, a multi-role member would be sent back
 * to `/admin` and the role guard would show "Access denied" right after a
 * perfectly valid login. Keep the remembered path only when the new account
 * can open its module; otherwise fall back to the overview.
 */
export function landingPathFor(path: string | undefined, roles: readonly Role[]): string {
  if (!path) return '/'

  const pathname = path.split(/[?#]/)[0] || '/'
  const module = findModule(pathname)

  if (!module || hasAnyRole(roles, module.roles)) return path

  return '/'
}
