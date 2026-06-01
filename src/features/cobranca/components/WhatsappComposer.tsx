import { useRef, useState } from 'react'
import { Mic, Paperclip, Send, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { blobToBase64, fileToBase64, mediatypeFromFile } from '../utils/mediaHelpers'

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
      <div className="flex items-center gap-2 border-t border-slate-200 bg-red-50 p-3">
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
    <div className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFile}
      />
      {!modoCobranca && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-500"
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
            className={cn('shrink-0 text-slate-500')}
            disabled={disabled || enviando}
            onClick={iniciarGravacao}
            title="Gravar áudio"
          >
            <Mic className="h-4 w-4" />
          </Button>
        </>
      )}
      <Textarea
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
        className="min-h-[40px] max-h-32 flex-1 resize-none"
      />
      <Button
        onClick={onSendText}
        disabled={enviando || !texto.trim() || disabled}
        className="h-10 bg-emerald-600 hover:bg-emerald-700"
        title={modoCobranca ? 'Enviar cobrança' : 'Enviar mensagem'}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
