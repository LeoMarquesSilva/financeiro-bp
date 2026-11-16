/**
 * Fênix no DL: memória de cálculo de cada linha do demonstrativo e dos números da Visão geral.
 *
 * Funções puras. Recebem os mesmos valores que a tela mostra (o array do demonstrativo e o total
 * que a tabela já calculou), então a conta sempre fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 *
 * Regras conforme `dl_resultado_mensal` / `dl_gestor_mensal` (migrations 20261026210000 e
 * 20261026211000). Quando o branch das regras do consultor entrar (alíquota por mês, profissionais
 * do RH, % da Controladoria do Fechamento Legal Ops, carteira automática), revisar as constantes
 * REGRA_* e DL_ALIQUOTA_IMPOSTO_PCT abaixo.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatPercent } from '../../../shared/utils/format.ts'
import type { DlGestor, DlLinhaKey, DlMesCalculado, DlMesRow } from '../types/dl.types.ts'
import { DL_DIAS_MES, DL_EFICIENCIA, DL_HORAS_DIA, DL_LINHAS, DL_REFERENCIA_GERAL } from '../utils/dlCalc.ts'

/** Alíquota fixa aplicada em `dl_resultado_mensal` (0.160587) sobre o recebido com NFS-e. */
export const DL_ALIQUOTA_IMPOSTO_PCT = 16.0587

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const moeda = formatCurrency

function pctBr(v: number, casas = 2): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`
}

function numBr(v: number, casas = 1): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: casas })
}

function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

/** Ex.: "Out/26". */
function rotuloMes(ano: number, mes: number): string {
  return `${MESES[mes - 1] ?? mes}/${String(ano).slice(-2)}`
}

/** Ex.: "Jan–Nov/2026" (ou "Mar/2026"). */
export function periodoDl(ano: number, meses: readonly number[]): string {
  const s = [...meses].sort((a, b) => a - b)
  if (s.length === 0) return String(ano)
  if (s.length === 1) return `${MESES[s[0]! - 1]}/${ano}`
  return `${MESES[s[0]! - 1]}–${MESES[s[s.length - 1]! - 1]}/${ano}`
}

/** Mesmo formato da coluna Total do demonstrativo (DlDemonstrativoTable). */
export function formatarDlTotal(key: DlLinhaKey, v: number): string {
  if (key === 'margem_pct') return formatPercent(v * 100)
  if (key === 'profissionais') return `${numBr(v)} (média)`
  if (key === 'custo_hora') return v > 0 ? moeda(v) : '—'
  return moeda(v)
}

/** "(−) Desp. Operacionais" → "Desp. Operacionais". */
function nomeLinha(key: DlLinhaKey): string {
  const label = DL_LINHAS.find((l) => l.key === key)?.label ?? key
  return label.replace(/^\([−=+-]\)\s*/, '')
}

// ---------------------------------------------------------------------------
// Regras (texto para quem lê; técnico só em fonteTecnica)
// ---------------------------------------------------------------------------

const PLANOS_HONORARIOS = listaComE([
  'advocatícios',
  'de êxito',
  'de manutenção',
  'de sucumbência',
  'mensais',
  'spot',
  'por hora trabalhada',
])

export const REGRA_CAIXA =
  'Base caixa: cada valor entra no mês da data de pagamento no VIOS, não no mês de competência.'
const REGRA_RECEITA_PLANOS = `Só entram os honorários ${PLANOS_HONORARIOS}. Os demais recebimentos ficam fora.`
const REGRA_RECEITA_AREA =
  'A área de cada recebimento é o departamento do item no VIOS (ADD = departamento Distressed Deals).'
export const REGRA_IMPOSTO = `Imposto = ${pctBr(DL_ALIQUOTA_IMPOSTO_PCT, 4)} do recebido que tem nota fiscal (título com número de NFS-e). Recebimento sem nota não tem imposto. A alíquota é a da planilha oficial do DL.`
const REGRA_DESPESA_AREA =
  'Despesas operacionais = pagamentos (títulos a pagar) lançados no departamento da área no VIOS.'
export const REGRA_DESPESA_FORA =
  'Ficam fora das despesas: distribuição de lucros (inclusive o DL pago aos gestores), sócios, investimentos, empréstimos e devoluções, deduções da receita, outras receitas operacionais e impostos e taxas (contas 3.3 e 5.14.03), porque o imposto sobre o faturamento já sai na linha de impostos.'
export const REGRA_CONTROLADORIA =
  'Controladoria = pagamentos do departamento Operações Legais no mês × % da área naquele mês.'
const REGRA_CONTROLADORIA_PCT =
  'O % de cada área é cadastrado mês a mês na aba Parâmetros (na tela, "% de agendamentos"). Pelo acordado com o consultor, é o % de horas da equipe de Operações Legais dedicadas à área no Fechamento Legal Ops.'
export const REGRA_INDIRETAS =
  'Indiretas = pagamentos de Facilities, Financeiro, Marketing, R.H., T.I. e Comercial + pró-labore dos sócios, divididos pelo total de profissionais das áreas e multiplicados pelos profissionais da área.'
const REGRA_PROFISSIONAIS =
  'Profissionais por área vêm da aba Parâmetros. Mês sem cadastro usa o último mês cadastrado no mesmo ano (marcado com • no demonstrativo).'
const REGRA_PARAMETRO_HERDADO =
  'Mês sem parâmetros cadastrados usa os do último mês cadastrado no mesmo ano (marcado com • no demonstrativo).'
export const REGRA_DL_FORMULA =
  'DL do gestor = % do gestor × resultado dos clientes da carteira dele no mês.'
const REGRA_DL_CLIENTE =
  'Resultado do cliente = honorário líquido do cliente (sem o imposto) − despesas da área (operacionais + controladoria + indiretas) rateadas pela participação do cliente na receita líquida da área.'
export const REGRA_DL_NEGATIVO =
  'Se o resultado da carteira no mês for negativo, o DL do gestor fica zero naquele mês (não compensa com outros meses).'
const REGRA_DL_NAO_DESPESA =
  'O DL pago aos gestores não é despesa da área e não entra na conta do resultado: a linha DL Gestor é só para conferência.'
const REGRA_DL_VIGENCIA =
  'Só há DL nos meses de vigência do gestor e para os clientes da carteira dele, ambos configurados na aba Parâmetros.'
const REGRA_HORAS = `Horas produtivas = ${DL_HORAS_DIA} h por dia × ${DL_DIAS_MES} dias × ${pctBr(DL_EFICIENCIA * 100)} de eficiência × profissionais de cada mês (premissas da planilha oficial).`

const FONTE = 'Financeiro do VIOS (títulos a receber e a pagar sincronizados no SIOE), com os parâmetros da aba Parâmetros do DL.'
const FONTE_TECNICA =
  'Supabase › dl_resultado_mensal (financeiro_parcelas_itens, dl_areas, dl_parametros_mensais) + dl_gestor_mensal; cascata em src/features/dl/utils/dlCalc.ts'

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

export type DlFenixArea = {
  key: string
  nome: string
  departamento: string
  /** Referência de mercado da margem de contribuição (0–1). */
  referencia: number | null
}

export type DlFenixContexto = {
  ano: number
  /** Meses do período escolhido (De/Até). */
  meses: readonly number[]
  /** Área do número; sem área = escritório (soma das áreas). */
  area?: DlFenixArea | null
  /** Nomes das áreas somadas no escritório. */
  areasNomes?: readonly string[]
  /** Mês corrente, ainda parcial. */
  mesParcial?: number | null
  /** Linhas de dl_resultado_mensal de todas as áreas (para % da Controladoria, profissionais e pró-labore). */
  rows?: readonly DlMesRow[]
  /** Gestores com DL no ano (todas as áreas). */
  gestores?: readonly DlGestor[]
  /** Sobrescreve a tela (ex.: linha de uma área na Visão geral). */
  tela?: string
}

function telaDl(ctx: DlFenixContexto): string {
  if (ctx.tela) return ctx.tela
  return ctx.area ? `DL › Por área › ${ctx.area.nome}` : 'DL › Visão geral'
}

function escopoTexto(ctx: DlFenixContexto): string {
  return ctx.area ? `da área ${ctx.area.nome}` : 'das áreas jurídicas do escritório'
}

function filtrosDl(ctx: DlFenixContexto): FenixFiltro[] {
  const f: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(ctx.ano) },
    { rotulo: 'Período', valor: periodoDl(ctx.ano, ctx.meses) },
  ]
  if (ctx.area) {
    f.push({ rotulo: 'Área', valor: `${ctx.area.nome} (departamento ${ctx.area.departamento} no VIOS)` })
  } else {
    const n = ctx.areasNomes?.length
    f.push({ rotulo: 'Escopo', valor: n ? `escritório (${n} áreas)` : 'escritório (todas as áreas)' })
  }
  f.push({ rotulo: 'Base', valor: 'caixa (data de pagamento)' })
  return f
}

function regraEscopo(ctx: DlFenixContexto): string[] {
  if (ctx.area) return []
  const nomes = ctx.areasNomes ?? []
  return [
    nomes.length > 0
      ? `O escritório é a soma das ${nomes.length} áreas jurídicas (${listaComE(nomes)}). Despesas de sócios e repasses ficam fora.`
      : 'O escritório é a soma das áreas jurídicas. Despesas de sócios e repasses ficam fora.',
  ]
}

function regraMesParcial(ctx: DlFenixContexto): string[] {
  if (ctx.mesParcial == null || !ctx.meses.includes(ctx.mesParcial)) return []
  return [`${rotuloMes(ctx.ano, ctx.mesParcial)} ainda está em andamento: entra só o que foi pago até hoje.`]
}

function referencia(ctx: DlFenixContexto): { valor: number; texto: string } | null {
  if (ctx.area) {
    const r = ctx.area.referencia
    return r == null ? null : { valor: r, texto: `referência de mercado da área: ${formatPercent(r * 100)}` }
  }
  return { valor: DL_REFERENCIA_GERAL, texto: `referência do escritório: ${formatPercent(DL_REFERENCIA_GERAL * 100)} (planilha oficial)` }
}

// ---------------------------------------------------------------------------
// Linhas da conta
// ---------------------------------------------------------------------------

const centavos = (v: number) => Math.round(v * 100)

function linhaTotal(rotulo: string, v: number, valor = moeda(v)): FenixLinha {
  return { rotulo, valor, numero: v, operador: '=', tipo: 'total' }
}

/** Linhas arredondadas que não somam o total exato: avisa a diferença. */
function notaCentavos(parcelas: readonly number[], totalExato: number): FenixLinha[] {
  const somaExibida = parcelas.reduce((s, v) => s + centavos(v), 0)
  const dif = (centavos(totalExato) - somaExibida) / 100
  if (dif === 0) return []
  return [
    {
      rotulo: 'Frações de centavo',
      valor: moeda(Math.abs(dif)),
      numero: dif,
      tipo: 'info',
      detalhe: `as linhas aparecem arredondadas e somam ${moeda(somaExibida / 100)}; o total usa os valores exatos`,
    },
  ]
}

function rowsDoMes(ctx: DlFenixContexto, mes: number): DlMesRow[] {
  return (ctx.rows ?? []).filter((r) => r.mes === mes)
}

function rowDaArea(ctx: DlFenixContexto, mes: number): DlMesRow | undefined {
  if (!ctx.area) return undefined
  return ctx.rows?.find((r) => r.area_key === ctx.area!.key && r.mes === mes)
}

function gestoresVigentes(ctx: DlFenixContexto, mes: number): DlGestor[] {
  if (!ctx.area) return []
  return (ctx.gestores ?? []).filter(
    (g) => g.area_key === ctx.area!.key && mes >= g.mes_inicio && mes <= g.mes_fim,
  )
}

function detalheMes(key: DlLinhaKey, m: DlMesCalculado, ctx: DlFenixContexto): string | undefined {
  const partes: string[] = []
  if (key === 'desp_controladoria') {
    if (ctx.area) {
      const r = rowDaArea(ctx, m.mes)
      if (r) partes.push(`${pctBr(r.pct_controladoria)} das despesas de Operações Legais`)
    } else {
      const doMes = rowsDoMes(ctx, m.mes)
      if (doMes.length > 0) {
        const soma = doMes.reduce((s, r) => s + r.pct_controladoria, 0)
        partes.push(`as áreas somam ${pctBr(soma)} das despesas de Operações Legais`)
      }
    }
  }
  if (key === 'desp_indiretas') {
    const doMes = rowsDoMes(ctx, m.mes)
    const totalProf = doMes.reduce((s, r) => s + r.profissionais, 0)
    if (ctx.area) {
      const r = rowDaArea(ctx, m.mes)
      if (r && totalProf > 0) partes.push(`${numBr(r.profissionais)} de ${numBr(totalProf)} profissionais`)
    } else if (totalProf > 0) {
      partes.push(`${numBr(totalProf)} profissionais`)
    }
  }
  if ((key === 'desp_controladoria' || key === 'desp_indiretas') && m.herdado) {
    partes.push('parâmetros herdados do último mês cadastrado')
  }
  if (key === 'dl_gestor' && ctx.area) {
    const vig = gestoresVigentes(ctx, m.mes)
    if (vig.length === 0) partes.push('sem gestor vigente')
    else {
      partes.push(vig.map((g) => `${g.nome} ${pctBr(g.pct)}`).join(' · '))
      if (m.dl_gestor === 0) partes.push('zero: resultado da carteira não foi positivo')
    }
  }
  if (ctx.mesParcial === m.mes) partes.push('mês em andamento')
  return partes.length > 0 ? partes.join(' · ') : undefined
}

function linhasMensais(key: DlLinhaKey, demo: readonly DlMesCalculado[], ctx: DlFenixContexto): FenixLinha[] {
  return demo.map((m, i) => ({
    rotulo: rotuloMes(ctx.ano, m.mes),
    valor: moeda(m[key]),
    numero: m[key],
    operador: i === 0 ? undefined : '+',
    detalhe: detalheMes(key, m, ctx),
  }))
}

function proLaboreNoPeriodo(ctx: DlFenixContexto): number {
  // O pró-labore é do escritório: vem igual em todas as linhas do mês; pega uma por mês.
  return ctx.meses.reduce((s, mes) => s + (rowsDoMes(ctx, mes)[0]?.socios_prolabore ?? 0), 0)
}

// ---------------------------------------------------------------------------
// Explicações
// ---------------------------------------------------------------------------

type BaseExp = Pick<FenixExplicacao, 'tela' | 'filtros' | 'fonte' | 'fonteTecnica'>

function base(ctx: DlFenixContexto): BaseExp {
  return { tela: telaDl(ctx), filtros: filtrosDl(ctx), fonte: FONTE, fonteTecnica: FONTE_TECNICA }
}

const DETALHE_AREA = 'Para ver mês a mês, use o demonstrativo; na Visão geral, clique numa área para abrir o dela.'

function explicarMensal(
  key: DlLinhaKey,
  demo: readonly DlMesCalculado[],
  total: DlMesCalculado,
  ctx: DlFenixContexto,
  resumo: string,
  formula: string,
  regras: string[],
  extra: FenixLinha[] = [],
): FenixExplicacao {
  const periodo = periodoDl(ctx.ano, ctx.meses)
  return {
    ...base(ctx),
    titulo: `${nomeLinha(key)} — ${periodo}`,
    valor: moeda(total[key]),
    resumo,
    formula,
    conta: [
      ...linhasMensais(key, demo, ctx),
      linhaTotal(`${nomeLinha(key)} no período`, total[key]),
      ...notaCentavos(
        demo.map((m) => m[key]),
        total[key],
      ),
      ...extra,
    ],
    regras: [...regras, ...regraEscopo(ctx), ...regraMesParcial(ctx)],
    detalhe: DETALHE_AREA,
  }
}

/** Linha do demonstrativo (coluna Total) para o período e o escopo (área ou escritório). */
export function explicarDlLinha(
  key: DlLinhaKey,
  demo: readonly DlMesCalculado[],
  total: DlMesCalculado,
  ctx: DlFenixContexto,
): FenixExplicacao {
  const periodo = periodoDl(ctx.ano, ctx.meses)
  switch (key) {
    case 'receita_bruta':
      return explicarMensal(
        key,
        demo,
        total,
        ctx,
        `Honorários recebidos ${escopoTexto(ctx)} em ${periodo}, antes do imposto.`,
        'Receita bruta = soma dos honorários pagos em cada mês (pela data de pagamento)',
        [REGRA_CAIXA, REGRA_RECEITA_PLANOS, REGRA_RECEITA_AREA],
      )
    case 'impostos': {
      const extra: FenixLinha[] =
        total.receita_bruta > 0
          ? [
              {
                rotulo: 'Imposto ÷ receita bruta do período',
                valor: pctBr((total.impostos / total.receita_bruta) * 100),
                numero: (total.impostos / total.receita_bruta) * 100,
                tipo: 'info',
                detalhe:
                  total.impostos / total.receita_bruta < DL_ALIQUOTA_IMPOSTO_PCT / 100 - 0.0001
                    ? `abaixo de ${pctBr(DL_ALIQUOTA_IMPOSTO_PCT, 4)} porque só o recebido com nota fiscal paga imposto`
                    : undefined,
              },
            ]
          : []
      return explicarMensal(
        key,
        demo,
        total,
        ctx,
        `Imposto sobre os honorários recebidos com nota fiscal ${escopoTexto(ctx)} em ${periodo}.`,
        `Impostos = ${pctBr(DL_ALIQUOTA_IMPOSTO_PCT, 4)} × recebido com nota fiscal, mês a mês`,
        [REGRA_IMPOSTO, REGRA_CAIXA, REGRA_RECEITA_PLANOS],
        extra,
      )
    }
    case 'desp_operacionais':
      return explicarMensal(
        key,
        demo,
        total,
        ctx,
        ctx.area
          ? `Despesas pagas no próprio departamento ${ctx.area.departamento} em ${periodo}.`
          : `Despesas pagas nos departamentos das áreas jurídicas em ${periodo}.`,
        'Desp. operacionais = soma dos pagamentos do departamento da área em cada mês',
        [REGRA_DESPESA_AREA, REGRA_DESPESA_FORA, REGRA_CAIXA],
      )
    case 'desp_controladoria':
      return explicarMensal(
        key,
        demo,
        total,
        ctx,
        ctx.area
          ? `Parte das despesas de Operações Legais (controladoria) que cabe à área ${ctx.area.nome} em ${periodo}.`
          : `Parte das despesas de Operações Legais (controladoria) rateada para as áreas jurídicas em ${periodo}.`,
        'Controladoria do mês = despesas de Operações Legais × % da área',
        [REGRA_CONTROLADORIA, REGRA_CONTROLADORIA_PCT, REGRA_PARAMETRO_HERDADO, REGRA_DESPESA_FORA, REGRA_CAIXA],
      )
    case 'desp_indiretas': {
      const pl = proLaboreNoPeriodo(ctx)
      const extra: FenixLinha[] =
        ctx.rows && ctx.rows.length > 0
          ? [
              {
                rotulo: 'Pró-labore dos sócios no período',
                valor: moeda(pl),
                numero: pl,
                tipo: 'info',
                detalhe: ctx.area
                  ? 'valor do escritório, somado às indiretas antes do rateio; a área fica com a fatia dos profissionais dela'
                  : 'somado às indiretas antes do rateio pelas áreas',
              },
            ]
          : []
      return explicarMensal(
        key,
        demo,
        total,
        ctx,
        ctx.area
          ? `Fatia das despesas de apoio e do pró-labore dos sócios que cabe à área ${ctx.area.nome}, pelo número de profissionais.`
          : 'Despesas de apoio (Facilities, Financeiro, Marketing, R.H., T.I., Comercial) e pró-labore dos sócios rateados entre as áreas.',
        'Indiretas da área = (despesas de apoio + pró-labore) ÷ profissionais das áreas × profissionais da área',
        [REGRA_INDIRETAS, REGRA_PROFISSIONAIS, REGRA_DESPESA_FORA, REGRA_CAIXA],
        extra,
      )
    }
    case 'dl_gestor':
      return explicarMensal(
        key,
        demo,
        total,
        ctx,
        ctx.area
          ? `Distribuição de lucros dos gestores da área ${ctx.area.nome} em ${periodo}: % de cada gestor sobre o resultado da carteira dele.`
          : `Distribuição de lucros dos gestores de todas as áreas em ${periodo}.`,
        'DL Gestor = soma, mês a mês, de % do gestor × resultado da carteira (zero quando negativo)',
        [REGRA_DL_FORMULA, REGRA_DL_CLIENTE, REGRA_DL_NEGATIVO, REGRA_DL_VIGENCIA, REGRA_DL_NAO_DESPESA],
      )
    case 'receita_liquida':
      return {
        ...base(ctx),
        titulo: `Receita Líquida — ${periodo}`,
        valor: moeda(total.receita_liquida),
        resumo: `Receita bruta menos o imposto ${escopoTexto(ctx)}: o que sobra dos honorários para cobrir as despesas.`,
        formula: 'Receita líquida = Receita bruta − Impostos',
        conta: [
          { rotulo: 'Receita bruta', valor: moeda(total.receita_bruta), numero: total.receita_bruta },
          { rotulo: 'Impostos', valor: moeda(total.impostos), numero: total.impostos, operador: '−' },
          linhaTotal('Receita líquida', total.receita_liquida),
        ],
        regras: [REGRA_RECEITA_PLANOS, REGRA_IMPOSTO, REGRA_CAIXA, ...regraEscopo(ctx), ...regraMesParcial(ctx)],
        detalhe: DETALHE_AREA,
      }
    case 'margem':
      return explicarDlMargem(total, ctx)
    case 'margem_pct':
      return explicarDlMargemPct(total, ctx)
    case 'resultado':
      return explicarDlResultado(total, ctx)
    case 'profissionais':
      return explicarDlProfissionais(demo, total, ctx)
    case 'custo_hora':
      return explicarDlCustoHora(demo, total, ctx)
    default:
      return explicarMensal(
        key,
        demo,
        total,
        ctx,
        `Linha "${nomeLinha(key)}" do demonstrativo em ${periodo}.`,
        `${nomeLinha(key)} = soma dos meses do período`,
        [REGRA_CAIXA],
      )
  }
}

export function explicarDlMargem(t: DlMesCalculado, ctx: DlFenixContexto): FenixExplicacao {
  const periodo = periodoDl(ctx.ano, ctx.meses)
  const ref = referencia(ctx)
  return {
    ...base(ctx),
    titulo: `Margem de contribuição — ${periodo}`,
    valor: moeda(t.margem),
    resumo: `Quanto sobra da receita líquida ${escopoTexto(ctx)} depois das despesas diretas (operacionais e controladoria), antes das indiretas.`,
    formula: 'Margem = Receita líquida − Desp. operacionais − Desp. controladoria',
    conta: [
      {
        rotulo: 'Receita líquida',
        valor: moeda(t.receita_liquida),
        numero: t.receita_liquida,
        detalhe: `receita bruta ${moeda(t.receita_bruta)} − impostos ${moeda(t.impostos)}`,
      },
      { rotulo: 'Desp. operacionais', valor: moeda(t.desp_operacionais), numero: t.desp_operacionais, operador: '−' },
      { rotulo: 'Desp. controladoria', valor: moeda(t.desp_controladoria), numero: t.desp_controladoria, operador: '−' },
      linhaTotal('Margem de contribuição', t.margem),
      {
        rotulo: 'Margem %',
        valor: t.receita_liquida > 0 ? formatPercent(t.margem_pct * 100) : '—',
        numero: t.margem_pct * 100,
        tipo: 'info',
        detalhe: ['margem ÷ receita líquida', ref?.texto].filter(Boolean).join(' · '),
      },
    ],
    regras: [
      REGRA_DESPESA_AREA,
      REGRA_CONTROLADORIA,
      REGRA_DESPESA_FORA,
      REGRA_CAIXA,
      ...regraEscopo(ctx),
      ...regraMesParcial(ctx),
    ],
    detalhe: DETALHE_AREA,
  }
}

export function explicarDlMargemPct(t: DlMesCalculado, ctx: DlFenixContexto): FenixExplicacao {
  const periodo = periodoDl(ctx.ano, ctx.meses)
  const ref = referencia(ctx)
  const conta: FenixLinha[] = [
    { rotulo: 'Margem de contribuição', valor: moeda(t.margem), numero: t.margem },
    { rotulo: 'Receita líquida', valor: moeda(t.receita_liquida), numero: t.receita_liquida, operador: '÷' },
    linhaTotal('Margem %', t.margem_pct * 100, formatPercent(t.margem_pct * 100)),
  ]
  if (ref) {
    conta.push({
      rotulo: ctx.area ? 'Referência de mercado' : 'Referência do escritório',
      valor: formatPercent(ref.valor * 100),
      numero: ref.valor * 100,
      tipo: 'info',
      detalhe:
        t.receita_liquida > 0 ? (t.margem_pct >= ref.valor ? 'margem acima da referência' : 'margem abaixo da referência') : undefined,
    })
  }
  return {
    ...base(ctx),
    titulo: `Margem % — ${periodo}`,
    valor: formatPercent(t.margem_pct * 100),
    resumo: 'Margem de contribuição como percentual da receita líquida, comparada com a referência.',
    formula: 'Margem % = Margem de contribuição ÷ Receita líquida × 100',
    conta,
    regras: [
      'No período, o % é recalculado sobre os totais (não é a média dos % de cada mês).',
      'Mês sem receita líquida fica sem margem % (—).',
      'Verde quando a margem fica na referência ou acima; vermelho quando fica abaixo.',
      ...regraEscopo(ctx),
      ...regraMesParcial(ctx),
    ],
    detalhe: DETALHE_AREA,
  }
}

/** Cascata completa do período: usada no card Resultado, nas linhas por área e na linha Resultado. */
export function explicarDlResultado(t: DlMesCalculado, ctx: DlFenixContexto, titulo?: string): FenixExplicacao {
  const periodo = periodoDl(ctx.ano, ctx.meses)
  const ref = referencia(ctx)
  return {
    ...base(ctx),
    titulo: titulo ?? `Resultado — ${periodo}`,
    valor: moeda(t.resultado),
    resumo: `Receita ${escopoTexto(ctx)} depois do imposto e de todas as despesas (diretas, controladoria e indiretas) em ${periodo}.`,
    formula: 'Resultado = Receita bruta − Impostos − Desp. operacionais − Desp. controladoria − Desp. indiretas',
    conta: [
      { rotulo: 'Receita bruta', valor: moeda(t.receita_bruta), numero: t.receita_bruta },
      { rotulo: 'Impostos', valor: moeda(t.impostos), numero: t.impostos, operador: '−' },
      { rotulo: 'Desp. operacionais', valor: moeda(t.desp_operacionais), numero: t.desp_operacionais, operador: '−' },
      { rotulo: 'Desp. controladoria', valor: moeda(t.desp_controladoria), numero: t.desp_controladoria, operador: '−' },
      { rotulo: 'Desp. indiretas', valor: moeda(t.desp_indiretas), numero: t.desp_indiretas, operador: '−' },
      linhaTotal('Resultado', t.resultado),
      { rotulo: 'Receita líquida', valor: moeda(t.receita_liquida), numero: t.receita_liquida, tipo: 'info', detalhe: 'bruta − impostos' },
      {
        rotulo: 'Margem de contribuição',
        valor: moeda(t.margem),
        numero: t.margem,
        tipo: 'info',
        detalhe: [
          t.receita_liquida > 0 ? `${formatPercent(t.margem_pct * 100)} da receita líquida` : 'sem receita líquida',
          ref?.texto,
        ]
          .filter(Boolean)
          .join(' · '),
      },
      {
        rotulo: 'DL dos gestores (fora da conta)',
        valor: moeda(t.dl_gestor),
        numero: t.dl_gestor,
        tipo: 'info',
        detalhe: 'não é despesa da área',
      },
    ],
    regras: [
      REGRA_CAIXA,
      REGRA_RECEITA_PLANOS,
      REGRA_IMPOSTO,
      REGRA_DESPESA_AREA,
      REGRA_CONTROLADORIA,
      REGRA_INDIRETAS,
      REGRA_DESPESA_FORA,
      REGRA_DL_NAO_DESPESA,
      ...regraEscopo(ctx),
      ...regraMesParcial(ctx),
    ],
    detalhe: DETALHE_AREA,
  }
}

export function explicarDlProfissionais(
  demo: readonly DlMesCalculado[],
  total: DlMesCalculado,
  ctx: DlFenixContexto,
): FenixExplicacao {
  const periodo = periodoDl(ctx.ano, ctx.meses)
  const comProf = demo.filter((m) => m.profissionais > 0)
  const soma = comProf.reduce((s, m) => s + m.profissionais, 0)
  return {
    ...base(ctx),
    titulo: `Profissionais — ${periodo}`,
    valor: formatarDlTotal('profissionais', total.profissionais),
    resumo: `Média de profissionais por mês ${escopoTexto(ctx)} em ${periodo}. É a base do rateio das despesas indiretas e do custo-hora.`,
    formula: 'Profissionais (média) = soma dos profissionais de cada mês ÷ meses com profissionais',
    conta: [
      ...comProf.map((m, i) => ({
        rotulo: rotuloMes(ctx.ano, m.mes),
        valor: numBr(m.profissionais),
        numero: m.profissionais,
        operador: i === 0 ? undefined : ('+' as const),
        detalhe: m.herdado ? 'herdado do último mês cadastrado' : undefined,
      })),
      { rotulo: 'Soma dos meses', valor: numBr(soma), numero: soma, tipo: 'info' },
      { rotulo: 'Meses com profissionais', valor: String(comProf.length), numero: comProf.length, operador: '÷' },
      linhaTotal('Média do período', total.profissionais, numBr(total.profissionais)),
    ],
    regras: [
      REGRA_PROFISSIONAIS,
      ...(ctx.area ? [] : ['No escritório, cada mês soma os profissionais de todas as áreas.']),
      'Meses sem profissionais cadastrados não entram na média.',
    ],
    detalhe: 'Para mudar os números, use a aba Parâmetros.',
  }
}

export function explicarDlCustoHora(
  demo: readonly DlMesCalculado[],
  t: DlMesCalculado,
  ctx: DlFenixContexto,
): FenixExplicacao {
  const periodo = periodoDl(ctx.ano, ctx.meses)
  const custo = t.desp_operacionais + t.desp_controladoria + t.desp_indiretas
  // Mesma conta de dlCalc: horas de cada mês somadas (profissionais-mês × premissas).
  const profMes = demo.reduce((s, m) => s + m.profissionais, 0)
  const horas = DL_HORAS_DIA * DL_DIAS_MES * profMes * DL_EFICIENCIA
  return {
    ...base(ctx),
    titulo: `Custo hora total — ${periodo}`,
    valor: formatarDlTotal('custo_hora', t.custo_hora),
    resumo: `Quanto custa, em média, cada hora produtiva dos profissionais ${escopoTexto(ctx)}: todas as despesas divididas pelas horas disponíveis no período.`,
    formula: `Custo hora = (operacionais + controladoria + indiretas) ÷ (${DL_HORAS_DIA} h × ${DL_DIAS_MES} dias × ${pctBr(DL_EFICIENCIA * 100)} × profissionais)`,
    conta: [
      {
        rotulo: 'Custo total',
        valor: moeda(custo),
        numero: custo,
        detalhe: `operacionais ${moeda(t.desp_operacionais)} + controladoria ${moeda(t.desp_controladoria)} + indiretas ${moeda(t.desp_indiretas)}`,
      },
      {
        rotulo: 'Horas produtivas',
        valor: `${numBr(horas, 1)} h`,
        numero: horas,
        operador: '÷',
        detalhe: `${DL_HORAS_DIA} h × ${DL_DIAS_MES} dias × ${pctBr(DL_EFICIENCIA * 100)} × ${numBr(profMes)} profissionais-mês (soma dos meses)`,
      },
      linhaTotal('Custo hora total', t.custo_hora, formatarDlTotal('custo_hora', t.custo_hora)),
    ],
    regras: [
      REGRA_HORAS,
      'No período, o custo total é dividido pelas horas somadas de todos os meses (não é a média dos custos-hora mensais).',
      'O imposto e o DL dos gestores não entram no custo.',
      'Sem profissionais cadastrados, não há custo-hora (—).',
      REGRA_PROFISSIONAIS,
      ...regraEscopo(ctx),
      ...regraMesParcial(ctx),
    ],
    detalhe: DETALHE_AREA,
  }
}

/** Card DL Gestores da Visão geral: soma das áreas, com os gestores de cada uma. */
export function explicarDlGestoresResumo(
  porArea: readonly { area: DlFenixArea; dl: number }[],
  total: number,
  ctx: DlFenixContexto,
): FenixExplicacao {
  const periodo = periodoDl(ctx.ano, ctx.meses)
  const gestores = ctx.gestores ?? []
  const linhas = porArea.filter((a) => a.dl !== 0 || gestores.some((g) => g.area_key === a.area.key))
  return {
    ...base(ctx),
    titulo: `DL Gestores — ${periodo}`,
    valor: moeda(total),
    resumo: `Distribuição de lucros dos gestores de todas as áreas em ${periodo}: cada gestor recebe o % dele sobre o resultado da carteira de clientes.`,
    formula: 'DL Gestores = soma do DL de cada gestor, mês a mês',
    conta: [
      ...linhas.map((a, i) => {
        const gs = gestores.filter((g) => g.area_key === a.area.key)
        return {
          rotulo: a.area.nome,
          valor: moeda(a.dl),
          numero: a.dl,
          operador: i === 0 ? undefined : ('+' as const),
          detalhe: gs.length > 0 ? gs.map((g) => `${g.nome} ${pctBr(g.pct)}`).join(' · ') : 'sem gestor com DL cadastrado',
        }
      }),
      linhaTotal('DL Gestores no período', total),
      ...notaCentavos(
        linhas.map((a) => a.dl),
        total,
      ),
    ],
    regras: [REGRA_DL_FORMULA, REGRA_DL_CLIENTE, REGRA_DL_NEGATIVO, REGRA_DL_VIGENCIA, REGRA_DL_NAO_DESPESA, ...regraMesParcial(ctx)],
    fonte: FONTE,
    fonteTecnica: 'Supabase › dl_gestor_mensal (dl_gestores, dl_gestor_clientes, dl_resultado_mensal, financeiro_parcelas_itens)',
    detalhe: 'Para ver mês a mês, abra a aba Por área e clique na linha DL Gestor.',
  }
}
