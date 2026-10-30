import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseConfig } from './env'

let client: SupabaseClient | null = null

/**
 * Single Supabase client for the application.
 *
 * Created lazily so a missing or invalid environment produces a readable
 * `SupabaseConfigError` at the point of use instead of a blank page at import
 * time. Session persistence and token refresh are enabled because the app is a
 * long-lived SPA.
 *
 * Group E4 replaces the untyped client with one parameterised by the generated
 * `Database` type once the project exists and types can be generated.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) {
    return client
  }

  const { url, anonKey } = getSupabaseConfig()

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
