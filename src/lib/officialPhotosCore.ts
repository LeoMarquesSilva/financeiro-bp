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

export type OfficialPhotoEmailAlias = {
  externalUserId: string
  email: string
}

export type OfficialPhotoPersistedCatalog = {
  savedAt: number
  photos: OfficialPhoto[]
  aliases: OfficialPhotoEmailAlias[]
}

export const OFFICIAL_PHOTOS_STORAGE_KEY = 'sioe.official-photos.v1'

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

export function officialPhotoCatalogFingerprint(
  photos: OfficialPhoto[],
  aliases: OfficialPhotoEmailAlias[] = [],
): string {
  const photoPart = photos
    .map(
      (photo) =>
        [
          photo.externalUserId ?? '',
          photo.userId,
          photo.version,
          photo.updatedAt,
          photo.photoUrl ?? '',
          photo.source,
        ].join('|'),
    )
    .sort()
    .join('\n')
  const aliasPart = aliases
    .map((alias) => `${alias.externalUserId.trim()}|${normalizeOfficialEmail(alias.email)}`)
    .filter((row) => !row.startsWith('|') && !row.endsWith('|'))
    .sort()
    .join('\n')
  return `${photoPart}#${aliasPart}`
}

type OfficialPhotoCache = {
  byEmail: Map<string, OfficialPhoto>
  byLocal: Map<string, OfficialPhoto>
  byId: Map<string, OfficialPhoto>
  version: number
  fingerprint: string
  aliases: OfficialPhotoEmailAlias[]
}

const cache: OfficialPhotoCache = {
  byEmail: new Map(),
  byLocal: new Map(),
  byId: new Map(),
  version: 0,
  fingerprint: '',
  aliases: [],
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function indexPhoto(photo: OfficialPhoto) {
  if (photo.externalUserId) cache.byId.set(photo.externalUserId, photo)
  const email = normalizeOfficialEmail(photo.email)
  if (email) cache.byEmail.set(email, photo)
  const local = officialEmailLocalPart(photo.email)
  if (local && !cache.byLocal.has(local)) cache.byLocal.set(local, photo)
}

export function applyOfficialPhotoEmailAliases(aliases: OfficialPhotoEmailAlias[]) {
  const next: OfficialPhotoEmailAlias[] = []
  for (const alias of aliases) {
    const externalUserId = alias.externalUserId.trim()
    const email = normalizeOfficialEmail(alias.email)
    if (!externalUserId || !email) continue
    const photo = cache.byId.get(externalUserId)
    if (!photo) continue
    cache.byEmail.set(email, photo)
    const local = officialEmailLocalPart(email)
    if (local) cache.byLocal.set(local, photo)
    next.push({ externalUserId, email })
  }
  cache.aliases = next
}

function persistOfficialPhotoCache(photos: OfficialPhoto[], aliases: OfficialPhotoEmailAlias[]) {
  const storage = getLocalStorage()
  if (!storage) return
  const payload: OfficialPhotoPersistedCatalog = {
    savedAt: Date.now(),
    photos,
    aliases,
  }
  try {
    storage.setItem(OFFICIAL_PHOTOS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // quota / modo privado — o cache em memória continua válido
  }
}

function parsePersistedCatalog(raw: string | null): OfficialPhotoPersistedCatalog | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as OfficialPhotoPersistedCatalog
    if (!parsed || !Array.isArray(parsed.photos)) return null
    return {
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
      photos: parsed.photos,
      aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
    }
  } catch {
    return null
  }
}

export function peekPersistedOfficialPhotoCatalog(): OfficialPhotoPersistedCatalog | null {
  return parsePersistedCatalog(getLocalStorage()?.getItem(OFFICIAL_PHOTOS_STORAGE_KEY) ?? null)
}

export function replaceOfficialPhotoCache(
  photos: OfficialPhoto[],
  options?: { persist?: boolean; aliases?: OfficialPhotoEmailAlias[] },
) {
  cache.byEmail.clear()
  cache.byLocal.clear()
  cache.byId.clear()
  for (const photo of photos) indexPhoto(photo)
  applyOfficialPhotoEmailAliases(options?.aliases ?? [])
  cache.fingerprint = officialPhotoCatalogFingerprint(photos, cache.aliases)
  cache.version += 1
  if (options?.persist !== false) persistOfficialPhotoCache(photos, cache.aliases)
  return cache.version
}

/** Atualiza memória + localStorage só quando version/updatedAt/URL mudou. */
export function applyOfficialPhotoCatalog(
  photos: OfficialPhoto[],
  aliases: OfficialPhotoEmailAlias[] = [],
): boolean {
  const fingerprint = officialPhotoCatalogFingerprint(photos, aliases)
  if (cache.version > 0 && fingerprint === cache.fingerprint) return false
  replaceOfficialPhotoCache(photos, { aliases })
  return true
}

export function hydrateOfficialPhotoCacheFromStorage(): OfficialPhotoPersistedCatalog | null {
  const persisted = peekPersistedOfficialPhotoCatalog()
  if (!persisted || persisted.photos.length === 0) return null
  if (cache.version === 0) {
    replaceOfficialPhotoCache(persisted.photos, {
      persist: false,
      aliases: persisted.aliases,
    })
  }
  return persisted
}

export function prefetchOfficialPhotoImages(photos: OfficialPhoto[]) {
  if (typeof Image === 'undefined') return
  for (const photo of photos) {
    const url = officialPhotoDisplayUrl(photo)
    if (!url) continue
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.src = url
  }
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

export function resolveOfficialAvatarForIdentity(input: {
  email?: string | null
  colaboradorId?: string | null
  fallback?: string | null
}): string | null {
  const byId = officialPhotoDisplayUrl(getOfficialPhotoById(input.colaboradorId))
  if (byId) return byId
  return resolveOfficialAvatarUrl(input.email, input.fallback)
}

hydrateOfficialPhotoCacheFromStorage()
