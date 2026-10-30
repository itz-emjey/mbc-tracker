import * as React from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { findModule } from '@/app/navigation'
import { AppSidebar } from '@/app/layouts/app-sidebar'
import { AppTopbar } from '@/app/layouts/app-topbar'
import { MobileNav } from '@/app/layouts/mobile-nav'

const SIDEBAR_STORAGE_KEY = 'mbc:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Authenticated application shell.
 * Sidebar on desktop, bottom bar on mobile, one scroll container, and a single
 * skip link. Page-specific chrome belongs in the page, not here.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = React.useState<boolean>(readCollapsed)
  const currentModule = findModule(pathname)

  React.useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  React.useEffect(() => {
    if (currentModule) {
      document.title = `${currentModule.label} · MBC Arena`
    }
  }, [currentModule])

  const toggleSidebar = () => {
    setCollapsed((previous) => {
      const next = !previous

      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      } catch {
        /* private mode — the in-memory value still applies */
      }

      return next
    })
  }

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-24 rounded-sm bg-surface-2 px-3 py-2 text-sm font-medium text-text ring-2 ring-accent-ring transition-transform duration-fast focus:translate-y-0"
      >
        Skip to content
      </a>

      <AppSidebar collapsed={collapsed} onToggle={toggleSidebar} />

      <div className={collapsed ? 'lg:pl-16' : 'lg:pl-60'}>
        <AppTopbar showContext={collapsed} />

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-6 focus:outline-none sm:px-6 lg:px-8 lg:pb-10"
        >
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
