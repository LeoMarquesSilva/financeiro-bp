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
      body: JSON.stringify({
        message: {
          subject: assunto,
          body: { contentType: 'HTML', content: corpoHtml },
          toRecipients: toList.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: true,
      }),
    },
  )
  if (!resp.ok && resp.status !== 202) {
    const data = await resp.json().catch(() => ({}))
    throw new Error(JSON.stringify(data))
  }
}
