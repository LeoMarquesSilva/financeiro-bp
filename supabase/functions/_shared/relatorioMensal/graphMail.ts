import { buildGraphSendMailBody } from '../graphSendMailPayload.ts'

export async function getGraphToken(
  tenant: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(`Token Graph falhou: ${JSON.stringify(data)}`)
  }
  return data.access_token as string
}

export async function sendGraphMail(
  token: string,
  sender: string,
  destinos: string | string[],
  assunto: string,
  corpoHtml: string,
  options?: { fromAddress?: string | null; fromName?: string | null },
): Promise<void> {
  const toList = (Array.isArray(destinos) ? destinos : [destinos])
    .map((d) => d.trim())
    .filter(Boolean)
  if (toList.length === 0) {
    throw new Error('Nenhum destinatário informado.')
  }

  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildGraphSendMailBody({
          subject: assunto,
          body: corpoHtml,
          to: toList,
          fromAddress: options?.fromAddress,
          fromName: options?.fromName,
        }),
      ),
    },
  )
  if (!resp.ok && resp.status !== 202) {
    const data = await resp.json().catch(() => ({}))
    throw new Error(JSON.stringify(data))
  }
}

type GraphMessage = {
  id: string
  subject?: string
  internetMessageId?: string
  sentDateTime?: string
  toRecipients?: Array<{ emailAddress?: { address?: string } }>
}

async function graphJson<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await resp.text()
  let data: T | null = null
  if (text) {
    try {
      data = JSON.parse(text) as T
    } catch {
      data = null
    }
  }
  if (!resp.ok) {
    const err = data && typeof data === 'object' && 'error' in data
      ? JSON.stringify((data as { error: unknown }).error)
      : text.slice(0, 500)
    return { ok: false, status: resp.status, data, error: err }
  }
  return { ok: true, status: resp.status, data }
}

function isGestaoVistaErradoHoje(msg: GraphMessage, sinceIso: string): boolean {
  const subject = msg.subject ?? ''
  const sent = msg.sentDateTime ?? ''
  return (
    sent >= sinceIso
    && subject.includes('SIOE')
    && subject.includes('Gestão à vista')
    && (subject.includes('09/2026') || subject.includes('sem recorte'))
  )
}

/**
 * Tenta recall Exchange + exclusão nas caixas dos destinatários (mesmo tenant).
 * Exige Mail.ReadWrite no app; com só Mail.Send falha e devolve o motivo.
 */
export async function recallGestaoVistaEmails(
  token: string,
  sender: string,
  extraEmails: string[] = [],
  sinceIso = '2026-09-01T14:00:00Z',
): Promise<{
  listOk: boolean
  mensagens: number
  recalls: Array<{ id: string; subject: string; status: number; detalhe: string }>
  deletes: Array<{ email: string; status: number; detalhe: string }>
  erroLista?: string
}> {
  const senderEnc = encodeURIComponent(sender)
  const listUrl =
    `https://graph.microsoft.com/v1.0/users/${senderEnc}/mailFolders/sentItems/messages`
    + '?$top=30&$orderby=sentDateTime desc&$select=id,subject,internetMessageId,toRecipients,sentDateTime'

  const listed = await graphJson<{ value?: GraphMessage[] }>(token, listUrl)
  if (!listed.ok || !listed.data?.value) {
    return {
      listOk: false,
      mensagens: 0,
      recalls: [],
      deletes: [],
      erroLista: listed.error ?? `HTTP ${listed.status}`,
    }
  }

  const alvo = listed.data.value.filter((m) => isGestaoVistaErradoHoje(m, sinceIso))
  const recalls: Array<{ id: string; subject: string; status: number; detalhe: string }> = []
  const deletes: Array<{ email: string; status: number; detalhe: string }> = []
  const emails = new Set(extraEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))

  for (const msg of alvo) {
    for (const to of msg.toRecipients ?? []) {
      const addr = to.emailAddress?.address?.trim().toLowerCase()
      if (addr) emails.add(addr)
    }

    const recallUrl =
      `https://graph.microsoft.com/beta/users/${senderEnc}/mailFolders/sentitems/messages/${encodeURIComponent(msg.id)}/recall`
    const recalled = await graphJson<Record<string, unknown>>(token, recallUrl, {
      method: 'POST',
      body: '{}',
    })
    recalls.push({
      id: msg.id,
      subject: msg.subject ?? '',
      status: recalled.status,
      detalhe: recalled.ok
        ? JSON.stringify(recalled.data).slice(0, 300)
        : (recalled.error ?? `HTTP ${recalled.status}`),
    })

    const mid = msg.internetMessageId
    if (!mid) continue
    const filter = encodeURIComponent(`internetMessageId eq '${mid.replaceAll("'", "''")}'`)

    for (const email of emails) {
      const findUrl =
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/messages?$filter=${filter}&$select=id`
      const found = await graphJson<{ value?: Array<{ id: string }> }>(token, findUrl)
      if (!found.ok) {
        deletes.push({
          email,
          status: found.status,
          detalhe: found.error ?? `busca falhou HTTP ${found.status}`,
        })
        continue
      }
      for (const hit of found.data?.value ?? []) {
        const delUrl =
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/messages/${encodeURIComponent(hit.id)}/permanentDelete`
        const deleted = await graphJson<unknown>(token, delUrl, { method: 'POST' })
        deletes.push({
          email,
          status: deleted.status,
          detalhe: deleted.ok ? `apagado ${hit.id}` : (deleted.error ?? `HTTP ${deleted.status}`),
        })
      }
    }
  }

  return { listOk: true, mensagens: alvo.length, recalls, deletes }
}
