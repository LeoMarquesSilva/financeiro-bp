/** Traduz erro JSON do Graph exibido no toast de cobrança por e-mail. */
export function formatGraphMailErrorForUser(raw: string | undefined): string {
  if (!raw?.trim()) return 'Não foi possível enviar o e-mail.'
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: string; message?: string }
    }
    const code = parsed.error?.code
    const graphMsg = parsed.error?.message ?? ''
    if (code === 'ErrorInvalidUser') {
      const match = graphMsg.match(/'([^']+)' is invalid/)
      const who = match?.[1] ?? 'caixa remetente'
      return (
        `"${who}" não pode ser usado no Graph: alias e grupo de e-mail não são mailbox. ` +
        'MS_SENDER deve ser caixa compartilhada ou usuário Exchange; use MS_FROM_ADDRESS para financeiro@… (Enviar como).'
      )
    }
    if (code === 'ErrorAccessDenied') {
      return 'Sem permissão Mail.Send no Microsoft Graph para enviar como a caixa financeira.'
    }
    if (graphMsg) return graphMsg
  } catch {
    /* já formatado pela edge function */
  }
  return raw.length > 400 ? `${raw.slice(0, 400)}…` : raw
}
