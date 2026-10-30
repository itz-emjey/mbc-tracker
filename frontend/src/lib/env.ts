/**
 * Supabase environment validation.
 *
 * Kept separate from the client so the rules can be unit tested and reused by
 * a "configuration missing" screen without constructing a network client.
 *
 * Only public values belong here. The anon/publishable key is safe in a
 * browser bundle because Row Level Security decides what it can read; the
 * service-role key must never reach the client.
 */

export const SUPABASE_URL_VAR = 'VITE_SUPABASE_URL'
export const SUPABASE_ANON_KEY_VAR = 'VITE_SUPABASE_ANON_KEY'

export type EnvSource = Readonly<Record<string, string | undefined>>

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export type SupabaseConfigResult =
  { ok: true; config: SupabaseConfig } | { ok: false; problems: string[] }

/** Thrown when the app is used before Supabase is configured. */
export class SupabaseConfigError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(
      [
        'Supabase is not configured correctly.',
        ...problems.map((problem) => `- ${problem}`),
        `Copy frontend/.env.example to frontend/.env.local and set the values from your project's API settings.`,
      ].join('\n'),
    )

    this.name = 'SupabaseConfigError'
    this.problems = problems
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')

  if (parts.length !== 3) {
    return null
  }

  try {
    const normalized = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const parsed: unknown = JSON.parse(atob(padded))

    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/**
 * True for keys that must never be used in the browser: legacy service-role
 * JWTs and new `sb_secret_...` secret keys.
 */
export function isServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) {
    return true
  }

  return decodeJwtPayload(key)?.role === 'service_role'
}

/** Accepts the modern publishable key or a legacy `anon` JWT. */
function isAnonKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) {
    return true
  }

  return decodeJwtPayload(key)?.role === 'anon'
}

/**
 * Validates the public Supabase configuration without throwing.
 * Returns every problem at once so the operator can fix them in one pass.
 */
export function parseSupabaseConfig(env: EnvSource): SupabaseConfigResult {
  const problems: string[] = []
  const rawUrl = env[SUPABASE_URL_VAR]?.trim()
  const rawKey = env[SUPABASE_ANON_KEY_VAR]?.trim()

  if (!rawUrl) {
    problems.push(`${SUPABASE_URL_VAR} is missing`)
  } else {
    try {
      const parsed = new URL(rawUrl)

      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        problems.push(`${SUPABASE_URL_VAR} must be an http(s) URL`)
      }
    } catch {
      problems.push(`${SUPABASE_URL_VAR} is not a valid URL`)
    }
  }

  if (!rawKey) {
    problems.push(`${SUPABASE_ANON_KEY_VAR} is missing`)
  } else if (isServiceRoleKey(rawKey)) {
    problems.push(
      `${SUPABASE_ANON_KEY_VAR} contains a service-role/secret key. Only the anon or publishable key may be used in the browser.`,
    )
  } else if (!isAnonKey(rawKey)) {
    problems.push(`${SUPABASE_ANON_KEY_VAR} does not look like a Supabase anon or publishable key`)
  }

  if (problems.length > 0) {
    return { ok: false, problems }
  }

  return { ok: true, config: { url: rawUrl!, anonKey: rawKey! } }
}

/** Returns the validated configuration or throws a readable configuration error. */
export function getSupabaseConfig(env: EnvSource = import.meta.env): SupabaseConfig {
  const result = parseSupabaseConfig(env)

  if (!result.ok) {
    throw new SupabaseConfigError(result.problems)
  }

  return result.config
}
