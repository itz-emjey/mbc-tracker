/**
 * Jersey design image rules.
 *
 * The bytes live in the public `jersey-designs` Storage bucket; staff upload
 * with their own session and the storage policies allow only trainers and
 * Super Admins to write. The database keeps the object path and validates its
 * shape in `set_jersey_design_image`. Everything here is pure, so the accepted
 * formats and the path layout are testable without a network.
 */

export const JERSEY_IMAGE_BUCKET = 'jersey-designs'
export const JERSEY_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const JERSEY_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** Only the fields the rules read, so a plain object can be tested. */
export interface JerseyImageFile {
  name: string
  type: string
  size: number
}

/** `null` when the file is usable, otherwise a member-facing message. */
export function validateJerseyImage(file: JerseyImageFile): string | null {
  if (!(file.type in EXTENSIONS)) {
    return 'Choose a PNG, JPEG, or WebP image.'
  }

  if (file.size === 0) {
    return 'That image file is empty.'
  }

  if (file.size > JERSEY_IMAGE_MAX_BYTES) {
    return 'Images must be 5 MB or smaller.'
  }

  return null
}

/** `designs/<project-id>/<image-id>.<ext>`, the only shape the RPC accepts. */
export function buildJerseyImagePath(projectId: string, imageId: string, type: string): string {
  const extension = EXTENSIONS[type]

  if (!extension) {
    throw new Error('Unsupported image type.')
  }

  if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
    throw new Error('Invalid project id.')
  }

  if (!/^[0-9a-f-]{36}$/i.test(imageId)) {
    throw new Error('Invalid image id.')
  }

  return `designs/${projectId}/${imageId}.${extension}`
}
