import type { ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Download, X, ZoomIn } from 'lucide-react'
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { WhatsappFormattedText } from './WhatsappFormattedText'

interface Props {
  src: string
  alt?: string
  caption?: string
  fromMe?: boolean
  downloadName?: string
  children: ReactNode
}

export function WhatsappImageLightbox({
  src,
  alt = 'Imagem',
  caption,
  fromMe,
  downloadName = 'imagem-whatsapp.jpg',
  children,
}: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/92 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200',
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Barra superior — fundo sólido para contraste em qualquer imagem */}
          <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/90 px-4 py-3 shadow-lg backdrop-blur-md sm:px-6">
            <DialogPrimitive.Close
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                'bg-white text-slate-900 shadow-md',
                'transition-colors hover:bg-slate-100',
                'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950',
              )}
              aria-label="Fechar"
            >
              <X className="h-5 w-5 stroke-[2.5]" />
            </DialogPrimitive.Close>

            <span className="hidden items-center gap-1.5 text-sm font-medium text-slate-300 sm:flex">
              <ZoomIn className="h-4 w-4" />
              Visualização ampliada
            </span>

            <a
              href={src}
              download={downloadName}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full px-4 shadow-md',
                'bg-emerald-500 text-sm font-semibold text-white',
                'transition-colors hover:bg-emerald-400',
                'focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Baixar</span>
            </a>
          </div>

          {/* Clique no fundo fecha */}
          <DialogPrimitive.Close
            className="absolute inset-0 z-0 cursor-zoom-out bg-transparent"
            aria-label="Fechar visualização"
          />

          {/* Imagem */}
          <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-8">
            <img
              src={src}
              alt={alt}
              className={cn(
                'pointer-events-none max-h-full max-w-full object-contain',
                'rounded-lg shadow-2xl shadow-black/50',
                'select-none',
              )}
              style={{ maxHeight: caption ? 'calc(100vh - 10rem)' : 'calc(100vh - 5.5rem)' }}
              draggable={false}
            />
          </div>

          {/* Legenda */}
          {caption?.trim() && (
            <div className="relative z-10 shrink-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-5 pt-8 sm:px-8">
              <p className="mx-auto max-w-3xl whitespace-pre-wrap text-center text-sm leading-relaxed text-white/95">
                <WhatsappFormattedText text={caption} fromMe={fromMe} />
              </p>
            </div>
          )}

        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
