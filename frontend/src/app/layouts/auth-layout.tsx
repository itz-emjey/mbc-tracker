import type * as React from 'react'

import { Brand } from '@/app/components/brand'
import { useDocumentTitle } from '@/app/hooks/use-document-title'

export interface AuthLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

/**
 * Standalone layout for screens that must render without the application
 * shell: sign-in, pending approval, and access denied.
 */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  useDocumentTitle(title)

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-4 sm:px-6">
        <Brand />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md">
          <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{description}</p>
          <div className="mt-5">{children}</div>
        </div>
      </main>

      <footer className="px-4 py-4 text-center text-[11px] text-text-faint">
        Matag-ob Badminton Club
      </footer>
    </div>
  )
}
