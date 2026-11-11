import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fenixCrescimento,
  fenixMargem,
  fenixReceitaAno,
  fenixResultadoEscritorio,
  fenixSimulacaoArea,
} from '../src/features/planejamento/fenix/planejamentoFenix.ts'
import { montarBaseRealizada, totaisArea } from '../src/features/planejamento/utils/planejamentoBase.ts'
import { premissasPadrao, simular } from '../src/features/planejamento/utils/planejamentoCalc.ts'
import type { PlanMargemRow } from '../src/features/planejamento/types.ts'

const somaConta = (conta: { numero?: number; tipo?: string; operador?: string }[]) =>
  conta.filter((l) => l.tipo !== 'total' && l.tipo !== 'info').reduce((s, l) => s + (l.numero ?? 0), 0)

test('receita do ano: conta mês a mês fecha com o total e marca a Melhor Estimativa', () => {
  const porMes = [10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 40, 50]
  const projetado = porMes.map((_, i) => i >= 10)
  const e = fenixReceitaAno({ titulo: 'Receita 2026', ano: 2026, areaNome: 'Cível', porMes, projetado })
  assert.equal(somaConta(e.conta ?? []), 150)
  assert.ok(e.conta?.some((l) => l.rotulo.includes('Melhor Estimativa')))
  assert.ok(e.formula?.includes('Melhor Estimativa'))
})

test('crescimento sem base anterior explica que a área não existia', () => {
  const e = fenixCrescimento({ titulo: 'x', areaNome: 'Rec. Crédito', anterior: 0, atual: 100, rotuloAnterior: '2025', rotuloAtual: '2026' })
  assert.equal(e.valor, '—')
  assert.ok(e.regras?.[0]?.includes('não existia'))
})

test('margem: cascata receita → líquida → margem bate com os totais e cita a estimativa de imposto em 2025', () => {
  const row: PlanMargemRow = {
    area_key: 'civel', mes: 1, receita_bruta: 1000, base_nf: 500, aliquota: 16, aliquota_herdada: false, impostos: 80,
    desp_pessoas: 300, desp_demais: 100, desp_operacionais: 400, pct_controladoria: 10, origem_controladoria: 'legal_ops',
    desp_controladoria: 50, pessoas_reclassificadas: 0,
  }
  const t = totaisArea(montarBaseRealizada(2025, [row], []).areas.civel)
  const e = fenixMargem({ titulo: 'Margem', areaNome: 'Cível', ano: 2025, periodo: '2025', t, impostoEstimado: true, avisos: ['aviso'] })
  const margem = e.conta?.find((l) => l.rotulo === 'Margem de contribuição')?.numero
  assert.equal(margem, 1000 - 80 - 300 - 100 - 50)
  assert.ok(e.conta?.some((l) => l.rotulo.includes('estimado')))
  assert.ok(e.regras?.includes('aviso'))
})

test('simulador: explicação da meta da área e do resultado do escritório usam o resultado de simular()', () => {
  const rows: PlanMargemRow[] = Array.from({ length: 12 }, (_, i) => ({
    area_key: 'civel', mes: i + 1, receita_bruta: 100, base_nf: 0, aliquota: 0, aliquota_herdada: false, impostos: 0,
    desp_pessoas: 30, desp_demais: 10, desp_operacionais: 40, pct_controladoria: 0, origem_controladoria: '', desp_controladoria: 5,
    pessoas_reclassificadas: 0,
  }))
  const base = montarBaseRealizada(2026, rows, [])
  const p = premissasPadrao({ aliquotaPct: 10, inadimplenciaMetaPct: 10 })
  p.areas.civel.crescimentoPct = 10
  const r = simular(base, p)
  const ea = fenixSimulacaoArea({ areaNome: 'Cível', p: p.areas.civel, e: p.escritorio, r: r.areas.civel })
  assert.equal(ea.conta?.find((l) => l.rotulo === 'Meta de receita 2027')?.numero, r.areas.civel.receitaAno)
  const er = fenixResultadoEscritorio({ r: r.escritorio, e: p.escritorio })
  assert.equal(er.conta?.find((l) => l.rotulo === 'Resultado')?.numero, r.escritorio.resultadoAno)
})
