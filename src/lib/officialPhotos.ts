import { supabase } from '@/lib/supabaseClient'
import type { OfficialPhoto } from '@/lib/officialPhotosCore'

export type { OfficialPhoto } from '@/lib/officialPhotosCore'
export {
  normalizeOfficialEmail,
  officialEmailLocalPart,
  officialPhotoDisplayUrl,
  replaceOfficialPhotoCache,
  getOfficialPhotoCacheVersion,
  getOfficialPhotoByEmail,
  getOfficialPhotoUrlByEmail,
  getOfficialPhotoById,
  resolveOfficialAvatarUrl,
} from '@/lib/officialPhotosCore'

export type OfficialPhotosLookup = {
  data: OfficialPhoto[]
  notFound: string[]
  unavailable?: boolean
}

export const officialPhotosService = {
  async lookup(input: {
    externalUserIds?: string[]
    emails?: string[]
  }): Promise<OfficialPhotosLookup> {
    const { data, error } = await supabase.functions.invoke('official-photos', {
      body: {
        externalUserIds: input.externalUserIds ?? [],
        emails: input.emails ?? [],
      },
    })
    const payload = (data ?? {}) as OfficialPhotosLookup
    if (payload.unavailable) {
      return { data: [], notFound: [], unavailable: true }
    }
    const status = (error as { context?: Response } | null)?.context?.status
    if (status === 503) {
      return { data: [], notFound: [], unavailable: true }
    }
    if (error) throw error
    return {
      data: payload.data ?? [],
      notFound: payload.notFound ?? [],
      unavailable: payload.unavailable,
    }
  },
}
