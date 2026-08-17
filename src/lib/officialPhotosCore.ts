export type OfficialPhoto = {
  externalUserId: string | null
  userId: string
  name: string
  email: string | null
  photoUrl: string | null
  source: 'selected' | 'legacy_avatar' | 'none'
  version: string
  updatedAt: string
}

export function normalizeOfficialEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function officialEmailLocalPart(email: string | null | undefined): string {
  const normalized = normalizeOfficialEmail(email)
  if (!normalized || !normalized.includes('@')) return ''
  return normalized.split('@')[0] || ''
}

export function officialPhotoDisplayUrl(photo: OfficialPhoto | null | undefined): string | null {
  if (!photo || photo.source === 'none') return null
  const url = photo.photoUrl?.trim()
  return url || null
}

type OfficialPhotoCache = {
  byEmail: Map<string, OfficialPhoto>
  byLocal: Map<string, OfficialPhoto>
  byId: Map<string, OfficialPhoto>
  version: number
}

const cache: OfficialPhotoCache = {
  byEmail: new Map(),
  byLocal: new Map(),
  byId: new Map(),
  version: 0,
}

function indexPhoto(photo: OfficialPhoto) {
  if (photo.externalUserId) cache.byId.set(photo.externalUserId, photo)
  const email = normalizeOfficialEmail(photo.email)
  if (email) cache.byEmail.set(email, photo)
  const local = officialEmailLocalPart(photo.email)
  if (local && !cache.byLocal.has(local)) cache.byLocal.set(local, photo)
}

export function replaceOfficialPhotoCache(photos: OfficialPhoto[]) {
  cache.byEmail.clear()
  cache.byLocal.clear()
  cache.byId.clear()
  for (const photo of photos) indexPhoto(photo)
  cache.version += 1
  return cache.version
}

export function getOfficialPhotoCacheVersion() {
  return cache.version
}

export function getOfficialPhotoByEmail(email: string | null | undefined): OfficialPhoto | null {
  const normalized = normalizeOfficialEmail(email)
  if (!normalized) return null
  return cache.byEmail.get(normalized) ?? cache.byLocal.get(officialEmailLocalPart(normalized)) ?? null
}

export function getOfficialPhotoUrlByEmail(email: string | null | undefined): string | null {
  return officialPhotoDisplayUrl(getOfficialPhotoByEmail(email))
}

export function getOfficialPhotoById(externalUserId: string | null | undefined): OfficialPhoto | null {
  const id = (externalUserId ?? '').trim()
  if (!id) return null
  return cache.byId.get(id) ?? null
}

export function resolveOfficialAvatarUrl(
  email: string | null | undefined,
  fallback?: string | null,
): string | null {
  return getOfficialPhotoUrlByEmail(email) ?? (fallback?.trim() || null)
}
