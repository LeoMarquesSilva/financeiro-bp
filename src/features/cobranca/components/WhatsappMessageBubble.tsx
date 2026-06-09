import { cn } from '@/lib/utils'
import { displayMessageContent } from '../utils/messageContent'
import { isMediaTipo } from '../utils/mediaHelpers'
import { WhatsappMessageText } from './WhatsappMessageText'
import { WhatsappMessageMedia } from './WhatsappMessageMedia'
import { WhatsappMessageAudio } from './WhatsappMessageAudio'
import { WhatsappMessageActions } from './WhatsappMessageActions'
import { WhatsappQuotedBlock } from './WhatsappQuotedBlock'
import { WhatsappMessageStatus } from './WhatsappMessageStatus'
import { extractQuotedPreview, resolveQuotedAuthorLabel } from '../utils/quotedMessage'
import type { WhatsappMensagemRow } from '@/lib/database.types'

interface Props {
  message: WhatsappMensagemRow
  remoteJid: string
  mentionMap: Map<string, string>
  contactLabel?: string
  messagesById?: Map<string, { from_me: boolean }>
  onGoToMessage?: (messageId: string) => void
  onReact?: (messageId: string, fromMe: boolean, emoji: string) => void
  onReply?: (message: WhatsappMensagemRow) => void
}

function LocationBlock({ message }: { message: WhatsappMensagemRow }) {
  const raw = message.raw as Record<string, any> | null
  const loc = raw?.message?.locationMessage
  if (!loc) return <span className="text-sm">📍 Localização</span>
  const lat = loc.degreesLatitude ?? loc.latitude
  const lng = loc.degreesLongitude ?? loc.longitude
  if (lat == null || lng == null) return <span className="text-sm">📍 Localização</span>
  const url = `https://www.google.com/maps?q=${lat},${lng}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
      📍 Ver localização
    </a>
  )
}

export function WhatsappMessageBubble({
  message,
  remoteJid,
  mentionMap,
  contactLabel,
  messagesById,
  onGoToMessage,
  onReact,
  onReply,
}: Props) {
  const tipo = message.tipo ?? ''
  const text = displayMessageContent(message)
  const quoted = extractQuotedPreview(message)
  const quotedAuthor = quoted
    ? resolveQuotedAuthorLabel(quoted, message, mentionMap, contactLabel, messagesById)
    : null
  const showText =
    tipo === 'conversation' ||
    tipo === 'extendedTextMessage' ||
    (!isMediaTipo(tipo) && tipo !== 'locationMessage' && !!text && text !== '—')

  return (
    <div className="group max-w-[75%]">
      <div
        className={cn(
          'rounded-2xl px-3 py-2 text-sm shadow-sm',
          message.from_me
            ? 'rounded-br-sm bg-emerald-500 text-white'
            : 'rounded-bl-sm bg-white text-slate-800',
        )}
      >
        {quoted && quotedAuthor && (
          <div className="mb-1.5">
            <WhatsappQuotedBlock
              preview={quoted.text}
              authorLabel={quotedAuthor.label}
              authorFromMe={quotedAuthor.fromMe}
              inOutgoingBubble={message.from_me}
              compact
              onClick={
                quoted.stanzaId && onGoToMessage
                  ? () => onGoToMessage(quoted.stanzaId!)
                  : undefined
              }
            />
          </div>
        )}

        {tipo === 'audioMessage' && (
          <WhatsappMessageAudio message={message} remoteJid={remoteJid} />
        )}

        {isMediaTipo(tipo) && tipo !== 'audioMessage' && (
          <WhatsappMessageMedia message={message} remoteJid={remoteJid} fromMe={message.from_me} />
        )}

        {tipo === 'locationMessage' && <LocationBlock message={message} />}

        {showText && (
          <WhatsappMessageText
            text={text}
            mentionMap={mentionMap}
            fromMe={message.from_me}
          />
        )}

        <div
          className={cn(
            'mt-0.5 flex items-center justify-end gap-1 text-[10px]',
            message.from_me ? 'text-emerald-100' : 'text-slate-400',
          )}
        >
          <WhatsappMessageStatus status={message.status} fromMe={message.from_me} />
          <span>
            {message.timestamp
              ? new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(message.timestamp))
              : ''}
          </span>
        </div>
      </div>

      {(onReact || onReply || (message.reactions?.length ?? 0) > 0) && (
        <WhatsappMessageActions
          message={message}
          reactions={message.reactions}
          onReact={
            onReact && !message.from_me
              ? (emoji) => onReact(message.message_id!, false, emoji)
              : undefined
          }
          onReply={onReply ? () => onReply(message) : undefined}
        />
      )}
    </div>
  )
}
