import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Mic, Paperclip, Send, Square, X, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WhatsappImageLightbox } from './WhatsappImageLightbox'
import { WhatsappQuotedBlock } from './WhatsappQuotedBlock'
import type { ReplyTarget } from '../utils/quotedMessage'
import {
  blobToBase64,
  COMPOSER_FILE_ACCEPT,
  fileToBase64,
  mediatypeFromFile,
} from '../utils/mediaHelpers'

interface PendingAttachment {
  previewUrl: string
  base64: string
  mimetype: string
  fileName: string
  mediatype: 'image' | 'video' | 'document'
}

/** Faixa extra acima do campo — não reduz a área de digitação nem o histórico de mensagens. */
const PENDING_PREVIEW_HEIGHT = 80
const REPLY_PREVIEW_HEIGHT = 64

interface Props {
  texto: string
  onTextoChange: (v: string) => void
  onSendText: () => void
  onSendAudio: (base64: string) => Promise<void>
  onSendFile: (params: {
    mediatype: 'image' | 'video' | 'document'
    media: string
    mimetype: string
    fileName: string
    caption?: string
  }) => Promise<void>
  enviando: boolean
  disabled?: boolean
  placeholder?: string
  modoCobranca?: boolean
  /** Altura total do painel (px) — o textarea preenche o espaço disponível. */
  panelHeight: number
  replyTo?: ReplyTarget | null
  onClearReply?: () => void
}

export function WhatsappComposer({
  texto,
  onTextoChange,
  onSendText,
  onSendAudio,
  onSendFile,
  enviando,
  disabled,
  placeholder,
  modoCobranca,
  panelHeight,
  replyTo,
  onClearReply,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [pending, setPending] = useState<PendingAttachment | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return () => {
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    }
  }, [pending?.previewUrl])

  const clearPending = () => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    setPending(null)
  }

  const setPendingFromFile = async (file: File) => {
    clearPending()
    const base64 = await fileToBase64(file)
    setPending({
      previewUrl: URL.createObjectURL(file),
      base64,
      mimetype: file.type || 'application/octet-stream',
      fileName: file.name,
      mediatype: mediatypeFromFile(file),
    })
    textareaRef.current?.focus()
  }

  const pararTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        pararTimer()
        setGravando(false)
        setSegundos(0)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        const base64 = await blobToBase64(blob)
        await onSendAudio(base64)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setGravando(true)
      setSegundos(0)
      timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    } catch {
      /* permissão negada */
    }
  }

  const pararGravacao = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }

  const cancelarGravacao = () => {
    pararTimer()
    setGravando(false)
    setSegundos(0)
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
      mediaRecorderRef.current = null
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await setPendingFromFile(file)
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled || enviando || modoCobranca) return
    const items = e.clipboardData?.items
    if (!items?.length) return

    for (const item of items) {
      if (!item.type.startsWith('image/')) continue
      const file = item.getAsFile()
      if (!file) continue
      e.preventDefault()
      const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
      const named = new File([file], `print-${Date.now()}.${ext}`, { type: file.type })
      await setPendingFromFile(named)
      return
    }
  }

  const handleSend = async () => {
    if (pending) {
      const caption = texto.trim() || undefined
      await onSendFile({
        mediatype: pending.mediatype,
        media: pending.base64,
        mimetype: pending.mimetype,
        fileName: pending.fileName,
        caption,
      })
      clearPending()
      onTextoChange('')
      return
    }
    onSendText()
  }

  if (gravando) {
    return (
      <div
        className="flex items-center gap-2 bg-red-50 px-3"
        style={{ height: panelHeight }}
      >
        <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="flex-1 text-sm text-red-800">Gravando… {segundos}s</span>
        <Button type="button" variant="ghost" size="icon" onClick={cancelarGravacao} title="Cancelar">
          <X className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={pararGravacao}
          title="Enviar áudio"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    )
  }

  const canSend = !!pending || !!texto.trim()
  const inputRowHeight = Math.max(72, panelHeight - 16)
  const extraHeight =
    (pending ? PENDING_PREVIEW_HEIGHT : 0) + (replyTo ? REPLY_PREVIEW_HEIGHT : 0)
  const totalHeight = inputRowHeight + 16 + extraHeight

  return (
    <div
      className="box-border flex shrink-0 flex-col overflow-hidden bg-white px-3 py-2"
      style={{ height: totalHeight }}
    >
      {replyTo && (
        <div
          className="mb-2 flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-2.5 py-2"
          style={{ height: REPLY_PREVIEW_HEIGHT - 8 }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              Respondendo
              {replyTo.authorLabel ? ` · ${replyTo.authorLabel}` : ''}
            </p>
            <WhatsappQuotedBlock preview={replyTo.preview} compact />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-slate-500 hover:bg-slate-200"
            onClick={onClearReply}
            title="Cancelar resposta"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {pending && (
        <div
          className="mb-2 flex shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 shadow-sm"
          style={{ height: PENDING_PREVIEW_HEIGHT - 8 }}
        >
          {pending.mediatype === 'image' ? (
            <WhatsappImageLightbox
              src={pending.previewUrl}
              alt="Imagem para enviar"
              caption={texto.trim() || undefined}
              fromMe
              downloadName={pending.fileName}
            >
              <button
                type="button"
                className={cn(
                  'group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg',
                  'border border-white bg-white shadow-sm',
                  'cursor-zoom-in transition-shadow hover:shadow-md',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
                )}
                title="Clique para ampliar"
              >
                <img
                  src={pending.previewUrl}
                  alt="Imagem para enviar"
                  className="h-full w-full object-cover"
                />
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center',
                    'bg-black/0 transition-colors group-hover:bg-black/25',
                  )}
                >
                  <ZoomIn className="h-4 w-4 text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100" />
                </span>
              </button>
            </WhatsappImageLightbox>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white bg-white text-slate-500 shadow-sm">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-800">
              {pending.mediatype === 'image' ? 'Imagem anexada' : 'Arquivo anexado'}
            </p>
            <p className="truncate text-[11px] text-slate-500">{pending.fileName}</p>
            <p className="text-[10px] text-emerald-700">
              {pending.mediatype === 'image'
                ? 'Clique na miniatura para ampliar · legenda opcional abaixo'
                : 'Legenda opcional no campo abaixo'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            onClick={clearPending}
            title="Remover anexo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex shrink-0 items-stretch gap-2" style={{ height: inputRowHeight }}>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={COMPOSER_FILE_ACCEPT}
          onChange={handleFile}
        />
        {!modoCobranca && (
          <div className="flex shrink-0 flex-col justify-end gap-1 pb-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-slate-500"
              disabled={disabled || enviando}
              onClick={() => fileRef.current?.click()}
              title="Anexar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-slate-500"
              disabled={disabled || enviando}
              onClick={iniciarGravacao}
              title="Gravar áudio"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => onTextoChange(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && replyTo) {
              e.preventDefault()
              onClearReply?.()
              return
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend && !enviando && !disabled) void handleSend()
            }
          }}
          placeholder={
            pending
              ? 'Legenda opcional…'
              : (placeholder ??
                (modoCobranca ? 'Digite uma mensagem…' : 'Digite uma mensagem… (Ctrl+V para colar print)'))
          }
          disabled={disabled || enviando}
          rows={3}
          className={cn(
            'min-h-0 w-full flex-1 resize-none rounded-lg border border-slate-200 bg-white',
            'px-3 py-2 text-sm leading-snug shadow-sm transition-colors',
            'placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'overflow-y-auto',
          )}
          style={{ height: '100%' }}
        />
        <Button
          onClick={() => void handleSend()}
          disabled={enviando || !canSend || disabled}
          className="h-10 shrink-0 self-end bg-emerald-600 hover:bg-emerald-700"
          title={pending ? 'Enviar imagem' : modoCobranca ? 'Enviar cobrança' : 'Enviar mensagem'}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

