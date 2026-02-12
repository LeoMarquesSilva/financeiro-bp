import { useState, useEffect } from 'react'
import { cn } from '@/shared/utils/cn'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AvatarProps {
  /** URL da imagem (recomendado: caminho local /team/xxx.jpg) */
  src: string | null | undefined
  /** Fallback ao falhar (ex.: mesmo path com .png) */
  fallbackSrc?: string | null
  alt?: string
  fullName: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-7 w-7 text-xs',
  lg: 'h-9 w-9 text-sm',
}

export function Avatar({
  src,
  fallbackSrc,
  alt = '',
  fullName,
  className,
  size = 'sm',
}: AvatarProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src ?? null)
  const [errored, setErrored] = useState(false)
  const initials = getInitials(fullName)

  useEffect(() => {
    setCurrentSrc(src ?? null)
    setErrored(false)
  }, [src])

  const showImg = currentSrc && !errored

  const handleError = () => {
    if (fallbackSrc && currentSrc === src) {
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
