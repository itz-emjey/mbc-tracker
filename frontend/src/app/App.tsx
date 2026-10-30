import { RouterProvider } from 'react-router-dom'

import { SessionProvider } from '@/features/auth/session-provider'
import { Toaster } from '@/components/ui/sonner'
import { router } from '@/app/router'

/**
 * Application root: session source, router, and the single toast host.
 * The session provider is a development placeholder until Group E wires
 * Supabase Auth; see `features/auth/session-provider.tsx`.
 */
export default function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
      <Toaster />
    </SessionProvider>
  )
}
