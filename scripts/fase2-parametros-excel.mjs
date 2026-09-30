/**
 * Gera o Excel editável da Fase 2 (parâmetros, perímetro, classificação).
 * Eixo: competência jan–ago/2026 (último mês fechado em 23/09/2026). Caixa no mesmo recorte, para conciliação.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const INICIO = '2026-01-01'
const FIM = '2026-09-01' // exclusivo: até ago/2026
const JANELA_12M = '2025-09-01'
const OUT = path.resolve('docs/fase-2-parametros-classificacao-opex.xlsx')

const TRIBUTOS = new Set(['2.2.06.002', '2.2.06.001', '3.3.01.000', '2.2.06.003', '2.2.06.000'])
const PROCESSUAIS = ['2.6.01.005', '2.6.01', '2.6.03', '5.6.02', '5.16.06', '5.16.07']
const COMISSOES = new Set(['4.1.01.000', '4.1.02.000', '2.3.07.000'])
const BANCO = new Set(['5.18.01.000', '5.18.02.000', '5.18.04.000', '5.18.05.000'])
const SOCIOS_CAPITAL = new Set(['8.1.03.000', '2.4.01.000', '2.4.02.000', '7.1.01.000', '7.1.02.000'])

const KEYWORDS = [
  ['rescis', 'rescisão'],
  ['implanta', 'implantação'],
  ['multa', 'multa'],
  ['obra', 'obra'],
  ['indeniz', 'indenização'],
  ['deslig', 'desligamento'],
]

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function absVal(v) {
  return round2(Math.abs(Number(v) || 0))
}

function mesDe(iso) {
  if (!iso) return ''
  return String(iso).slice(0, 7)
}

function noPeriodo(iso) {
  if (!iso) return false
  const d = String(iso).slice(0, 10)
  return d >= INICIO && d < FIM
}

function fornecedorDe(row) {
  const a = String(row.terceiros_item ?? '').trim()
  const b = String(row.terceiro_titulo ?? '').trim()
  const c = String(row.cliente ?? '').trim()
  return a || b || c || '—'
}

function prefixo(conta, prefixos) {
  return prefixos.some((p) => String(conta || '').startsWith(p))
}

function guiaPorDescricao(row) {
  const d = norm(`${row.descricao || ''} ${row.plano_contas || ''}`)
  const hits = []
  if (/(^|[^A-Z])DAS([^A-Z]|$)/.test(d)) hits.push('DAS')
  if (d.includes('DARF')) hits.push('DARF')
  if (d.includes('ISSQN')) hits.push('ISSQN')
  if (d.includes('SIMPLES NACIONAL') || d.includes('PARCELAMENTO PGFN')) hits.push('parcelamento')
  return hits
}

async function paginar(build) {
  const page = 1000
  const all = []
  let from = 0
  while (true) {
    const { data, error } = await build(from, from + page - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if ((data ?? []).length < page) break
    from += page
  }
  return all
}

const COLS = [
  'ci_item',
  'ci_titulo',
  'nro_titulo',
  'descricao',
  'terceiros_item',
  'terceiro_titulo',
  'cliente',
  'departamento',
  'grupo_conta',
  'plano_contas',
  'conta_numero',
  'competencia_titulo',
  'data_vencimento',
  'data_pagamento',
  'valor_item',
  'valor_fluxo_item',
  'valor_pago_item',
  'situacao_titulo',
].join(',')

function perimetro(row) {
  const conta = String(row.conta_numero ?? '').trim()
  const dep = String(row.departamento ?? '').trim()
  const g = norm(row.grupo_conta)
  if (dep === 'Conta Corrente Clientes') {
    return {
      dentro: 'não',
      motivo: 'Despesas reembolsáveis de clientes',
      status: 'confirmada',
      flag: 'departamento_conta_corrente_clientes',
    }
  }
  if (conta.startsWith('2.6.04')) {
    return { dentro: 'não', motivo: 'Repasse ao cliente (2.6.04)', status: 'confirmada', flag: 'repasse' }
  }
  if (conta.startsWith('3.2.07')) {
    return {
      dentro: 'não',
      motivo: 'Repasse ao cliente (3.2.07 REPASSE DE OUTRAS RECEITAS; 2.6.04 sem movimento no período)',
      status: 'confirmada',
      flag: 'repasse',
    }
  }
  if (SOCIOS_CAPITAL.has(conta) || g === 'SOCIOS' || g.includes('DISTRIBUICAO DE LUCROS')) {
    return {
      dentro: 'não',
      motivo: 'Remuneração de sócios de capital',
      status: 'confirmada',
      flag: 'abaixo_do_resultado_operacional',
    }
  }
  if (conta.startsWith('10.') || g === 'INVESTIMENTOS') {
    return { dentro: 'não', motivo: 'Investimento / CAPEX', status: 'confirmada', flag: '' }
  }
  if (conta.startsWith('3.4') || g.includes('DEDUCOES DA RECEITA')) {
    return { dentro: 'não', motivo: 'Dedução da receita', status: 'confirmada', flag: '' }
  }
  if (TRIBUTOS.has(conta)) {
    return {
      dentro: 'não',
      motivo: 'Deduções / tributos sobre faturamento',
      status: 'confirmada',
      flag: 'composicao_pendente',
    }
  }
  const guia = guiaPorDescricao(row)
  const contextoTributo = /IMPOSTO|TRIBUT|DAS|DARF|ISSQN/.test(`${norm(row.plano_contas)} ${norm(row.grupo_conta)}`)
  if (guia.length && contextoTributo) {
    return {
      dentro: 'não',
      motivo: 'Deduções / tributos sobre faturamento',
      status: 'sugerida',
      flag: `composicao_pendente;lancado_em_${conta || 'sem_conta'}_descricao_${guia.join('_')}`,
    }
  }
  if (conta.startsWith('5.18.03')) {
    return { dentro: 'não', motivo: 'Multas e juros', status: 'confirmada', flag: '' }
  }
  if (conta.startsWith('1.1.02') || conta.startsWith('1.1.08') || conta.startsWith('1.1.03') || g.includes('EMPRESTIMOS')) {
    return {
      dentro: 'não',
      motivo: 'Adiantamento ou transferência (não é despesa operacional)',
      status: 'sugerida',
      flag: '',
    }
  }
  return { dentro: 'sim', motivo: '', status: 'confirmada', flag: '' }
}

function pessoas(subgrupo, natureza, controlabilidade, potencial) {
  return {
    grupo_gerencial: 'Pessoas',
    subgrupo,
    natureza,
    controlabilidade,
    tipo: 'despesa',
    potencial,
    status: 'sugerida',
  }
}

function bloco(grupo, subgrupo, natureza, controlabilidade, potencial, status = 'sugerida', tipo = 'despesa') {
  return { grupo_gerencial: grupo, subgrupo, natureza, controlabilidade, tipo, potencial, status }
}

function classificar(row, peri) {
  const conta = String(row.conta_numero ?? '').trim()
  const g = norm(row.grupo_conta)
  const p = norm(row.plano_contas)
  if (peri.dentro === 'não') {
    const grupoExc =
      peri.motivo.startsWith('Despesas reembolsáveis')
        ? 'Despesas reembolsáveis de clientes'
        : peri.motivo.startsWith('Repasse')
          ? 'Repasse ao cliente'
          : peri.motivo.startsWith('Remuneração')
            ? 'Remuneração de sócios de capital'
            : peri.motivo.startsWith('Deduções')
              ? 'Deduções / tributos sobre faturamento'
              : peri.motivo.startsWith('Investimento')
                ? 'Investimento / CAPEX'
                : peri.motivo.startsWith('Multas')
                  ? 'Multas e juros'
                  : peri.motivo.startsWith('Dedução')
                    ? 'Deduções da receita'
                    : 'Fora do OPEX'
    return bloco(grupoExc, peri.motivo, '—', '—', 'não avaliado', peri.status, peri.motivo.startsWith('Investimento') ? 'investimento' : 'exclusão')
  }
  if (COMISSOES.has(conta) || p.includes('COMISS')) {
    return bloco('Comissões', 'Comissões', 'variável', 'decisão interna', 'médio', 'confirmada')
  }
  if (BANCO.has(conta)) {
    return bloco('Administrativo e Financeiro', 'Custos bancários e de cobrança', 'semivariável', 'contratual', 'baixo', 'confirmada')
  }
  if (prefixo(conta, PROCESSUAIS)) {
    const c = bloco('Despesas Processuais', 'Custas e despesas processuais', 'variável', 'obrigação legal', 'baixo', 'confirmada')
    c.flagExtra = 'processual_possivelmente_reembolsavel'
    return c
  }
  if (conta === '8.1.02.000' || p === 'SALARIOS') return pessoas('CLT', 'fixa', 'contratual', 'médio')
  if (conta === '8.1.01.000' || p.includes('ASSOCIADOS') && g.includes('REMUNERACAO FIXA')) {
    return pessoas('Associados', 'fixa', 'contratual', 'médio')
  }
  if (g.includes('ESTAGI') || p.includes('ESTAGI')) return pessoas('Estagiários', 'fixa', 'contratual', 'médio')
  if (g.includes('BENEFIC') || (g.includes('DESPESAS COM PESSOAL') && p.includes('BENEF'))) {
    return pessoas('Benefícios', 'fixa', 'contratual', 'médio')
  }
  if (g.includes('ENCARGOS') || (g.includes('DESPESAS COM PESSOAL') && p.includes('TRIBUT')) || g.includes('GASTOS GERAIS COM PESSOAL')) {
    return pessoas('Encargos', 'fixa', 'obrigação legal', 'baixo')
  }
  if (p.includes('BONUS') || p.includes('GRATIFIC')) return pessoas('Bônus', 'variável', 'decisão interna', 'médio')
  if (p.includes('13') || p.includes('FERIAS')) return pessoas('13º e férias', 'semivariável', 'obrigação legal', 'baixo')
  if (g.includes('TREINAMENTO')) return pessoas('Treinamento', 'variável', 'decisão interna', 'alto')
  if (g.includes('RECRUTAMENTO') || g.includes('OUTROS CUSTOS COM PESSOAS')) {
    return pessoas('Recrutamento e reconhecimento', 'variável', 'decisão interna', 'alto')
  }
  if (g.includes('DESLIG')) return pessoas('Desligamentos', 'variável', 'obrigação legal', 'baixo')
  if (g.includes('REMUNERACAO FIXA')) return pessoas('Associados', 'fixa', 'contratual', 'médio')
  if (g.includes('REMUNERACAO VARIAVEL')) return pessoas('Bônus', 'variável', 'decisão interna', 'médio')
  if (g.includes('DESPESAS COM PESSOAL') && p.includes('REEMBOLSO')) {
    return pessoas('Reembolso de pessoal', 'variável', 'decisão interna', 'médio')
  }
  if (g.includes('ALUGUE')) return bloco('Ocupação/Facilities', 'Aluguel', 'fixa', 'contratual', 'baixo')
  if (g.includes('INFRAESTRUTURA')) return bloco('Ocupação/Facilities', 'Infraestrutura', 'fixa', 'contratual', 'baixo')
  if (g.includes('MANUTENCAO') || p.includes('MANUTENCAO') || p.includes('PAISAGISMO')) {
    return bloco('Ocupação/Facilities', 'Manutenção', 'semivariável', 'decisão interna', 'médio')
  }
  if (g.includes('COPA') || p.includes('LIMPEZA') || p.includes('DIARISTA') || p.includes('HIGIENE') || p.includes('DECORACAO')) {
    return bloco('Ocupação/Facilities', 'Copa, limpeza e consumo', 'semivariável', 'decisão interna', 'médio')
  }
  if (g.includes('IMPOSTOS, TAXAS') || g.includes('IMPOSTOS TAXAS')) {
    return bloco('Ocupação/Facilities', 'Taxas e seguros do escritório', 'fixa', 'obrigação legal', 'baixo')
  }
  if (p.includes('MARKETING') || g.includes('PROPAGANDA') || g.includes('MARKETING')) {
    return bloco('Marketing e Desenvolvimento de Negócios', 'Marketing', 'variável', 'decisão interna', 'alto')
  }
  if (g.includes('TECNOLOGIA') || g.includes('T.I') || p.includes('SOFTWARE') || p.includes('INFORMATICA') || p.includes('SISTEMA')) {
    return bloco('Tecnologia e Sistemas', 'Sistemas e informática', 'fixa', 'contratual', 'médio')
  }
  if (g.includes('VIAGEM') || g.includes('LOCOMOCAO')) {
    return bloco('Viagens e Deslocamentos', 'Viagens', 'variável', 'decisão interna', 'alto')
  }
  if (g.includes('TERCEIRO') || p.includes('CONSULTORIA') || p.includes('CONTABEIS') || p.includes('CORRESPONDENTE') || p.includes('GRAFICA') || p.includes('CERTIFICADO')) {
    return bloco('Serviços Terceirizados', 'Serviços de terceiros', 'semivariável', 'contratual', 'alto')
  }
  if (p.includes('CORREIOS') || p.includes('MOTOBOY')) {
    return bloco('Administrativo Geral', 'Expedição', 'semivariável', 'decisão interna', 'médio')
  }
  if (g.includes('MATERIAL DE CONSUMO') || p.includes('ESCRITORIO') || p.includes('BRINDE')) {
    return bloco('Administrativo Geral', 'Materiais', 'semivariável', 'decisão interna', 'médio')
  }
  if (g.includes('ADMINISTRATIV') || g.includes('DESPESAS DA SEDE') || g.includes('OUTRAS DESPESAS') || g.includes('JURIDICAS') || g.includes('FINANCEIR')) {
    return bloco('Administrativo Geral', p || 'Geral', 'semivariável', 'decisão interna', 'médio')
  }
  return bloco('Outros', p || 'Não classificado', 'semivariável', 'decisão interna', 'não avaliado')
}

function mediana(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function keywordMotivo(texto) {
  const t = norm(texto)
  const hits = KEYWORDS.filter(([k]) => t.includes(norm(k))).map(([, label]) => label)
  return hits
}

function estiloCabecalho(ws, nCols) {
  const row = ws.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  row.alignment = { vertical: 'middle', wrapText: true }
  row.height = 30
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: nCols } }
  ws.getColumn(1).width = 28
}

function moeda(col) {
  col.numFmt = '"R$" #,##0.00'
}

async function main() {
  const pagarComp = await paginar((from, to) =>
    supabase
      .from('financeiro_parcelas_itens')
      .select(COLS)
      .eq('tipo', 'PAGAR')
      .gte('competencia_titulo', INICIO)
      .lt('competencia_titulo', FIM)
      .order('ci_item', { ascending: true })
      .range(from, to),
  )
  const pagarCaixa = await paginar((from, to) =>
    supabase
      .from('financeiro_parcelas_itens')
      .select(COLS)
      .eq('tipo', 'PAGAR')
      .gte('data_pagamento', INICIO)
      .lt('data_pagamento', FIM)
      .order('ci_item', { ascending: true })
      .range(from, to),
  )
  const hist = await paginar((from, to) =>
    supabase
      .from('financeiro_parcelas_itens')
      .select('ci_item,conta_numero,terceiros_item,terceiro_titulo,cliente,competencia_titulo,valor_item')
      .eq('tipo', 'PAGAR')
      .gte('competencia_titulo', JANELA_12M)
      .lt('competencia_titulo', FIM)
      .order('ci_item', { ascending: true })
      .range(from, to),
  )
  const receber = await paginar((from, to) =>
    supabase
      .from('financeiro_parcelas_itens')
      .select(COLS)
      .eq('tipo', 'RECEBER')
      .gte('competencia_titulo', INICIO)
      .lt('competencia_titulo', FIM)
      .order('ci_item', { ascending: true })
      .range(from, to),
  )
  const receberCaixa = await paginar((from, to) =>
    supabase
      .from('financeiro_parcelas_itens')
      .select('ci_item,departamento,plano_contas,conta_numero,data_pagamento,valor_pago_item,descricao,grupo_conta')
      .eq('tipo', 'RECEBER')
      .gte('data_pagamento', INICIO)
      .lt('data_pagamento', FIM)
      .order('ci_item', { ascending: true })
      .range(from, to),
  )
  const orcamento = await paginar((from, to) =>
    supabase
      .from('opex_orcamento_linha')
      .select('ano,mes,grupo_conta,plano_contas,conta_numero,titulo_ref,descricao,departamento,valor,fixo')
      .eq('ano', 2026)
      .lte('mes', 8)
      .order('id', { ascending: true })
      .range(from, to),
  )
  const { data: colaboradores, error: errCol } = await supabase
    .from('colaboradores')
    .select('full_name,cargo,area,is_active,nivel_hierarquico')
    .eq('is_active', true)
  if (errCol) throw new Error(errCol.message)

  const porCi = new Map()
  for (const row of [...pagarComp, ...pagarCaixa]) porCi.set(row.ci_item, row)
  const itens = [...porCi.values()]

  const freqFornecedor = new Map()
  const valoresConta12m = new Map()
  for (const row of hist) {
    const forn = norm(fornecedorDe(row))
    const conta = String(row.conta_numero ?? '')
    const chave = `${conta}|${forn}`
    freqFornecedor.set(chave, (freqFornecedor.get(chave) || 0) + 1)
    const lista = valoresConta12m.get(conta) || []
    lista.push(absVal(row.valor_item))
    valoresConta12m.set(conta, lista)
  }

  const linhas = itens.map((row) => {
    const peri = perimetro(row)
    const cls = classificar(row, peri)
    const flagExtraConta =
      String(row.conta_numero ?? '') === '5.14.03.000' && peri.dentro === 'sim'
        ? 'revisar_se_e_tributo_sobre_faturamento'
        : ''
    const flag = [peri.flag, cls.flagExtra, flagExtraConta].filter(Boolean).join('; ')
    const valorComp = noPeriodo(row.competencia_titulo) ? absVal(row.valor_item ?? row.valor_fluxo_item) : 0
    const valorCaixa = noPeriodo(row.data_pagamento) ? absVal(row.valor_pago_item) : 0
    const forn = fornecedorDe(row)
    const chaveForn = `${String(row.conta_numero ?? '')}|${norm(forn)}`
    const repeticoes = freqFornecedor.get(chaveForn) || 0
    const serie = valoresConta12m.get(String(row.conta_numero ?? '')) || []
    const med = mediana(serie.filter((v) => v > 0))
    const motivos = []
    const kw = keywordMotivo(`${row.descricao || ''} ${row.plano_contas || ''}`)
    if (kw.length) motivos.push(`palavra: ${kw.join(', ')}`)
    if (repeticoes === 1 && valorComp >= 1000) motivos.push('fornecedor sem outra ocorrência na conta em 12 meses')
    if (serie.length >= 6 && med > 0 && valorComp > round2(med * 3) && valorComp >= 1000) {
      motivos.push(`valor atípico (acima de 3x a mediana da conta em 12 meses, mediana ${med})`)
    }
    const sugeridoNao = motivos.length > 0
    return {
      row,
      forn,
      valorComp,
      valorCaixa,
      peri,
      cls,
      flag,
      recorrente: sugeridoNao ? 'não' : 'sim',
      motivoRec: motivos.join('; '),
      statusRec: sugeridoNao ? 'sugerido' : 'sem sinal',
    }
  })

  const totalComp = round2(linhas.reduce((s, l) => s + l.valorComp, 0))
  const opexComp = round2(linhas.filter((l) => l.peri.dentro === 'sim').reduce((s, l) => s + l.valorComp, 0))
  const foraComp = round2(totalComp - opexComp)
  const outrosComp = round2(
    linhas
      .filter((l) => l.peri.dentro === 'sim' && l.cls.grupo_gerencial === 'Outros')
      .reduce((s, l) => s + l.valorComp, 0),
  )
  const pctOutros = opexComp ? outrosComp / opexComp : 0

  const meses = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']

  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIOE'
  wb.created = new Date()

  const leia = wb.addWorksheet('Leia-me')
  leia.columns = [
    { header: 'Tópico', key: 't', width: 36 },
    { header: 'Conteúdo', key: 'c', width: 110 },
  ]
  estiloCabecalho(leia, 2)
  const notas = [
    ['O que é este arquivo', 'Configuração e classificação da Fase 2. Nada aqui é o indicador final. Os limiares de materialidade estão em branco para você preencher.'],
    ['Período', '2026-01 a 2026-08. Agosto é o último mês fechado em 23/09/2026. Edite em Configuracao; os números desta geração usam esse recorte.'],
    ['Regime', 'Eixo = competência (competencia_titulo, valor do item). Caixa (data_pagamento, valor pago) entra na conciliação. Os dois estão calculados.'],
    ['Referência 2026', 'Não é orçamento aprovado. Referência montada em jul/2026 a partir do realizado até ago. Aba Referencia_2026.'],
    ['Sócios de capital', 'Pró-labore 8.1.03, contas nominais de sócios e distribuição de lucros ficam FORA do OPEX, na linha Remuneração de sócios de capital, abaixo do resultado operacional. Associados (8.1.01) e sócios de serviço permanecem em Pessoas.'],
    ['Reembolso', 'PAGAR com departamento Conta Corrente Clientes sai do OPEX. Custas 5.6.02, 2.6.01, 2.6.01.005, 2.6.03, 5.16.06 e 5.16.07 em qualquer outro departamento ficam no OPEX, grupo Despesas Processuais, com flag.'],
    ['Repasse', '2.6.04.000 está fora do OPEX e não teve movimento no período. O repasse efetivo está em 3.2.07.000 (REPASSE DE OUTRAS RECEITAS), também fora. A entrada correspondente no RECEBER está documentada na aba Repasse.'],
    ['Tributos', 'DAS 2.2.06.002, DARF 2.2.06.001, ISS 3.3.01.000, ISSQN 2.2.06.003 e Tributos 2.2.06.000 saem do OPEX. No período essas contas estão zeradas, exceto ISS (R$ 209,13). O DAS, o parcelamento do Simples e o PGFN foram lançados na 5.14.03 e saíram do OPEX com status sugerida e flag composição pendente. Anuidade e demais linhas da 5.14.03 permanecem no OPEX, com flag para revisão.'],
    ['Financeiras', '5.18.01, 5.18.02, 5.18.04 e 5.18.05 ficam no OPEX (Administrativo e Financeiro / Custos bancários e de cobrança). 5.18.03 multas e juros fica fora.'],
    ['Como editar', 'Na aba Lancamentos, preencha override_dentro_opex ou override_recorrente. A coluna final e a Reconciliacao em fórmula acompanham o override. A classificação sugerida está na aba Classificacao_contas.'],
    ['Materialidade', 'Um item só é material se o valor E o percentual sobre o OPEX de competência atingirem os dois limiares. Enquanto estiverem vazios, a coluna fica "aguardando limiar".'],
    ['Alerta Outros', pctOutros > 0.05 ? `ALERTA: Outros = ${(pctOutros * 100).toFixed(2).replace('.', ',')}% do OPEX de competência, acima de 5%.` : `Outros = ${(pctOutros * 100).toFixed(2).replace('.', ',')}% do OPEX de competência, dentro do limite de 5%.`],
    ['13º e férias', 'provisionar_13_ferias = sim. A aba Provisao_13_ferias mostra o lançado e uma provisão sugerida (soma do período / 8). A base não é folha individual, porque o cadastro não tem custo por pessoa.'],
  ]
  for (const [t, c] of notas) leia.addRow({ t, c })
  leia.getColumn(2).alignment = { wrapText: true, vertical: 'top' }

  const cfg = wb.addWorksheet('Configuracao')
  cfg.columns = [
    { header: 'parametro', key: 'p', width: 36 },
    { header: 'valor', key: 'v', width: 42 },
    { header: 'opcoes_ou_nota', key: 'n', width: 88 },
  ]
  estiloCabecalho(cfg, 3)
  const params = [
    ['periodo_inicio', '2026-01', 'editável'],
    ['periodo_fim', '2026-08', 'último mês fechado em 23/09/2026'],
    ['regime_eixo', 'competencia', 'competencia | caixa'],
    ['regime_conciliacao', 'caixa', 'o outro regime, para bater caixa e competência'],
    ['calcular_ambos', 'sim', 'os dois regimes estão nas colunas valor_competencia e valor_caixa'],
    ['receita_referencia', 'liquida_faturada', 'liquida_faturada (eficiência) | recebida (só leitura de caixa)'],
    ['tratamento_socios', 'fora_do_opex', 'fora_do_opex | dentro_do_opex'],
    ['limiar_materialidade_valor', null, 'R$. Preencher. Item material só se valor E percentual passarem.'],
    ['limiar_materialidade_pct', null, 'Percentual sobre o OPEX de competência do período. Ex.: 1 para 1%.'],
    ['peso_fte_estagiario', 0.75, 'usado na aba Pessoas_fte'],
    ['meses_run_rate', 3, 'parâmetro para a fase de cálculo; ainda não aplicado a um indicador'],
    ['provisionar_13_ferias', 'sim', 'ver aba Provisao_13_ferias'],
    ['nome_orcamento', 'Referência 2026', 'não é orçamento aprovado'],
    ['nota_orcamento', 'referência montada em jul/2026 a partir do realizado até ago', 'usar este texto em qualquer saída'],
  ]
  for (const [p, v, n] of params) cfg.addRow({ p, v, n })
  cfg.getCell('B9').numFmt = '"R$" #,##0.00'
  cfg.getCell('B10').numFmt = '0.00"%"'

  const exc = wb.addWorksheet('Exclusoes')
  exc.columns = [
    { header: 'regra', key: 'r', width: 42 },
    { header: 'chave', key: 'c', width: 28 },
    { header: 'efeito', key: 'e', width: 18 },
    { header: 'destino', key: 'd', width: 48 },
    { header: 'status', key: 's', width: 16 },
    { header: 'nota', key: 'n', width: 70 },
  ]
  estiloCabecalho(exc, 6)
  const regras = [
    ['departamento', 'Conta Corrente Clientes', 'fora do OPEX', 'Despesas reembolsáveis de clientes', 'confirmada', 'Vale para qualquer conta PAGAR nesse departamento.'],
    ['conta', '2.6.04.000', 'fora do OPEX', 'Repasse ao cliente', 'confirmada', 'Sem movimento em jan–ago/2026.'],
    ['conta', '3.2.07.000', 'fora do OPEX', 'Repasse ao cliente', 'confirmada', 'É a conta que carrega o repasse no período.'],
    ['conta', '8.1.03.000', 'fora do OPEX', 'Remuneração de sócios de capital', 'confirmada', 'Pró-labore = sócio de capital.'],
    ['conta', '2.4.01.000', 'fora do OPEX', 'Remuneração de sócios de capital', 'confirmada', 'Conta nominal Ricardo Pires.'],
    ['conta', '2.4.02.000', 'fora do OPEX', 'Remuneração de sócios de capital', 'confirmada', 'Conta nominal Gustavo Bismarchi.'],
    ['conta', '7.1.01.000', 'fora do OPEX', 'Remuneração de sócios de capital', 'confirmada', 'Distribuição de lucros.'],
    ['conta', '7.1.02.000', 'fora do OPEX', 'Remuneração de sócios de capital', 'confirmada', 'Dividendos parcelas fixas.'],
    ['prefixo', '10.', 'fora do OPEX', 'Investimento / CAPEX', 'confirmada', ''],
    ['prefixo', '3.4', 'fora do OPEX', 'Deduções da receita', 'confirmada', 'Devolução de honorários.'],
    ['conta', '2.2.06.002', 'fora do OPEX', 'Deduções / tributos sobre faturamento', 'confirmada', 'DAS. Flag composição pendente.'],
    ['conta', '2.2.06.001', 'fora do OPEX', 'Deduções / tributos sobre faturamento', 'confirmada', 'DARF. Flag composição pendente.'],
    ['conta', '3.3.01.000', 'fora do OPEX', 'Deduções / tributos sobre faturamento', 'confirmada', 'ISS. Flag composição pendente.'],
    ['conta', '2.2.06.003', 'fora do OPEX', 'Deduções / tributos sobre faturamento', 'confirmada', 'ISSQN. Flag composição pendente.'],
    ['conta', '2.2.06.000', 'fora do OPEX', 'Deduções / tributos sobre faturamento', 'confirmada', 'Tributos da sede. Flag composição pendente. Sem movimento no período.'],
    ['descrição na conta de impostos', 'DAS, DARF, ISSQN, Simples Nacional, parcelamento PGFN', 'fora do OPEX', 'Deduções / tributos sobre faturamento', 'sugerida', 'No período isso está na 5.14.03, não nas contas 2.2.06. Anuidade da mesma conta permanece no OPEX.'],
    ['conta', '5.18.03.000', 'fora do OPEX', 'Multas e juros', 'confirmada', ''],
    ['prefixo', '1.1.02 / 1.1.03 / 1.1.08', 'fora do OPEX', 'Adiantamento ou transferência', 'sugerida', 'Não é despesa operacional. Entra na reconciliação como excluído.'],
    ['conta', '5.6.02 / 2.6.01 / 2.6.01.005 / 2.6.03 / 5.16.06 / 5.16.07', 'dentro do OPEX', 'Despesas Processuais', 'confirmada', 'Só quando o departamento NÃO é Conta Corrente Clientes. Flag processual_possivelmente_reembolsavel.'],
    ['conta', '4.1.01 / 4.1.02 / 2.3.07', 'dentro do OPEX', 'Comissões', 'confirmada', 'Natureza variável.'],
    ['conta', '5.18.01 / 5.18.02 / 5.18.04 / 5.18.05', 'dentro do OPEX', 'Administrativo e Financeiro', 'confirmada', 'Subgrupo Custos bancários e de cobrança. 5.18.05 = tarifas de boleto.'],
    ['receita', 'RECEBER + Conta Corrente Clientes + REEMBOLSO DE DESPESAS', 'fora da receita', 'Reembolso de despesas', 'confirmada', 'Não entra na receita de referência.'],
  ]
  for (const r of regras) exc.addRow(r)

  const classMap = new Map()
  for (const l of linhas) {
    const conta = String(l.row.conta_numero ?? '').trim() || '(sem código)'
    const chaveClass = `${conta}|${l.peri.dentro}|${l.peri.motivo}`
    const atual = classMap.get(chaveClass) || {
      conta,
      plano: l.row.plano_contas || '',
      grupo: l.row.grupo_conta || '',
      dentro: l.peri.dentro,
      statusPer: l.peri.status,
      motivo: l.peri.motivo,
      flag: l.flag,
      cls: l.cls,
      comp: 0,
      caixa: 0,
      n: 0,
    }
    atual.comp = round2(atual.comp + l.valorComp)
    atual.caixa = round2(atual.caixa + l.valorCaixa)
    atual.n += 1
    if (conta === '5.14.03.000' && l.peri.dentro === 'sim' && !String(atual.flag).includes('revisar_se_e_tributo')) {
      atual.flag = [atual.flag, 'revisar_se_e_tributo_sobre_faturamento'].filter(Boolean).join('; ')
    }
    classMap.set(chaveClass, atual)
  }
  const classSheet = wb.addWorksheet('Classificacao_contas')
  classSheet.columns = [
    { header: 'conta_numero', width: 16 },
    { header: 'plano_contas', width: 42 },
    { header: 'grupo_conta', width: 38 },
    { header: 'dentro_opex', width: 14 },
    { header: 'status_perimetro', width: 18 },
    { header: 'motivo_perimetro', width: 55 },
    { header: 'grupo_gerencial', width: 42 },
    { header: 'subgrupo', width: 36 },
    { header: 'natureza', width: 16 },
    { header: 'controlabilidade', width: 20 },
    { header: 'tipo', width: 16 },
    { header: 'potencial_eficiencia', width: 22 },
    { header: 'status_classificacao', width: 22 },
    { header: 'flag', width: 42 },
    { header: 'qtd_lancamentos', width: 18 },
    { header: 'valor_competencia', width: 20 },
    { header: 'valor_caixa', width: 18 },
    { header: 'pct_opex_competencia', width: 22 },
  ]
  estiloCabecalho(classSheet, 18)
  const classRows = [...classMap.values()].sort((a, b) => b.comp - a.comp)
  for (const c of classRows) {
    const added = classSheet.addRow([
      c.conta,
      c.plano,
      c.grupo,
      c.dentro,
      c.statusPer,
      c.motivo,
      c.cls.grupo_gerencial,
      c.cls.subgrupo,
      c.cls.natureza,
      c.cls.controlabilidade,
      c.cls.tipo,
      c.cls.potencial,
      c.cls.status,
      c.flag,
      c.n,
      c.comp,
      c.caixa,
      c.dentro === 'sim' && opexComp ? c.comp / opexComp : 0,
    ])
    moeda(added.getCell(16))
    moeda(added.getCell(17))
    added.getCell(18).numFmt = '0.00%'
  }
  classSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: classRows.length + 1, column: 18 } }

  const lanc = wb.addWorksheet('Lancamentos')
  const lancHeaders = [
    'ci_item',
    'nro_titulo',
    'descricao',
    'fornecedor',
    'departamento',
    'grupo_conta',
    'plano_contas',
    'conta_numero',
    'mes_competencia',
    'mes_pagamento',
    'valor_competencia',
    'valor_caixa',
    'dentro_opex_regra',
    'status_perimetro',
    'motivo_perimetro',
    'flag',
    'grupo_gerencial',
    'subgrupo',
    'natureza',
    'controlabilidade',
    'tipo',
    'potencial_eficiencia',
    'status_classificacao',
    'recorrente_sugerido',
    'motivo_recorrencia',
    'status_recorrencia',
    'override_dentro_opex',
    'override_recorrente',
    'dentro_opex_final',
    'recorrente_final',
    'material',
  ]
  lanc.columns = lancHeaders.map((h) => ({ header: h, key: h, width: Math.min(42, Math.max(14, h.length + 2)) }))
  estiloCabecalho(lanc, lancHeaders.length)
  lanc.getColumn(3).width = 46
  lanc.getColumn(15).width = 55
  lanc.getColumn(25).width = 55
  linhas.sort((a, b) => (a.row.conta_numero || '').localeCompare(b.row.conta_numero || '') || a.valorComp - b.valorComp)
  linhas.forEach((l, i) => {
    const r = i + 2
    const added = lanc.addRow([
      l.row.ci_item,
      l.row.nro_titulo,
      l.row.descricao,
      l.forn,
      l.row.departamento,
      l.row.grupo_conta,
      l.row.plano_contas,
      l.row.conta_numero,
      mesDe(l.row.competencia_titulo),
      mesDe(l.row.data_pagamento),
      l.valorComp,
      l.valorCaixa,
      l.peri.dentro,
      l.peri.status,
      l.peri.motivo,
      l.flag,
      l.cls.grupo_gerencial,
      l.cls.subgrupo,
      l.cls.natureza,
      l.cls.controlabilidade,
      l.cls.tipo,
      l.cls.potencial,
      l.cls.status,
      l.recorrente,
      l.motivoRec,
      l.statusRec,
      null,
      null,
      { formula: `IF(AA${r}="",M${r},AA${r})`, result: l.peri.dentro },
      { formula: `IF(AB${r}="",X${r},AB${r})`, result: l.recorrente },
      {
        formula: `IF(OR(Configuracao!B9="",Configuracao!B10=""),"aguardando limiar",IF(AND(K${r}>=Configuracao!B9,K${r}/MAX(Reconciliacao!C2,1)>=Configuracao!B10/100),"sim","não"))`,
        result: 'aguardando limiar',
      },
    ])
    moeda(added.getCell(11))
    moeda(added.getCell(12))
  })
  lanc.autoFilter = { from: { row: 1, column: 1 }, to: { row: linhas.length + 1, column: lancHeaders.length } }
  const last = linhas.length + 1

  function somaMes(mes, pred) {
    return round2(linhas.filter((l) => pred(l, mes)).reduce((s, l) => s + l.valorComp, 0))
  }
  function somaCaixaMes(mes, pred) {
    return round2(linhas.filter((l) => mesDe(l.row.data_pagamento) === mes && pred(l)).reduce((s, l) => s + l.valorCaixa, 0))
  }

  const rec = wb.addWorksheet('Reconciliacao')
  rec.columns = [
    { header: 'mes', width: 14 },
    { header: 'regime', width: 16 },
    { header: 'total_saidas', width: 20 },
    { header: 'opex', width: 20 },
    { header: 'excluidos', width: 20 },
    { header: 'opex_mais_excluidos', width: 24 },
    { header: 'diferenca', width: 16 },
    { header: 'bate', width: 12 },
  ]
  estiloCabecalho(rec, 8)
  // C2 = OPEX competência do período, referenciado pela fórmula de materialidade
  const opexPeriodoCell = rec.getCell('C2')
  rec.getCell('A2').value = '2026-01 a 2026-08'
  rec.getCell('B2').value = 'competencia_total_opex'
  opexPeriodoCell.value = opexComp
  moeda(opexPeriodoCell)
  let rowIdx = 3
  for (const mes of meses) {
    const total = somaMes(mes, (l, m) => mesDe(l.row.competencia_titulo) === m)
    const opex = somaMes(mes, (l, m) => mesDe(l.row.competencia_titulo) === m && l.peri.dentro === 'sim')
    const excv = round2(total - opex)
    const added = rec.addRow([
      mes,
      'competencia',
      { formula: `SUMIFS(Lancamentos!K$2:K$${last},Lancamentos!I$2:I$${last},A${rowIdx})`, result: total },
      { formula: `SUMIFS(Lancamentos!K$2:K$${last},Lancamentos!I$2:I$${last},A${rowIdx},Lancamentos!AC$2:AC$${last},"sim")`, result: opex },
      { formula: `C${rowIdx}-D${rowIdx}`, result: excv },
      { formula: `D${rowIdx}+E${rowIdx}`, result: total },
      { formula: `F${rowIdx}-C${rowIdx}`, result: 0 },
      { formula: `IF(ABS(G${rowIdx})<0.05,"sim","não")`, result: 'sim' },
    ])
    for (const col of [3, 4, 5, 6, 7]) moeda(added.getCell(col))
    rowIdx += 1
    const totalCx = somaCaixaMes(mes, () => true)
    const opexCx = somaCaixaMes(mes, (l) => l.peri.dentro === 'sim')
    const excCx = round2(totalCx - opexCx)
    const addedCx = rec.addRow([
      mes,
      'caixa',
      { formula: `SUMIFS(Lancamentos!L$2:L$${last},Lancamentos!J$2:J$${last},A${rowIdx})`, result: totalCx },
      { formula: `SUMIFS(Lancamentos!L$2:L$${last},Lancamentos!J$2:J$${last},A${rowIdx},Lancamentos!AC$2:AC$${last},"sim")`, result: opexCx },
      { formula: `C${rowIdx}-D${rowIdx}`, result: excCx },
      { formula: `D${rowIdx}+E${rowIdx}`, result: totalCx },
      { formula: `F${rowIdx}-C${rowIdx}`, result: 0 },
      { formula: `IF(ABS(G${rowIdx})<0.05,"sim","não")`, result: 'sim' },
    ])
    for (const col of [3, 4, 5, 6, 7]) moeda(addedCx.getCell(col))
    rowIdx += 1
  }

  const motivos = new Map()
  for (const l of linhas) {
    if (l.valorComp === 0 || l.peri.dentro === 'sim') continue
    const k = l.peri.motivo
    motivos.set(k, round2((motivos.get(k) || 0) + l.valorComp))
  }
  const det = wb.addWorksheet('Excluidos_por_motivo')
  det.columns = [
    { header: 'motivo', width: 70 },
    { header: 'valor_competencia', width: 22 },
    { header: 'pct_das_saidas', width: 18 },
  ]
  estiloCabecalho(det, 3)
  for (const [motivo, valor] of [...motivos.entries()].sort((a, b) => b[1] - a[1])) {
    const added = det.addRow([motivo, valor, totalComp ? valor / totalComp : 0])
    moeda(added.getCell(2))
    added.getCell(3).numFmt = '0.00%'
  }
  const totExc = det.addRow(['TOTAL EXCLUÍDO', foraComp, totalComp ? foraComp / totalComp : 0])
  totExc.font = { bold: true }
  moeda(totExc.getCell(2))
  totExc.getCell(3).numFmt = '0.00%'
  const totOpex = det.addRow(['OPEX', opexComp, totalComp ? opexComp / totalComp : 0])
  moeda(totOpex.getCell(2))
  totOpex.getCell(3).numFmt = '0.00%'
  const totAll = det.addRow(['OPEX + EXCLUÍDOS', round2(opexComp + foraComp), 1])
  moeda(totAll.getCell(2))
  totAll.getCell(3).numFmt = '0.00%'

  const procContas = (conta) => prefixo(conta, PROCESSUAIS)
  const reemb = wb.addWorksheet('Reembolsaveis_por_depto')
  reemb.columns = [
    { header: 'conta_numero', width: 16 },
    { header: 'plano_contas', width: 40 },
    { header: 'departamento', width: 28 },
    { header: 'qtd', width: 10 },
    { header: 'valor_competencia', width: 20 },
    { header: 'valor_caixa', width: 18 },
    { header: 'tratamento', width: 42 },
  ]
  estiloCabecalho(reemb, 7)
  const bucket = new Map()
  for (const l of linhas) {
    if (!procContas(String(l.row.conta_numero ?? ''))) continue
    const key = `${l.row.conta_numero}|${l.row.departamento}`
    const b = bucket.get(key) || {
      conta: l.row.conta_numero,
      plano: l.row.plano_contas,
      dep: l.row.departamento,
      n: 0,
      comp: 0,
      caixa: 0,
    }
    b.n += 1
    b.comp = round2(b.comp + l.valorComp)
    b.caixa = round2(b.caixa + l.valorCaixa)
    bucket.set(key, b)
  }
  for (const b of [...bucket.values()].sort((a, c) => String(a.conta).localeCompare(String(c.conta)) || c.comp - a.comp)) {
    const tratamento =
      b.dep === 'Conta Corrente Clientes'
        ? 'FORA do OPEX — reembolsável de cliente'
        : 'DENTRO do OPEX — Despesas Processuais, com flag'
    const added = reemb.addRow([b.conta, b.plano, b.dep, b.n, b.comp, b.caixa, tratamento])
    moeda(added.getCell(5))
    moeda(added.getCell(6))
  }
  const contasProcessuaisEsperadas = [
    ['5.6.02.000', 'CUSTAS JUDICIAIS'],
    ['2.6.01.000', 'Custas'],
    ['2.6.01.005', 'Correios jurídicos'],
    ['2.6.03.000', 'Diligência'],
    ['5.16.06.000', 'OUTRAS DESPESAS REEMBOLSÁVEIS'],
    ['5.16.07.000', 'DESPESAS REEMBOLSÁVEIS - GUIAS'],
  ]
  for (const [conta, plano] of contasProcessuaisEsperadas) {
    if ([...bucket.values()].some((b) => b.conta === conta)) continue
    reemb.addRow([conta, plano, '—', 0, 0, 0, 'sem lançamento no período'])
  }
  reemb.autoFilter = { from: { row: 1, column: 1 }, to: { row: reemb.rowCount, column: 7 } }

  const ctrl = wb.addWorksheet('Controle_reembolso')
  ctrl.columns = [
    { header: 'mes', width: 14 },
    { header: 'reembolsaveis_pagas_competencia', width: 36 },
    { header: 'reembolsos_recebidos_competencia', width: 36 },
    { header: 'saldo_competencia', width: 22 },
    { header: 'acumulado_competencia', width: 24 },
    { header: 'reembolsaveis_pagas_caixa', width: 30 },
    { header: 'reembolsos_recebidos_caixa', width: 30 },
    { header: 'saldo_caixa', width: 18 },
    { header: 'acumulado_caixa', width: 20 },
  ]
  estiloCabecalho(ctrl, 9)
  ctrl.addRow(['Critério', 'PAGAR departamento Conta Corrente Clientes menos RECEBER mesmo departamento e plano REEMBOLSO DE DESPESAS. Fora do OPEX e fora da receita.', '', '', '', '', '', '', ''])
  let accC = 0
  let accX = 0
  for (const mes of meses) {
    const pagas = round2(
      linhas
        .filter((l) => mesDe(l.row.competencia_titulo) === mes && String(l.row.departamento) === 'Conta Corrente Clientes')
        .reduce((s, l) => s + l.valorComp, 0),
    )
    const pagasCx = round2(
      linhas
        .filter((l) => mesDe(l.row.data_pagamento) === mes && String(l.row.departamento) === 'Conta Corrente Clientes')
        .reduce((s, l) => s + l.valorCaixa, 0),
    )
    const recC = round2(
      receber
        .filter(
          (r) =>
            mesDe(r.competencia_titulo) === mes &&
            r.departamento === 'Conta Corrente Clientes' &&
            norm(r.plano_contas) === 'REEMBOLSO DE DESPESAS',
        )
        .reduce((s, r) => s + absVal(r.valor_item), 0),
    )
    const recX = round2(
      receberCaixa
        .filter(
          (r) =>
            mesDe(r.data_pagamento) === mes &&
            r.departamento === 'Conta Corrente Clientes' &&
            norm(r.plano_contas) === 'REEMBOLSO DE DESPESAS',
        )
        .reduce((s, r) => s + absVal(r.valor_pago_item), 0),
    )
    accC = round2(accC + pagas - recC)
    accX = round2(accX + pagasCx - recX)
    const added = ctrl.addRow([mes, pagas, recC, round2(pagas - recC), accC, pagasCx, recX, round2(pagasCx - recX), accX])
    for (const col of [2, 3, 4, 5, 6, 7, 8, 9]) moeda(added.getCell(col))
  }

  const repPagar = linhas.filter((l) => String(l.row.conta_numero || '').startsWith('3.2.07') || String(l.row.conta_numero || '').startsWith('2.6.04'))
  const chaveValor = (mes, dep, valor) => `${mes}|${dep}|${round2(valor).toFixed(2)}`
  const usadas = new Set()
  const pares = []
  for (const l of repPagar) {
    const mes = mesDe(l.row.competencia_titulo)
    const alvo = chaveValor(mes, l.row.departamento, l.valorComp)
    const match = receber.find((r) => {
      if (usadas.has(r.ci_item)) return false
      if (mesDe(r.competencia_titulo) !== mes) return false
      if (r.departamento !== l.row.departamento) return false
      if (round2(absVal(r.valor_item)).toFixed(2) !== round2(l.valorComp).toFixed(2)) return false
      const plano = norm(r.plano_contas)
      return plano.includes('OUTRAS RECEITAS') || plano.includes('REPASSE') || norm(r.descricao).includes('REPASSE')
    })
    if (match) usadas.add(match.ci_item)
    pares.push({ l, match, alvo })
  }
  const receberRepasseTexto = receber.filter(
    (r) => norm(r.descricao).includes('REPASSE') || norm(r.plano_contas).includes('REPASSE'),
  )
  for (const r of receberRepasseTexto) usadas.add(r.ci_item)

  const rep = wb.addWorksheet('Repasse')
  rep.columns = [
    { header: 'mes', width: 12 },
    { header: 'repasse_pago_competencia', width: 30 },
    { header: 'entrada_vinculada_competencia', width: 34 },
    { header: 'diferenca', width: 18 },
    { header: 'criterio', width: 80 },
  ]
  estiloCabecalho(rep, 5)
  rep.addRow([
    'Critério',
    'Saída = PAGAR 2.6.04 e 3.2.07. Entrada tirada da receita = mesmo mês, mesmo departamento e mesmo valor em RECEBER de OUTRAS RECEITAS/REPASSE, mais qualquer RECEBER cuja descrição ou plano contenha REPASSE. OUTRAS RECEITAS sem esse vínculo permanece na receita, na aba Repasse_sem_vinculo.',
    '',
    '',
    '',
  ])
  for (const mes of meses) {
    const pago = round2(repPagar.filter((l) => mesDe(l.row.competencia_titulo) === mes).reduce((s, l) => s + l.valorComp, 0))
    const entrou = round2(
      pares
        .filter((p) => mesDe(p.l.row.competencia_titulo) === mes && p.match)
        .reduce((s, p) => s + absVal(p.match.valor_item), 0) +
        receberRepasseTexto
          .filter((r) => mesDe(r.competencia_titulo) === mes && !pares.some((p) => p.match?.ci_item === r.ci_item))
          .reduce((s, r) => s + absVal(r.valor_item), 0),
    )
    const added = rep.addRow([mes, pago, entrou, round2(pago - entrou), 'mês + departamento + valor, ou texto REPASSE'])
    moeda(added.getCell(2))
    moeda(added.getCell(3))
    moeda(added.getCell(4))
  }

  const repDet = wb.addWorksheet('Repasse_lancamentos')
  repDet.columns = [
    { header: 'lado', width: 12 },
    { header: 'ci_item', width: 12 },
    { header: 'mes', width: 12 },
    { header: 'departamento', width: 28 },
    { header: 'conta', width: 16 },
    { header: 'plano', width: 36 },
    { header: 'descricao', width: 50 },
    { header: 'valor_competencia', width: 20 },
    { header: 'ci_entrada_vinculada', width: 22 },
    { header: 'tratamento_receita', width: 28 },
  ]
  estiloCabecalho(repDet, 10)
  for (const p of pares) {
    const added = repDet.addRow([
      'PAGAR',
      p.l.row.ci_item,
      mesDe(p.l.row.competencia_titulo),
      p.l.row.departamento,
      p.l.row.conta_numero,
      p.l.row.plano_contas,
      p.l.row.descricao,
      p.l.valorComp,
      p.match ? p.match.ci_item : '',
      p.match ? 'entrada fora da receita' : 'sem entrada vinculada',
    ])
    moeda(added.getCell(8))
  }
  for (const r of receberRepasseTexto) {
    if (pares.some((p) => p.match?.ci_item === r.ci_item)) continue
    const added = repDet.addRow([
      'RECEBER',
      r.ci_item,
      mesDe(r.competencia_titulo),
      r.departamento,
      r.conta_numero,
      r.plano_contas,
      r.descricao,
      absVal(r.valor_item),
      '',
      'fora da receita por texto REPASSE',
    ])
    moeda(added.getCell(8))
  }

  const sem = wb.addWorksheet('Repasse_sem_vinculo')
  sem.columns = [
    { header: 'ci_item', width: 12 },
    { header: 'mes', width: 12 },
    { header: 'departamento', width: 28 },
    { header: 'conta', width: 16 },
    { header: 'plano', width: 28 },
    { header: 'descricao', width: 50 },
    { header: 'valor_competencia', width: 20 },
    { header: 'status', width: 42 },
  ]
  estiloCabecalho(sem, 8)
  const outras = receber.filter((r) => norm(r.plano_contas) === 'OUTRAS RECEITAS' && !usadas.has(r.ci_item))
  for (const r of outras) {
    const added = sem.addRow([
      r.ci_item,
      mesDe(r.competencia_titulo),
      r.departamento,
      r.conta_numero,
      r.plano_contas,
      r.descricao,
      absVal(r.valor_item),
      'permanece na receita até validação',
    ])
    moeda(added.getCell(7))
  }

  const trib = wb.addWorksheet('Tributos_mensal')
  trib.columns = [
    { header: 'conta', width: 16 },
    { header: 'plano', width: 36 },
    { header: 'mes', width: 12 },
    { header: 'valor_competencia', width: 20 },
    { header: 'valor_caixa', width: 18 },
    { header: 'flag', width: 24 },
  ]
  estiloCabecalho(trib, 6)
  const tribItens = linhas.filter(
    (l) => TRIBUTOS.has(String(l.row.conta_numero || '')) || String(l.flag).includes('composicao_pendente'),
  )
  const tribAgg = new Map()
  for (const l of tribItens) {
    const key = `${l.row.conta_numero}|${mesDe(l.row.competencia_titulo) || mesDe(l.row.data_pagamento)}`
    const b = tribAgg.get(key) || { conta: l.row.conta_numero, plano: l.row.plano_contas, mes: key.split('|')[1], comp: 0, caixa: 0 }
    b.comp = round2(b.comp + l.valorComp)
    b.caixa = round2(b.caixa + l.valorCaixa)
    tribAgg.set(key, b)
  }
  for (const b of [...tribAgg.values()].sort((a, c) => String(a.conta).localeCompare(String(c.conta)) || String(a.mes).localeCompare(String(c.mes)))) {
    const added = trib.addRow([b.conta, b.plano, b.mes, b.comp, b.caixa, 'composicao_pendente'])
    moeda(added.getCell(4))
    moeda(added.getCell(5))
  }
  const nomesTributo = {
    '2.2.06.002': 'DAS',
    '2.2.06.001': 'DARF',
    '3.3.01.000': 'IMPOSTOS SOBRE SERVIÇOS - ISS',
    '2.2.06.003': 'ISSQN',
    '2.2.06.000': 'Tributos',
  }
  for (const [conta, plano] of Object.entries(nomesTributo)) {
    if ([...tribAgg.values()].some((b) => b.conta === conta)) continue
    trib.addRow([conta, plano, '2026-01 a 2026-08', 0, 0, 'composicao_pendente; sem movimento no período'])
  }

  const socios = wb.addWorksheet('Socios_capital')
  socios.columns = [
    { header: 'mes', width: 12 },
    { header: 'pro_labore_8_1_03', width: 22 },
    { header: 'contas_nominais_socios', width: 26 },
    { header: 'distribuicao_de_lucros', width: 24 },
    { header: 'remuneracao_socios_de_capital', width: 34 },
  ]
  estiloCabecalho(socios, 5)
  socios.addRow(['Nota', 'Linha abaixo do resultado operacional. Fora do OPEX. Associados 8.1.01 não entram aqui.', '', '', ''])
  for (const mes of meses) {
    const daMes = (pred) =>
      round2(linhas.filter((l) => mesDe(l.row.competencia_titulo) === mes && pred(String(l.row.conta_numero || ''))).reduce((s, l) => s + l.valorComp, 0))
    const pro = daMes((c) => c.startsWith('8.1.03'))
    const nom = daMes((c) => c.startsWith('2.4.01') || c.startsWith('2.4.02'))
    const dist = daMes((c) => c.startsWith('7.1.01') || c.startsWith('7.1.02'))
    const added = socios.addRow([mes, pro, nom, dist, round2(pro + nom + dist)])
    for (const col of [2, 3, 4, 5]) moeda(added.getCell(col))
  }

  const prov = wb.addWorksheet('Provisao_13_ferias')
  prov.columns = [
    { header: 'conta', width: 16 },
    { header: 'plano', width: 28 },
    { header: 'mes', width: 12 },
    { header: 'lancado_competencia', width: 24 },
    { header: 'provisao_sugerida_mensal', width: 28 },
    { header: 'ajuste_sugerido', width: 20 },
    { header: 'status', width: 16 },
  ]
  estiloCabecalho(prov, 7)
  const contasProv = [
    ['8.2.05.000', '13º SALÁRIO'],
    ['8.2.04.000', 'FÉRIAS'],
    ['8.7.06.000', 'SALDO DE FÉRIAS ASSOCIADOS'],
  ]
  for (const [conta, plano] of contasProv) {
    const serie = meses.map((mes) =>
      round2(
        linhas
          .filter((l) => String(l.row.conta_numero) === conta && mesDe(l.row.competencia_titulo) === mes)
          .reduce((s, l) => s + l.valorComp, 0),
      ),
    )
    const media = round2(serie.reduce((s, v) => s + v, 0) / meses.length)
    meses.forEach((mes, i) => {
      const added = prov.addRow([conta, plano, mes, serie[i], media, round2(media - serie[i]), 'sugerida'])
      moeda(added.getCell(4))
      moeda(added.getCell(5))
      moeda(added.getCell(6))
    })
  }
  prov.addRow(['Nota', 'Provisão mensal = soma de competência jan–ago / 8. Não há custo por pessoa para calcular 1/12 da folha.', '', '', '', '', ''])

  const alerta = wb.addWorksheet('Alerta_outros')
  alerta.columns = [
    { header: 'grupo_gerencial', width: 48 },
    { header: 'valor_competencia', width: 22 },
    { header: 'pct_opex', width: 14 },
  ]
  estiloCabecalho(alerta, 3)
  const porGrupo = new Map()
  for (const l of linhas) {
    if (l.peri.dentro !== 'sim') continue
    const k = l.cls.grupo_gerencial
    porGrupo.set(k, round2((porGrupo.get(k) || 0) + l.valorComp))
  }
  for (const [g, v] of [...porGrupo.entries()].sort((a, b) => b[1] - a[1])) {
    const added = alerta.addRow([g, v, opexComp ? v / opexComp : 0])
    moeda(added.getCell(2))
    added.getCell(3).numFmt = '0.00%'
    if (g === 'Outros' && pctOutros > 0.05) added.font = { bold: true, color: { argb: 'FF9F1239' } }
  }
  alerta.addRow([pctOutros > 0.05 ? 'ALERTA: Outros acima de 5% do OPEX' : 'Outros dentro de 5% do OPEX', outrosComp, pctOutros])

  const ref = wb.addWorksheet('Referencia_2026')
  ref.columns = [
    { header: 'nome', width: 22 },
    { header: 'nota', width: 62 },
    { header: 'ano', width: 10 },
    { header: 'mes', width: 8 },
    { header: 'grupo_conta', width: 36 },
    { header: 'plano_contas', width: 36 },
    { header: 'conta_numero', width: 16 },
    { header: 'departamento', width: 24 },
    { header: 'descricao', width: 40 },
    { header: 'valor', width: 16 },
  ]
  estiloCabecalho(ref, 10)
  for (const o of orcamento) {
    const added = ref.addRow([
      'Referência 2026',
      'referência montada em jul/2026 a partir do realizado até ago',
      o.ano,
      o.mes,
      o.grupo_conta,
      o.plano_contas,
      o.conta_numero,
      o.departamento,
      o.descricao,
      Number(o.valor) || 0,
    ])
    moeda(added.getCell(10))
  }

  const fte = wb.addWorksheet('Pessoas_fte')
  fte.columns = [
    { header: 'cargo', width: 42 },
    { header: 'ativos', width: 12 },
    { header: 'peso_fte', width: 12 },
    { header: 'fte', width: 12 },
    { header: 'nota', width: 50 },
  ]
  estiloCabecalho(fte, 5)
  const porCargo = new Map()
  for (const c of colaboradores ?? []) {
    porCargo.set(c.cargo, (porCargo.get(c.cargo) || 0) + 1)
  }
  for (const [cargo, n] of [...porCargo.entries()].sort((a, b) => b[1] - a[1])) {
    const est = norm(cargo).includes('ESTAGI')
    const peso = est ? 0.75 : 1
    fte.addRow([cargo, n, peso, round2(n * peso), est ? 'peso_fte_estagiario da Configuracao' : 'cadastro atual, não é headcount histórico'])
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await wb.xlsx.writeFile(OUT)

  const diff = round2(totalComp - (opexComp + foraComp))
  console.log(JSON.stringify({
    arquivo: OUT,
    lancamentos: linhas.length,
    totalComp,
    opexComp,
    foraComp,
    diff,
    pctOutros: round2(pctOutros * 100),
    outrosComp,
    referenciaLinhas: orcamento.length,
    repasseSemEntrada: pares.filter((p) => !p.match).length,
    outrasReceitasSemVinculo: outras.length,
  }))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
