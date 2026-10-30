#!/usr/bin/env node
/**
 * Verifies that the local Supabase configuration reaches the project.
 *
 * Run from `frontend/` after creating `.env.local`:
 *   npm run check:supabase
 *
 * It prints no secrets — only the project host and the result of each probe.
 * This checks connectivity and key validity, not authorization: Row Level
 * Security is verified separately in Group H.
 */
import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'

const URL_VAR = 'VITE_SUPABASE_URL'
const KEY_VAR = 'VITE_SUPABASE_ANON_KEY'

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
      pass('Database API reachable and the key is accepted (public schema is empty)')
    } else if (restError) {
      fail(`Database API probe failed: ${restError.message} (${restError.code ?? 'no code'})`)
    } else {
      pass('Database API reachable')
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
