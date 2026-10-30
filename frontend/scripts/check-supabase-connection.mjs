#!/usr/bin/env node
/**
 * Verifies that the local Supabase configuration reaches the project.
 *
 * Run from `frontend/` after creating `.env.local`:
 *   npm run check:supabase
 *
 * It prints no secrets — only the project host and the result of each probe.
 * This checks connectivity, key validity, table presence, and that `anon` is
 * denied; authenticated Row Level Security is verified separately in Group H.
 */
import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'

const URL_VAR = 'VITE_SUPABASE_URL'
const KEY_VAR = 'VITE_SUPABASE_ANON_KEY'

const REQUIRED_TABLES = [
  'profiles',
  'players',
  'roles',
  'user_roles',
  'registration_requests',
  'audit_logs',
  'app_settings',
  'sp_accounts',
  'sp_transactions',
]

const env = loadEnv('', process.cwd(), '')
const url = (env[URL_VAR] ?? '').trim()
const key = (env[KEY_VAR] ?? '').trim()

const failures = []

function fail(message) {
  failures.push(message)
  console.error(`FAIL  ${message}`)
}

function pass(message) {
  console.log(`PASS  ${message}`)
}

if (!url) fail(`${URL_VAR} is missing. Copy .env.example to .env.local.`)
if (!key) fail(`${KEY_VAR} is missing. Copy .env.example to .env.local.`)

let keyKind = 'unrecognised'
if (key) {
  if (key.startsWith('sb_publishable_')) {
    keyKind = 'publishable'
  } else if (key.startsWith('sb_secret_')) {
    keyKind = 'SECRET'
  } else if (key.split('.').length === 3) {
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const decoded = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))
      keyKind = `jwt:${JSON.parse(decoded).role ?? 'no-role'}`
    } catch {
      keyKind = 'jwt:unreadable'
    }
  }
}

if (keyKind === 'SECRET' || keyKind === 'jwt:service_role') {
  fail(`${KEY_VAR} is a service-role/secret key. Only the anon or publishable key may be used.`)
} else if (key && keyKind === 'unrecognised') {
  fail(`${KEY_VAR} does not look like a Supabase anon or publishable key.`)
}

if (url && key && failures.length === 0) {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    fail(`${URL_VAR} is not a valid URL.`)
  }

  if (host) {
    console.log(`Checking ${host} with a ${keyKind} key\n`)
  }

  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15000),
    })
    const body = await response.json().catch(() => null)

    if (response.ok && body?.name === 'GoTrue') {
      pass(`Auth reachable (GoTrue ${body.version ?? 'unknown'})`)
    } else {
      fail(`Auth health check returned ${response.status}`)
    }
  } catch (error) {
    fail(`Auth health check failed: ${error.message}`)
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data, error } = await client.auth.getSession()

    if (error) {
      fail(`Local session read failed: ${error.message}`)
    } else if (data.session === null) {
      pass('No stored session (expected for a fresh client)')
    }

    const { error: restError } = await client
      .from('__mbc_connectivity_probe__')
      .select('*')
      .limit(1)

    if (restError?.code === 'PGRST205' || restError?.code === '42P01') {
      pass('Database API reachable and the key is accepted (probe table intentionally absent)')
    } else if (restError) {
      fail(`Database API probe failed: ${restError.message} (${restError.code ?? 'no code'})`)
    } else {
      pass('Database API reachable')
    }

    let tableFailures = 0

    for (const table of REQUIRED_TABLES) {
      const { data, error } = await client.from(table).select('*').limit(1)

      if (error?.code === 'PGRST205' || error?.code === '42P01') {
        fail(`Table public.${table} is missing — apply the Group F migrations`)
        tableFailures += 1
      } else if (error?.code === '42501') {
        // Expected: the anon role has no table grants after policies are applied.
      } else if (error) {
        fail(`Table public.${table} probe failed: ${error.message} (${error.code ?? 'no code'})`)
        tableFailures += 1
      } else {
        fail(
          `anon can read public.${table} (${data?.length ?? 0} rows); grants or RLS are too broad`,
        )
        tableFailures += 1
      }
    }

    if (tableFailures === 0) {
      pass(`All ${REQUIRED_TABLES.length} Phase 1 tables exist and anon is denied`)
    }
  } catch (error) {
    fail(`Supabase client probe failed: ${error.message}`)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} Supabase check(s) failed.`)
  process.exitCode = 1
} else {
  console.log('\nSupabase configuration is usable.')
}
