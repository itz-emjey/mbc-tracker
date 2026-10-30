import { AlertTriangle } from 'lucide-react'

import { Toaster } from '@/components/ui/sonner'
import { BadgesSection, ButtonsSection, FormsSection } from '@/dev/sections/controls'
import { CardsSection, IdentitySection, TableSection, TabsSection } from '@/dev/sections/content'
import { DialogsSection, MenusSection, StatesSection, ToastsSection } from '@/dev/sections/feedback'

const links = [
  { href: '#buttons', label: 'Buttons' },
  { href: '#forms', label: 'Forms' },
  { href: '#badges', label: 'Badges' },
  { href: '#cards', label: 'Cards' },
  { href: '#tabs', label: 'Tabs' },
  { href: '#tables', label: 'Tables' },
  { href: '#dialogs', label: 'Dialogs' },
  { href: '#menus', label: 'Menus' },
  { href: '#toasts', label: 'Toasts' },
  { href: '#states', label: 'States' },
  { href: '#identity', label: 'Identity' },
] as const

/**
 * Development-only component gallery.
 * Not part of the production build: it is loaded from `dev-gallery.html`,
 * which is not a Vite build entry. See README.
 */
export default function DevGallery() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <div className="border-b border-warning-soft bg-warning-soft px-4 py-2">
        <div className="mx-auto flex max-w-5xl items-center gap-2 text-xs text-warning">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <p>Development only. This gallery is excluded from the production build.</p>
        </div>
      </div>

      <header className="border-b border-border bg-surface-1">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-faint">
            MBC Arena
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Component gallery</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Minimalist dark design system. Every value comes from{' '}
            <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-[11px] text-text">
              tokens.css
            </code>
            . Hover and focus states marked “simulated” are forced for documentation screenshots.
          </p>

          <nav aria-label="Gallery sections" className="mt-5 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex items-center rounded-sm px-2.5 py-1.5 text-sm text-text-muted transition-colors duration-fast hover:bg-surface-2 hover:text-text"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <ButtonsSection />
        <FormsSection />
        <BadgesSection />
        <CardsSection />
        <TabsSection />
        <TableSection />
        <DialogsSection />
        <MenusSection />
        <ToastsSection />
        <StatesSection />
        <IdentitySection />
      </main>

      <footer className="border-t border-border px-4 py-6">
        <p className="mx-auto max-w-5xl text-xs text-text-faint">
          Group C deliverable · no club features, no database, no authentication.
        </p>
      </footer>

      <Toaster />
    </div>
  )
}
