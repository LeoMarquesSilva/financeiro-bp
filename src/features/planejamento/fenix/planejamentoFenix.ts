/**
 * Fênix no Planejamento 2027: memória de cálculo dos números do módulo.
 * Funções puras (imports com .ts) — recebem os mesmos valores que a tela mostra.
 */
import type { FenixExplicacao, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { AREAS_2027, mesRotulo, soma } from '../utils/areasPlanejamento.ts'
import type { TotaisArea } from '../utils/planejamentoBase.ts'
import type {
  PremissaArea,
  PremissasEscritorio,
  ResultadoArea,
  ResultadoEscritorio,
  ResultadoSimulacao,
} from '../utils/planejamentoCalc.ts'

const TELA = 'Planejamento 2027'

export function moeda(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function pct(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

export const FONTE_RECEITA =
  'Títulos de honorários recebidos no VIOS (regra da Receita: plano de contas de honorários, sem juros, pela data de pagamento).'
export const FONTE_RECEITA_TEC = 'planejamento_receita_mensal → planejamento_receita_itens (financeiro_parcelas_itens)'
export const FONTE_MARGEM_TEC = 'planejamento_margem_mensal (regras do DL: dl_aliquota, opex, legal_ops_rateio_mensal)'

function linhasMes(ano: number, porMes: readonly number[], projetado?: readonly boolean[]): FenixLinha[] {
  return porMes
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v !== 0)
    .map(({ v, i }, idx) => ({
      rotulo: `${mesRotulo(ano, i + 1)}${projetado?.[i] ? ' (Melhor Estimativa)' : ''}`,
      valor: moeda(v),
      numero: v,
      operador: idx === 0 ? undefined : ('+' as const),
    }))
}

export function fenixReceitaAno(i: {
  tela?: string
  titulo: string
  ano: number
  areaNome: string
  porMes: readonly number[]
  projetado?: readonly boolean[]
  meses?: readonly number[]
  /** Ajuste provisório (controle financeiro − VIOS) já incluído em `porMes`. */
  ajuste?: readonly number[] | null
}): FenixExplicacao {
  const meses = i.meses ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const ajuste = i.ajuste ? soma(i.ajuste.map((v, idx) => (meses.includes(idx + 1) ? v : 0))) : 0
  const valores = i.porMes.map((v, idx) => (meses.includes(idx + 1) ? v : 0))
  const total = soma(valores)
  const temMe = (i.projetado ?? []).some((p, idx) => p && meses.includes(idx + 1) && valores[idx] !== 0)
  return {
    tela: i.tela ?? `${TELA} › Receita`,
    titulo: i.titulo,
    valor: moeda(total),
    resumo: `Receita de honorários recebida por ${i.areaNome} em ${i.ano}${temMe ? ', com a Melhor Estimativa nos meses ainda abertos' : ''}.`,
    formula: temMe ? 'Receita = recebido nos meses fechados + Melhor Estimativa dos meses abertos' : 'Receita = soma do recebido nos meses',
    conta: [...linhasMes(i.ano, valores, i.projetado), { rotulo: 'Total', valor: moeda(total), numero: total, operador: '=', tipo: 'total' }],
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Área', valor: i.areaNome },
    ],
    regras: [
      'Base caixa: conta pela data de pagamento.',
      'Juros e encargos de atraso ficam fora (por isso pode diferir alguns reais do DL).',
      ...(temMe
        ? ['Meses abertos usam a Melhor Estimativa da área (caixa do mês + carteira em aberto + novas receitas com chance alta/média).']
        : []),
      ...(i.ano === 2025
        ? ['Em 2025, títulos lançados em Facilities, Financeiro ou BP entram na área escolhida na classificação por cliente.']
        : []),
      ...(i.ajuste
        ? [
            `Provisório: inclui ${moeda(ajuste)} de ajuste do controle financeiro (o VIOS ainda não tem toda a receita de ${i.ano}). O total do escritório por mês é o do controle; a diferença foi para a área de cada recebimento.`,
          ]
        : []),
    ],
    fonte: FONTE_RECEITA,
    fonteTecnica: FONTE_RECEITA_TEC,
  }
}

export function fenixCrescimento(i: {
  titulo: string
  areaNome: string
  anterior: number
  atual: number
  rotuloAnterior: string
  rotuloAtual: string
}): FenixExplicacao {
  const v = i.anterior ? ((i.atual - i.anterior) / Math.abs(i.anterior)) * 100 : null
  return {
    tela: `${TELA} › Receita › Crescimento por área`,
    titulo: i.titulo,
    valor: pct(v),
    resumo: `Quanto a receita de ${i.areaNome} cresceu de ${i.rotuloAnterior} para ${i.rotuloAtual}.`,
    formula: 'Crescimento = (atual − anterior) ÷ anterior × 100',
    conta: [
      { rotulo: i.rotuloAtual, valor: moeda(i.atual), numero: i.atual },
      { rotulo: i.rotuloAnterior, valor: moeda(i.anterior), numero: i.anterior, operador: '−' },
      { rotulo: 'Diferença', valor: moeda(i.atual - i.anterior), numero: i.atual - i.anterior, operador: '=' },
      { rotulo: 'Crescimento', valor: pct(v), numero: v ?? undefined, operador: '÷', tipo: 'total', detalhe: `÷ ${moeda(i.anterior)}` },
    ],
    regras: v == null ? ['Sem receita no período anterior: a área não existia ou não tinha receita.'] : [],
    fonte: FONTE_RECEITA,
    fonteTecnica: FONTE_RECEITA_TEC,
  }
}

export function fenixMargem(i: {
  titulo: string
  areaNome: string
  ano: number
  periodo: string
  t: TotaisArea
  impostoEstimado: boolean
  avisos: string[]
}): FenixExplicacao {
  const { t } = i
  return {
    tela: `${TELA} › Margem de contribuição`,
    titulo: i.titulo,
    valor: moeda(t.margem),
    resumo: `Quanto ${i.areaNome} sobrou para pagar a estrutura do escritório em ${i.periodo}, depois do imposto, das próprias despesas e do rateio da Controladoria.`,
    formula: 'Margem = receita − imposto − pessoas − demais despesas da área − Controladoria; Margem % = margem ÷ receita líquida',
    conta: [
      { rotulo: 'Receita bruta', valor: moeda(t.receita), numero: t.receita },
      {
        rotulo: i.impostoEstimado ? 'Imposto (estimado pela taxa efetiva de 2026)' : 'Imposto (alíquota do DL × receita com NF)',
        valor: moeda(t.impostos),
        numero: t.impostos,
        operador: '−',
      },
      { rotulo: 'Receita líquida', valor: moeda(t.liquida), numero: t.liquida, operador: '=', tipo: 'total' },
      { rotulo: 'Pessoas da área', valor: moeda(t.pessoas), numero: t.pessoas, operador: '−' },
      { rotulo: 'Demais despesas da área', valor: moeda(t.demais), numero: t.demais, operador: '−' },
      { rotulo: 'Rateio da Controladoria (Ops Legais)', valor: moeda(t.controladoria), numero: t.controladoria, operador: '−' },
      { rotulo: 'Margem de contribuição', valor: moeda(t.margem), numero: t.margem, operador: '=', tipo: 'total' },
      { rotulo: 'Margem %', valor: pct(t.margemPct), numero: t.margemPct ?? undefined, tipo: 'info', detalhe: 'margem ÷ receita líquida' },
    ],
    filtros: [
      { rotulo: 'Ano', valor: String(i.ano) },
      { rotulo: 'Período', valor: i.periodo },
      { rotulo: 'Área', valor: i.areaNome },
    ],
    regras: [
      'Mesmas regras do módulo DL: despesas pelo departamento do VIOS (sem impostos sobre faturamento) e Controladoria = OPEX de Operações Legais × % de horas da Ops na área.',
      ...i.avisos,
    ],
    fonte: 'VIOS (títulos pagos e recebidos) e Fechamento Legal Ops (rateio da Controladoria).',
    fonteTecnica: FONTE_MARGEM_TEC,
  }
}

export function fenixMetaEscritorio(i: { resultado: ResultadoSimulacao; crescimentoPct: number | null }): FenixExplicacao {
  const d = i.resultado.desdobramento
  const esc = i.resultado.escritorio
  const fixadas = AREAS_2027.filter((a) => !i.resultado.areas[a.key].automatico)
  const conta: FenixLinha[] = [
    { rotulo: 'Receita 2026 de todas as áreas (realizado + ME)', valor: moeda(d.receitaBase), numero: d.receitaBase },
  ]
  if (d.metaReceita != null) {
    conta.push({ rotulo: `Meta de crescimento ${pct(i.crescimentoPct)}`, valor: moeda(d.metaReceita - d.receitaBase), operador: '+' })
    conta.push({ rotulo: 'Meta de receita 2027', valor: moeda(d.metaReceita), numero: d.metaReceita, operador: '=', tipo: 'total' })
  }
  for (const a of AREAS_2027) {
    const ra = i.resultado.areas[a.key]
    conta.push({
      rotulo: `${a.nome} (${pct(ra.crescimentoOrganicoPct)}${ra.automatico ? ', automático' : ', fixado'})`,
      valor: moeda(ra.receitaAno),
      tipo: 'info',
    })
  }
  conta.push({ rotulo: 'Soma das áreas', valor: moeda(esc.receitaAno), numero: esc.receitaAno, tipo: 'total' })
  return {
    tela: `${TELA} › Metas 2027`,
    titulo: 'Meta de crescimento da receita 2027',
    valor: d.metaReceita == null ? moeda(esc.receitaAno) : moeda(d.metaReceita),
    resumo:
      d.metaReceita == null
        ? 'Cenário sem meta do escritório: a receita 2027 é a soma das metas das áreas.'
        : 'Meta do escritório desdobrada nas áreas: as áreas com % fixado ficam com ele; as automáticas crescem o mesmo % para a soma bater a meta.',
    formula:
      'Meta = receita 2026 × (1 + crescimento %); automático = (meta − metas fixadas − receita nova das automáticas) ÷ receita 2026 das automáticas − 1',
    conta,
    regras: [
      d.areasAutomaticas.length
        ? `Áreas no automático crescem ${pct(d.crescimentoAutomaticoPct)}.`
        : 'Nenhuma área no automático: a soma das áreas pode não bater a meta.',
      ...(fixadas.length ? [`Áreas com % fixado: ${fixadas.map((a) => a.nome).join(', ')}.`] : []),
      ...(Math.abs(d.diferenca) >= 1 ? [`Diferença entre a soma das áreas e a meta: ${moeda(d.diferenca)}.`] : []),
      'A receita 2026 inclui as áreas encerradas (Distressed Deals); em 2027 elas não têm receita, então as outras áreas cobrem esse valor.',
    ],
    fonte: 'Base 2026 do planejamento e premissas do cenário.',
    fonteTecnica: 'src/features/planejamento/utils/planejamentoCalc.ts (desdobrarCrescimento)',
  }
}

export function fenixSimulacaoArea(i: {
  areaNome: string
  p: PremissaArea
  e: PremissasEscritorio
  r: ResultadoArea
}): FenixExplicacao {
  const { p, e, r } = i
  const pessoas = soma(r.pessoas)
  const contrat = soma(r.contratacoes)
  return {
    tela: `${TELA} › Metas 2027`,
    titulo: `Meta de receita 2027 — ${i.areaNome}`,
    valor: moeda(r.receitaAno),
    resumo: `Meta de receita de ${i.areaNome} para 2027 a partir de 2026 (realizado + Melhor Estimativa) e das premissas do cenário.`,
    formula: 'Meta 2027 = receita 2026 × (1 + crescimento %) + receita nova',
    conta: [
      { rotulo: 'Receita 2026 (realizado + ME)', valor: moeda(r.receitaBaseAno), numero: r.receitaBaseAno },
      {
        rotulo: `Crescimento ${pct(r.crescimentoOrganicoPct)}${r.automatico ? ' (automático)' : ''}`,
        valor: moeda(r.receitaBaseAno * ((r.crescimentoOrganicoPct ?? 0) / 100)),
        operador: '+',
      },
      { rotulo: 'Receita nova', valor: moeda(p.receitaNova), numero: p.receitaNova, operador: '+' },
      { rotulo: 'Meta de receita 2027', valor: moeda(r.receitaAno), numero: r.receitaAno, operador: '=', tipo: 'total' },
      { rotulo: `Imposto (${pct(e.aliquotaPct, 2)})`, valor: moeda(soma(r.impostos)), operador: '−' },
      {
        rotulo: 'Pessoas (com reajuste, ajustes e contratações)',
        valor: moeda(pessoas),
        operador: '−',
        detalhe: contrat ? `inclui ${moeda(contrat)} de contratações` : undefined,
      },
      { rotulo: 'Demais despesas', valor: moeda(soma(r.demais)), operador: '−' },
      { rotulo: 'Controladoria', valor: moeda(soma(r.controladoria)), operador: '−' },
      { rotulo: 'Margem 2027', valor: moeda(r.margemAno), numero: r.margemAno, operador: '=', tipo: 'total' },
    ],
    regras: [
      r.automatico
        ? 'Crescimento automático: as áreas sem % fixado crescem o mesmo %, calculado para a soma das áreas bater a meta de crescimento do escritório.'
        : 'Crescimento fixado na área.',
      e.distribuicao === 'sazonal'
        ? 'Distribuição mensal pela sazonalidade da receita 2026 da área (peso de cada mês no ano).'
        : 'Distribuição mensal linear (1/12 por mês).',
      `Reajuste salarial da equipe atual de ${pct(e.reajustePct)} a partir de ${mesRotulo(2027, e.mesReajuste)}.`,
      ...(p.contratacoes.length
        ? p.contratacoes.map(
            (c) =>
              `Contratação: ${c.qtd} × ${c.descricao || 'pessoa'} de ${moeda(c.custoMensal)}/mês a partir de ${mesRotulo(2027, c.mesInicio)}.`,
          )
        : ['Sem contratações previstas.']),
    ],
    fonte: 'Base 2026 do planejamento e premissas do cenário.',
    fonteTecnica: 'src/features/planejamento/utils/planejamentoCalc.ts (simular)',
  }
}

export function fenixResultadoEscritorio(i: { r: ResultadoEscritorio; e: PremissasEscritorio }): FenixExplicacao {
  const { r, e } = i
  return {
    tela: `${TELA} › Metas 2027`,
    titulo: 'Resultado do escritório 2027',
    valor: moeda(r.resultadoAno),
    resumo: 'Soma das margens das áreas menos a estrutura (Facilities, Financeiro, Marketing, RH, TI e Comercial) e a Controladoria que não foi rateada.',
    formula: 'Resultado = Σ margens − estrutura − Controladoria não rateada',
    conta: [
      { rotulo: 'Σ margens das áreas', valor: moeda(r.margemAno), numero: r.margemAno },
      { rotulo: `Estrutura (${pct(e.variacaoEstruturaPct)} sobre 2026)`, valor: moeda(soma(r.estrutura)), operador: '−' },
      { rotulo: 'Controladoria não rateada', valor: moeda(soma(r.controladoriaNaoRateada)), operador: '−' },
      { rotulo: 'Resultado', valor: moeda(r.resultadoAno), numero: r.resultadoAno, operador: '=', tipo: 'total' },
      {
        rotulo: `Faturamento necessário (inadimplência ${pct(e.inadimplenciaMetaPct)})`,
        valor: moeda(r.faturamentoNecessarioAno),
        tipo: 'info',
        detalhe: 'receita ÷ (1 − inadimplência)',
      },
    ],
    regras: ['Sócios (pró-labore) e distribuição de lucros ficam fora do resultado.'],
    fonteTecnica: 'src/features/planejamento/utils/planejamentoCalc.ts (simular)',
  }
}

export function fenixValor(i: {
  tela: string
  titulo: string
  valor: string
  resumo: string
  formula?: string
  conta?: FenixLinha[]
  regras?: string[]
  fonte?: string
  fonteTecnica?: string
}): FenixExplicacao {
  return { ...i, tela: `${TELA} › ${i.tela}` }
}
