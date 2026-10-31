import { describe, expect, it } from 'vitest'

import { JERSEY_IMAGE_MAX_BYTES, buildJerseyImagePath, validateJerseyImage } from './images'

const file = (overrides: Partial<{ type: string; size: number }> = {}) => ({
  name: 'kit.png',
  type: 'image/png',
  size: 1024,
  ...overrides,
})

describe('validateJerseyImage', () => {
  it('accepts PNG, JPEG, and WebP images', () => {
    expect(validateJerseyImage(file())).toBeNull()
    expect(validateJerseyImage(file({ type: 'image/jpeg' }))).toBeNull()
    expect(validateJerseyImage(file({ type: 'image/webp' }))).toBeNull()
  })

  it('refuses other file types by MIME rather than by name', () => {
    expect(validateJerseyImage({ name: 'kit.png', type: 'application/pdf', size: 1024 })).toMatch(
      /PNG, JPEG, or WebP/,
    )
    expect(validateJerseyImage({ name: 'kit.exe', type: 'image/svg+xml', size: 1024 })).toMatch(
      /PNG, JPEG, or WebP/,
    )
  })

  it('refuses empty and oversized files', () => {
    expect(validateJerseyImage(file({ size: 0 }))).toMatch(/empty/i)
    expect(validateJerseyImage(file({ size: JERSEY_IMAGE_MAX_BYTES + 1 }))).toMatch(/5 MB/)
    expect(validateJerseyImage(file({ size: JERSEY_IMAGE_MAX_BYTES }))).toBeNull()
  })
})

describe('buildJerseyImagePath', () => {
  const projectId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  const imageId = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

  it('lays the object out as designs/project/image', () => {
    expect(buildJerseyImagePath(projectId, imageId, 'image/png')).toBe(
      `designs/${projectId}/${imageId}.png`,
    )
    expect(buildJerseyImagePath(projectId, imageId, 'image/jpeg')).toBe(
      `designs/${projectId}/${imageId}.jpg`,
    )
    expect(buildJerseyImagePath(projectId, imageId, 'image/webp')).toBe(
      `designs/${projectId}/${imageId}.webp`,
    )
  })

  it('refuses unsupported types instead of guessing an extension', () => {
    expect(() => buildJerseyImagePath(projectId, imageId, 'image/gif')).toThrow(/Unsupported/)
  })

  it('refuses ids that are not uuids so a path cannot escape the project folder', () => {
    expect(() => buildJerseyImagePath('../secret', imageId, 'image/png')).toThrow(/project id/)
    expect(() => buildJerseyImagePath(projectId, '../../x', 'image/png')).toThrow(/image id/)
  })
})
