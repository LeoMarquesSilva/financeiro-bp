/** Mensagem legível a partir da resposta JSON do Graph sendMail. */
export function formatGraphSendMailError(
  raw: string,
  sender?: string,
): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: string; message?: string }
    }
    const code = parsed.error?.code
    const graphMsg = parsed.error?.message ?? ''
    if (code === 'ErrorInvalidUser') {
      const who = sender?.trim() || 'remetente configurado'
      return (
        `"${who}" não é uma mailbox válida no Graph (alias, grupo de distribuição e lista não funcionam em /users/.../sendMail). ` +
        'Configure MS_SENDER com o UPN de uma caixa compartilhada ou usuário com licença Exchange, e MS_FROM_ADDRESS com financeiro@… ' +
        'se o cliente deve ver o alias (requer permissão Enviar como no Exchange).'
      )
    }
    if (code === 'ErrorAccessDenied' || graphMsg.includes('Access is denied')) {
      return (
        'O app Microsoft Graph não tem permissão Mail.Send (consentimento admin) para enviar como essa caixa.'
      )
    }
    if (graphMsg) return graphMsg
  } catch {
    /* raw não é JSON */
  }
  return raw.slice(0, 500)
}
