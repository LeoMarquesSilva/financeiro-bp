import { useState, useEffect } from 'react'
import { cn } from '@/shared/utils/cn'
import { getOfficialPhotoUrlByEmail } from '@/lib/officialPhotos'
import { useOfficialPhotos } from '@/lib/OfficialPhotosProvider'

export function getInitials(name: string | null | undefined): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AvatarProps {
  /** URL da imagem (recomendado: caminho local /team/xxx.jpg) */
  src: string | null | undefined
  /** E-mail para preferir a foto oficial do ORQESTRAI quando o cache estiver hidratado. */
  email?: string | null
  /** Fallback ao falhar (ex.: mesmo path com .png) */
  fallbackSrc?: string | null
  alt?: string
  fullName: string
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-xs',
  md: 'h-7 w-7 text-xs',
  lg: 'h-9 w-9 text-sm',
}

export function Avatar({
  src,
  email,
  fallbackSrc,
  alt = '',
  fullName,
  className,
  size = 'sm',
}: AvatarProps) {
  useOfficialPhotos()
  const officialSrc = getOfficialPhotoUrlByEmail(email)
  const resolvedSrc = officialSrc ?? src ?? null
  const [currentSrc, setCurrentSrc] = useState<string | null>(resolvedSrc)
  const [errored, setErrored] = useState(false)
  const initials = getInitials(fullName)

  useEffect(() => {
    setCurrentSrc(resolvedSrc)
    setErrored(false)
  }, [resolvedSrc])

  const showImg = currentSrc && !errored

  const handleError = () => {
    if (fallbackSrc && currentSrc === resolvedSrc) {
      setCurrentSrc(fallbackSrc)
    } else {
      setErrored(true)
    }
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-300 font-medium text-slate-600',
        sizeClasses[size],
        className
      )}
      title={alt || fullName}
    >
      {showImg ? (
        <img
          src={currentSrc}
          alt=""
          className="h-full w-full rounded-full object-cover"
          referrerPolicy="no-referrer"
          onError={handleError}
        />
      ) : (
        initials
      )}
    </span>
  )
}
