import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import { getSupabaseConfig } from './env'

let client: SupabaseClient<Database> | null = null

/**
 * Single Supabase client for the application.
 *
 * Created lazily so a missing or invalid environment produces a readable
 * `SupabaseConfigError` at the point of use instead of a blank page at import
 * time. Session persistence and token refresh are enabled because the app is a
 * long-lived SPA.
 *
 * The client is parameterised by the generated `Database` type
 * (`src/types/database.ts`, produced with `supabase gen types`). Regenerate
 * that file after any schema migration; never edit it by hand.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) {
    return client
  }

  const { url, anonKey } = getSupabaseConfig()

  client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
