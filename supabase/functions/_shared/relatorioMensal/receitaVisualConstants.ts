/** Paleta Receita — espelho de `src/features/receita/constants.ts` (hex para e-mail). */
export const RECEITA_COLORS = {
  meta: '#16a34a',
  recebido: '#0284c7',
  previsto: '#7c3aed',
  inadimplencia: '#dc2626',
  skyHeaderFrom: '#0284c7',
  skyHeaderTo: '#0369a1',
  skyPanelBg: '#eff6ff',
  skyPanelBorder: '#bae6fd',
  skyTitle: '#0c4a6e',
  skyText: '#075985',
  redPanelBg: '#fef2f2',
  redPanelBorder: '#fecaca',
  redTitle: '#7f1d1d',
  redText: '#991b1b',
} as const

export const RECEITA_META_INADIMPLENCIA_PCT = 10

export const COMPOSICAO_RECEBIDO_LINHAS = [
  {
    key: 'inad_recebida',
    label: 'Inadimplência recebida',
    hint: 'Recebimentos classificados como inadimplência no mês',
    color: '#dc2626',
    bar: '#ef4444',
  },
  {
    key: 'receita_mes_caixa',
    label: 'Receita do mês (caixa)',
    hint: 'Vencimento e pagamento neste mês (exceto 1º pagamento na cota)',
    color: '#059669',
    bar: '#10b981',
  },
  {
    key: 'novos_vencimento_mes',
    label: 'Novos contratos — vencimento neste mês',
    hint: '1º pagamento na cota com vencimento neste mês — compõe o previsto',
    color: '#6d28d9',
    bar: '#8b5cf6',
  },
  {
    key: 'novos_vencimento_anterior',
    label: 'Novos contratos — vencimento em mês anterior',
    hint: '1º pagamento na cota com vencimento anterior — extra ao previsto do mês',
    color: '#7c3aed',
    bar: '#a78bfa',
  },
] as const

export const MESES_EFICIENCIA_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const
