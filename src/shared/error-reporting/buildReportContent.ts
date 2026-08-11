export type ReportarErroContext = {
  /** Nome do indicador (Overview) ou seção. */
  indicador?: string | null
  /** Ex.: Eficiência, Operações Legais, Receita. */
  modulo?: string | null
  ano?: number | null
  /** Filtro de mês (números 1–12, array, ou rótulos especiais do Overview). */
  mes?: number | number[] | string | null
  area?: string | null
  /** Erro capturado pelo Error Boundary. */
  error?: Error | null
  /** Resumo curto opcional (entra no título). */
  resumo?: string | null
}

export function resolveModuloFromPath(pathname: string): string {
  if (pathname.includes('/operacoes-legais')) return 'Operações Legais'
  if (pathname.includes('/eficiencia')) return 'Eficiência'
  if (pathname.includes('/receita')) return 'Receita'
  if (pathname.includes('/opex')) return 'OPEX'
  if (pathname.includes('/inadimplencia')) return 'Inadimplência'
  if (pathname.includes('/cobranca')) return 'Cobrança'
  if (pathname.includes('/escritorio')) return 'Escritório'
  if (pathname.includes('/usuarios')) return 'Usuários'
  if (pathname.includes('/configuracoes')) return 'Configurações'
  return 'SIOE'
}

export function buildDefaultTitle(ctx: ReportarErroContext, route: string): string {
  const modulo = ctx.modulo ?? resolveModuloFromPath(route)
  const alvo = ctx.indicador?.trim() || route
  const resumo = ctx.resumo?.trim() || ctx.error?.message?.slice(0, 80) || 'divergência / falha na tela'
  return `SIOE · ${modulo} · ${alvo} · ${resumo}`.slice(0, 240)
}

export function buildCursorPrompt(ctx: ReportarErroContext, route: string): string {
  const modulo = ctx.modulo ?? resolveModuloFromPath(route)
  const lines = [
    'Corrija o seguinte problema no SIOE (React/Vite + Supabase).',
    '',
    `Módulo: ${modulo}`,
    `Rota: ${route}`,
  ]
  if (ctx.indicador) lines.push(`Indicador: ${ctx.indicador}`)
  if (ctx.area) lines.push(`Filtro área: ${ctx.area}`)
  if (ctx.ano != null) lines.push(`Ano: ${ctx.ano}`)
  if (ctx.mes != null) {
    const mesTxt = Array.isArray(ctx.mes) ? ctx.mes.join(', ') : String(ctx.mes)
    lines.push(`Mês filtro: ${mesTxt}`)
  }
  if (ctx.error) {
    lines.push('', `Erro: ${ctx.error.name}: ${ctx.error.message}`)
    if (ctx.error.stack) lines.push(`Stack:\n${ctx.error.stack}`)
  }
  lines.push(
    '',
    'Instruções:',
    '1. Reproduza o contexto (rota, filtros e indicador).',
    '2. Compare com as regras de negócio / RPCs / migrações canônicas do domínio.',
    '3. Corrija a causa raiz (não só o sintoma na UI).',
    '4. Valide o KPI / tela após a correção.',
    '',
    'Anexe as evidências do ticket RESPONSUM (screenshot + logs) ao diagnosticar.',
  )
  return lines.join('\n')
}

/** Campo do modal: só o que a pessoa digita (vazio por padrão; erro do boundary pré-preenche). */
export function buildDefaultDescription(ctx: ReportarErroContext, _route: string): string {
  return (ctx.resumo?.trim() || ctx.error?.message || '').trim()
}

/** Anexado ao enviar o ticket (não aparece no campo do modal). */
export function appendCursorPromptToDescription(
  userDescription: string,
  ctx: ReportarErroContext,
  route: string,
): string {
  return [
    userDescription.trim(),
    '',
    '---',
    '## Prompt para o Cursor',
    '```',
    buildCursorPrompt(ctx, route),
    '```',
  ].join('\n')
}
