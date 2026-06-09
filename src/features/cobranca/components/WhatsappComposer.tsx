import { useRef, useState } from 'react'
import { Mic, Paperclip, Send, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  blobToBase64,
  COMPOSER_FILE_ACCEPT,
  fileToBase64,
  mediatypeFromFile,
} from '../utils/mediaHelpers'

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
  }) => Promise<void>
  enviando: boolean
  disabled?: boolean
  placeholder?: string
  modoCobranca?: boolean
  /** Altura total do painel (px) — o textarea preenche o espaço disponível. */
  panelHeight: number
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
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    const base64 = await fileToBase64(file)
    await onSendFile({
      mediatype: mediatypeFromFile(file),
      media: base64,
      mimetype: file.type || 'application/octet-stream',
      fileName: file.name,
    })
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

  return (
    <div
      className="box-border flex h-full min-h-0 items-stretch gap-2 bg-white px-3 py-2"
      style={{ height: panelHeight }}
    >
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
        value={texto}
        onChange={(e) => onTextoChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSendText()
          }
        }}
        placeholder={placeholder ?? 'Digite uma mensagem…'}
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
        onClick={onSendText}
        disabled={enviando || !texto.trim() || disabled}
        className="h-10 shrink-0 self-end bg-emerald-600 hover:bg-emerald-700"
        title={modoCobranca ? 'Enviar cobrança' : 'Enviar mensagem'}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}

