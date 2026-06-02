/** Rótulo legível para plano_contas (corrige acentos corrompidos do VIOS). */
export function labelPlanoContas(raw: string): string {
  const n = raw.toUpperCase().trim().replace(/[^A-Z0-9 ]/g, '')
  if (n.includes('MENSAIS') && n.includes('HONOR')) return 'HONORÁRIOS MENSAIS'
  if (n.includes('SPOT') && n.includes('HONOR')) return 'HONORÁRIOS SPOT'
  if (n.includes('SUCUMB')) return 'HONORÁRIOS DE SUCUMBÊNCIA'
  if (n.includes('EXITO') || (n.includes('XITO') && n.includes('HONOR'))) return 'HONORÁRIOS DE ÊXITO'
  if (n.includes('MANUTEN')) return 'HONORÁRIOS DE MANUTENÇÃO'
  if (n.includes('HORA TRABALHADA')) return 'HONORÁRIOS POR HORA TRABALHADA'
  if (n.includes('ADVOCAT')) return 'HONORÁRIOS ADVOCATÍCIOS'
  return raw.trim()
}
