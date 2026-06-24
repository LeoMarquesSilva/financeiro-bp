import { formatCurrency, formatDate } from '@/shared/utils/format'
import type { TemplateSource } from './template'

const MESES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
]

function mesAnoReferencia(rows: TemplateSource[]): string {
  const ref = rows[0]?.data_vencimento
  if (!ref) {
    const hoje = new Date()
    return `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`
  }
  const m = /^(\d{4})-(\d{2})/.exec(ref)
  if (!m) return ref
  return `${m[2]}/${m[1]}`
}

function nomeEmpresa(rows: TemplateSource[]): string {
  const nome = rows[0]?.pessoa_nome || rows[0]?.cliente || 'CLIENTE'
  return nome.trim().toUpperCase()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Assunto: FATURAMENTO mes/ano | EMPRESA | BISMARCHI PIRES */
export function buildAssuntoEmailCobranca(rows: TemplateSource[]): string {
  return `FATURAMENTO ${mesAnoReferencia(rows)} | ${nomeEmpresa(rows)} | BISMARCHI PIRES`
}

/** Corpo do e-mail em HTML (negrito nos rótulos e na assinatura). */
export function buildCorpoEmailCobranca(
  rows: TemplateSource[],
  usuario?: string | null,
  nomeContato?: string | null,
): string {
  const nome = escapeHtml(
    nomeContato?.trim() || rows[0]?.pessoa_nome || rows[0]?.cliente || 'Prezado(a) Cliente',
  )
  const assinatura = escapeHtml(usuario?.trim() || 'Equipe Financeira')
  const total = rows.reduce((sum, r) => sum + Number(r.valor ?? 0), 0)

  const faturas = rows
    .map((r) => {
      const descricao = escapeHtml((r.descricao?.trim() || 'Serviços advocatícios').toUpperCase())
      const valor = escapeHtml(formatCurrency(Number(r.valor ?? 0)))
      const vencimento = escapeHtml(r.data_vencimento ? formatDate(r.data_vencimento) : '-')
      const atraso = Number(r.dias_atraso ?? 0)
      const linhas = [
        `• <strong>Descrição:</strong> ${descricao}<br>`,
        `&nbsp;&nbsp;<strong>Valor:</strong> ${valor}<br>`,
        `&nbsp;&nbsp;<strong>Vencimento:</strong> ${vencimento}`,
      ]
      if (atraso > 0) {
        linhas.push(`<br>&nbsp;&nbsp;<strong>Situação:</strong> ${atraso} dia(s) em atraso`)
      }
      return linhas.join('')
    })
    .join('<br><br>')

  const mesRef = mesAnoReferencia(rows)
  const mesNome = (() => {
    const ref = rows[0]?.data_vencimento
    if (!ref) return null
    const m = /^(\d{4})-(\d{2})/.exec(ref)
    if (!m) return null
    const idx = Number(m[2]) - 1
    return MESES[idx] ?? null
  })()

  const referencia =
    mesNome != null
      ? `referente ao faturamento de ${mesNome}/${mesRef.slice(-4)}`
      : 'em aberto em nosso sistema'

  const partes: string[] = [
    `<p>Prezado(a) ${nome},</p>`,
    `<p>Esperamos que esta mensagem o(a) encontre bem.</p>`,
    `<p>Até a presente data, não identificamos o pagamento da(s) fatura(s) ${escapeHtml(referencia)}:</p>`,
    `<p>${faturas}</p>`,
  ]

  if (rows.length > 1) {
    partes.push(`<p><strong>Valor total em aberto:</strong> ${escapeHtml(formatCurrency(total))}</p>`)
  }

  partes.push(
    `<p>Solicitamos a regularização do(s) pagamento(s) o mais breve possível.</p>`,
    `<p>Caso o pagamento já tenha sido efetuado, pedimos a gentileza de encaminhar o comprovante para fins de baixa em nosso sistema, desconsiderando esta comunicação.</p>`,
    `<p>Permanecemos à disposição para esclarecimentos.</p>`,
    `<p>Atenciosamente,</p>`,
    `<p><strong>${assinatura}</strong><br><strong>Bismarchi | Pires Sociedade de Advogados</strong><br><strong>financeiro@bismarchipires.com.br</strong></p>`,
  )

  return partes.join('\n')
}
