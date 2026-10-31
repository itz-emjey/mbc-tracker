import { RouterProvider } from 'react-router-dom'

import { SessionProvider } from '@/features/auth/session-provider'
import { Toaster } from '@/components/ui/sonner'
import { router } from '@/app/router'

/**
 * Application root: real Supabase Auth session source, router, and the single
 * toast host. There is no development persona or fallback identity.
 */
export default function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
      <Toaster />
    </SessionProvider>
  )
}
