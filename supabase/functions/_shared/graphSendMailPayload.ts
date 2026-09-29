export type GraphSendMailBody = {
  message: {
    subject: string
    body: { contentType: 'HTML' | 'Text'; content: string }
    toRecipients: Array<{ emailAddress: { address: string } }>
    from?: { emailAddress: { address: string; name?: string } }
  }
  saveToSentItems: boolean
}

export function buildGraphSendMailBody(input: {
  subject: string
  body: string
  to: string | string[]
  fromAddress?: string | null
  fromName?: string | null
}): GraphSendMailBody {
  const toList = (Array.isArray(input.to) ? input.to : [input.to])
    .map((d) => d.trim())
    .filter(Boolean)
  const isHtml = /<[a-z][\s\S]*>/i.test(input.body)
  const message: GraphSendMailBody['message'] = {
    subject: input.subject,
    body: {
      contentType: isHtml ? 'HTML' : 'Text',
      content: input.body,
    },
    toRecipients: toList.map((address) => ({ emailAddress: { address } })),
  }
  const from = input.fromAddress?.trim()
  if (from) {
    message.from = {
      emailAddress: {
        address: from,
        ...(input.fromName?.trim() ? { name: input.fromName.trim() } : {}),
      },
    }
  }
  return { message, saveToSentItems: true }
}
