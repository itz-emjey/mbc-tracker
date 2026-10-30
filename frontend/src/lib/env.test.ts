import { describe, expect, it } from 'vitest'

import {
  SUPABASE_ANON_KEY_VAR,
  SUPABASE_URL_VAR,
  SupabaseConfigError,
  getSupabaseConfig,
  isServiceRoleKey,
  parseSupabaseConfig,
} from './env'

function base64Url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function jwt(payload: Record<string, unknown>): string {
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.test-signature`
}

const ANON_KEY = jwt({ role: 'anon', iss: 'supabase' })
const SERVICE_KEY = jwt({ role: 'service_role', iss: 'supabase' })

describe('parseSupabaseConfig', () => {
  it('accepts a valid URL and a legacy anon JWT', () => {
    const result = parseSupabaseConfig({
      [SUPABASE_URL_VAR]: 'https://example.supabase.co',
      [SUPABASE_ANON_KEY_VAR]: ANON_KEY,
    })

    expect(result).toEqual({
      ok: true,
      config: { url: 'https://example.supabase.co', anonKey: ANON_KEY },
    })
  })

  it('accepts a modern publishable key', () => {
    const result = parseSupabaseConfig({
      [SUPABASE_URL_VAR]: 'https://example.supabase.co',
      [SUPABASE_ANON_KEY_VAR]: 'sb_publishable_public-value',
    })

    expect(result.ok).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    const result = parseSupabaseConfig({
      [SUPABASE_URL_VAR]: '  https://example.supabase.co  ',
      [SUPABASE_ANON_KEY_VAR]: `  ${ANON_KEY}  `,
    })

    expect(result.ok && result.config.url).toBe('https://example.supabase.co')
    expect(result.ok && result.config.anonKey).toBe(ANON_KEY)
  })

  it('reports both missing variables at once', () => {
    const result = parseSupabaseConfig({})

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.problems).toEqual([
      `${SUPABASE_URL_VAR} is missing`,
      `${SUPABASE_ANON_KEY_VAR} is missing`,
    ])
  })

  it('rejects a malformed URL', () => {
    const result = parseSupabaseConfig({
      [SUPABASE_URL_VAR]: 'not-a-url',
      [SUPABASE_ANON_KEY_VAR]: ANON_KEY,
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.problems).toContain(`${SUPABASE_URL_VAR} is not a valid URL`)
  })

  it('rejects non-http protocols', () => {
    const result = parseSupabaseConfig({
      [SUPABASE_URL_VAR]: 'ftp://example.supabase.co',
      [SUPABASE_ANON_KEY_VAR]: ANON_KEY,
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.problems).toContain(`${SUPABASE_URL_VAR} must be an http(s) URL`)
  })

  it('refuses a service-role JWT', () => {
    const result = parseSupabaseConfig({
      [SUPABASE_URL_VAR]: 'https://example.supabase.co',
      [SUPABASE_ANON_KEY_VAR]: SERVICE_KEY,
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.problems.join(' ')).toContain('service-role/secret key')
  })

  it('refuses a modern secret key', () => {
    const result = parseSupabaseConfig({
      [SUPABASE_URL_VAR]: 'https://example.supabase.co',
      [SUPABASE_ANON_KEY_VAR]: 'sb_secret_private-value',
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.problems.join(' ')).toContain('service-role/secret key')
  })

  it('rejects a value that is not a Supabase key at all', () => {
    const result = parseSupabaseConfig({
      [SUPABASE_URL_VAR]: 'https://example.supabase.co',
      [SUPABASE_ANON_KEY_VAR]: 'https://example.supabase.co',
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.problems.join(' ')).toContain('does not look like')
  })
})

describe('isServiceRoleKey', () => {
  it('detects both service-key formats', () => {
    expect(isServiceRoleKey(SERVICE_KEY)).toBe(true)
    expect(isServiceRoleKey('sb_secret_private-value')).toBe(true)
  })

  it('does not flag public keys', () => {
    expect(isServiceRoleKey(ANON_KEY)).toBe(false)
    expect(isServiceRoleKey('sb_publishable_public-value')).toBe(false)
  })
})

describe('getSupabaseConfig', () => {
  it('returns the configuration when valid', () => {
    const config = getSupabaseConfig({
      [SUPABASE_URL_VAR]: 'https://example.supabase.co',
      [SUPABASE_ANON_KEY_VAR]: ANON_KEY,
    })

    expect(config.url).toBe('https://example.supabase.co')
  })

  it('throws a readable SupabaseConfigError when values are missing', () => {
    expect(() => getSupabaseConfig({})).toThrow(SupabaseConfigError)

    try {
      getSupabaseConfig({})
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseConfigError)
      expect((error as SupabaseConfigError).message).toContain(SUPABASE_URL_VAR)
      expect((error as SupabaseConfigError).message).toContain('.env.example')
      expect((error as SupabaseConfigError).problems).toHaveLength(2)
    }
  })
})
