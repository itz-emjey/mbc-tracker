/**
 * Tournament poster rules.
 *
 * The bytes live in the public `tournament-posters` Storage bucket; tournament
 * staff upload with their own session and the storage policies allow only
 * tournament staff to write. The database keeps the object path and validates
 * its shape in `set_tournament_poster`. Everything here is pure, so the accepted
 * formats and the path layout are testable without a network.
 */

export const TOURNAMENT_POSTER_BUCKET = 'tournament-posters'
export const TOURNAMENT_POSTER_MAX_BYTES = 5 * 1024 * 1024
export const TOURNAMENT_POSTER_ACCEPT = 'image/png,image/jpeg,image/webp'

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** Only the fields the rules read, so a plain object can be tested. */
export interface TournamentPosterFile {
  name: string
  type: string
  size: number
}

/** `null` when the file is usable, otherwise a member-facing message. */
export function validateTournamentPoster(file: TournamentPosterFile): string | null {
  if (!(file.type in EXTENSIONS)) {
    return 'Choose a PNG, JPEG, or WebP image.'
  }

  if (file.size === 0) {
    return 'That image file is empty.'
  }

  if (file.size > TOURNAMENT_POSTER_MAX_BYTES) {
    return 'Posters must be 5 MB or smaller.'
  }

  return null
}

/** `posters/<tournament-id>/<image-id>.<ext>`, the only shape the RPC accepts. */
export function buildTournamentPosterPath(
  tournamentId: string,
  imageId: string,
  type: string,
): string {
  const extension = EXTENSIONS[type]

  if (!extension) {
    throw new Error('Unsupported image type.')
  }

  if (!/^[0-9a-f-]{36}$/i.test(tournamentId)) {
    throw new Error('Invalid tournament id.')
  }

  if (!/^[0-9a-f-]{36}$/i.test(imageId)) {
    throw new Error('Invalid image id.')
  }

  return `posters/${tournamentId}/${imageId}.${extension}`
}
