import { Download, FileText, Loader2, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWhatsappMedia } from '../hooks/useWhatsappMedia'
import { WhatsappImageLightbox } from './WhatsappImageLightbox'
import {
  documentTypeLabel,
  isImageMimetype,
  resolveDocumentMeta,
} from '../utils/mediaHelpers'
import { WhatsappFormattedText } from './WhatsappFormattedText'
import type { WhatsappMensagemRow } from '@/lib/database.types'

interface Props {
  message: WhatsappMensagemRow
  remoteJid: string
  fromMe?: boolean
}

function MediaCaption({ text, fromMe }: { text: string; fromMe?: boolean }) {
  return (
    <p className="whitespace-pre-wrap text-sm">
      <WhatsappFormattedText text={text} fromMe={fromMe} />
    </p>
  )
}

function ImagePreview({
  src,
  loading,
  error,
  onRetry,
  caption,
  fromMe,
  downloadName,
}: {
  src: string | null
  loading: boolean
  error: boolean
  onRetry: () => void
  caption?: string
  fromMe?: boolean
  downloadName?: string
}) {
  if (loading && !src) {
    return (
      <div className="flex h-32 w-48 items-center justify-center rounded-lg bg-black/5">
        <Loader2 className="h-6 w-6 animate-spin opacity-60" />
      </div>
    )
  }
  if (error || !src) {
    return (
      <button type="button" onClick={onRetry} className="text-sm underline opacity-80">
        📷 Tentar carregar imagem
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <WhatsappImageLightbox
        src={src}
        caption={caption}
        fromMe={fromMe}
        downloadName={downloadName}
      >
        <button
          type="button"
          className="group relative block overflow-hidden rounded-lg ring-offset-2 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80"
        >
          <img
            src={src}
            alt=""
            className="max-h-64 max-w-full cursor-zoom-in object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15">
            <span className="rounded-full bg-black/55 p-2 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" aria-hidden />
            </span>
          </span>
        </button>
      </WhatsappImageLightbox>
      {caption && <MediaCaption text={caption} fromMe={fromMe} />}
    </div>
  )
}

export function WhatsappMessageMedia({ message, remoteJid, fromMe }: Props) {
  const tipo = message.tipo ?? ''
  const caption = message.media_meta?.caption
  const docMeta = tipo === 'documentMessage' ? resolveDocumentMeta(message) : null
  const autoLoad =
    tipo === 'imageMessage' ||
    tipo === 'stickerMessage' ||
    (tipo === 'documentMessage' && isImageMimetype(docMeta?.mimetype))

  const { containerRef, src, loading, error, load } = useWhatsappMedia(
    remoteJid,
    message.message_id,
    { autoLoad },
  )

  if (tipo === 'documentMessage' && docMeta) {
    const isImageDoc = isImageMimetype(docMeta.mimetype)
    const typeLabel = documentTypeLabel(docMeta.mimetype)

    return (
      <div ref={containerRef} className="flex flex-col gap-2">
        {isImageDoc ? (
          <ImagePreview
            src={src}
            loading={loading}
            error={error}
            onRetry={load}
            caption={docMeta.caption ?? caption}
            fromMe={fromMe}
            downloadName={docMeta.fileName}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-2 rounded-lg border border-slate-200/50 bg-black/5 px-3 py-2 text-left text-sm hover:bg-black/10"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileText className="h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block truncate font-medium">{docMeta.fileName}</span>
                <span className="text-[10px] opacity-70">{typeLabel}</span>
              </div>
            </button>
            {src && (
              <Button variant="outline" size="sm" className="w-fit gap-1" asChild>
                <a href={src} download={docMeta.fileName}>
                  <Download className="h-3 w-3" />
                  Baixar
                </a>
              </Button>
            )}
            {error && (
              <span className="text-xs opacity-70">Não foi possível carregar o documento.</span>
            )}
            {(docMeta.caption ?? caption) && (
              <MediaCaption text={docMeta.caption ?? caption!} fromMe={fromMe} />
            )}
          </>
        )}
      </div>
    )
  }

  if (tipo === 'videoMessage') {
    return (
      <div ref={containerRef} className="flex flex-col gap-2">
        {!src && !loading && (
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-black/10 px-4 py-3 text-sm hover:bg-black/20"
          >
            ▶ Reproduzir vídeo
          </button>
        )}
        {loading && <Loader2 className="h-6 w-6 animate-spin" />}
        {src && <video controls src={src} className="max-h-64 max-w-full rounded-lg" />}
        {error && <span className="text-xs opacity-70">Erro ao carregar vídeo.</span>}
        {caption && <MediaCaption text={caption} fromMe={fromMe} />}
      </div>
    )
  }

  if (tipo === 'stickerMessage') {
    return (
      <div ref={containerRef}>
        {loading && !src && <Loader2 className="h-8 w-8 animate-spin" />}
        {error || !src ? (
          !loading && (
            <button type="button" onClick={load} className="text-sm underline opacity-80">
              🎨 Carregar figurinha
            </button>
          )
        ) : (
          <img src={src} alt="Figurinha" className="max-h-32 max-w-[128px] object-contain" />
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <ImagePreview
        src={src}
        loading={loading}
        error={error}
        onRetry={load}
        caption={caption}
        fromMe={fromMe}
      />
    </div>
  )
}
