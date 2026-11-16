import type { DlGestor, DlGestorAreaMes, DlGestorMes, DlLinhaKey, DlMesCalculado, DlMesRow } from '../types/dl.types'

/** Horas úteis por profissional no mês (8h × 21 dias) e eficiência usada na planilha oficial. */
export const DL_HORAS_DIA = 8
export const DL_DIAS_MES = 21
export const DL_EFICIENCIA = 0.8

/** Referência de margem de contribuição do escritório (planilha oficial). */
export const DL_REFERENCIA_GERAL = 0.58

export function mesAtualDl(ano: number, ref = new Date()): number {
  const y = ref.getFullYear()
  if (ano < y) return 12
  if (ano > y) return 1
  return ref.getMonth() + 1
}

export function intervaloMeses(de: number, ate: number): number[] {
  const a = Math.min(de, ate)
  const b = Math.max(de, ate)
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

/** Liga o DL de cada gestor (calculado no banco sobre a carteira) à área dele. */
export function dlGestorPorArea(gestores: DlGestor[], gestorMes: DlGestorMes[]): DlGestorAreaMes[] {
  const area = new Map(gestores.map((g) => [g.id, g.area_key]))
  return gestorMes.flatMap((g) => {
    const area_key = area.get(g.gestor_id)
    return area_key ? [{ area_key, mes: g.mes, dl: g.dl }] : []
  })
}

function vazio(mes: number): DlMesCalculado {
  return {
    mes,
    herdado: false,
    receita_bruta: 0,
    impostos: 0,
    receita_liquida: 0,
    desp_operacionais: 0,
    desp_controladoria: 0,
    margem: 0,
    margem_pct: 0,
    desp_indiretas: 0,
    resultado: 0,
    dl_gestor: 0,
    profissionais: 0,
    custo_hora: 0,
  }
}

function derivar(c: DlMesCalculado): DlMesCalculado {
  c.receita_liquida = c.receita_bruta - c.impostos
  c.margem = c.receita_liquida - c.desp_operacionais - c.desp_controladoria
  c.margem_pct = c.receita_liquida > 0 ? c.margem / c.receita_liquida : 0
  c.resultado = c.margem - c.desp_indiretas
  const horas = DL_HORAS_DIA * DL_DIAS_MES * c.profissionais * DL_EFICIENCIA
  c.custo_hora = horas > 0 ? (c.desp_operacionais + c.desp_controladoria + c.desp_indiretas) / horas : 0
  return c
}

/**
 * Demonstrativo mês a mês de um conjunto de áreas (uma área ou o escritório todo).
 * O DL Gestor vem pronto por gestor (já zerado quando negativo) e só é somado.
 */
export function calcularDemonstrativo(
  rows: DlMesRow[],
  areaKeys: string[],
  meses: number[],
  dlGestor: DlGestorAreaMes[],
): DlMesCalculado[] {
  return meses.map((mes) => {
    const out = vazio(mes)
    for (const area of areaKeys) {
      const r = rows.find((x) => x.area_key === area && x.mes === mes)
      if (!r) continue
      const a = derivar({
        ...vazio(mes),
        receita_bruta: r.receita_bruta,
        impostos: r.impostos,
        desp_operacionais: r.desp_operacionais,
        desp_controladoria: r.desp_controladoria,
        desp_indiretas: r.desp_indiretas,
        profissionais: r.profissionais,
      })
      out.receita_bruta += a.receita_bruta
      out.impostos += a.impostos
      out.desp_operacionais += a.desp_operacionais
      out.desp_controladoria += a.desp_controladoria
      out.desp_indiretas += a.desp_indiretas
      out.profissionais += a.profissionais
      out.dl_gestor += dlGestor
        .filter((g) => g.area_key === area && g.mes === mes)
        .reduce((s, g) => s + g.dl, 0)
      out.herdado ||= r.parametro_herdado
    }
    const dl = out.dl_gestor
    return { ...derivar(out), dl_gestor: dl }
  })
}

/** Soma do período; percentuais e custo-hora recalculados sobre os totais. */
export function totalDemonstrativo(meses: DlMesCalculado[]): DlMesCalculado {
  const t = vazio(0)
  for (const m of meses) {
    t.receita_bruta += m.receita_bruta
    t.impostos += m.impostos
    t.desp_operacionais += m.desp_operacionais
    t.desp_controladoria += m.desp_controladoria
    t.desp_indiretas += m.desp_indiretas
    t.profissionais += m.profissionais
    t.dl_gestor += m.dl_gestor
  }
  const dl = t.dl_gestor
  const comProf = meses.filter((m) => m.profissionais > 0).length
  const total = derivar(t)
  // Custo-hora do período = custo total ÷ horas somadas de todos os meses.
  return {
    ...total,
    dl_gestor: dl,
    profissionais: comProf > 0 ? t.profissionais / comProf : 0,
  }
}

export const DL_LINHAS: Array<{
  key: DlLinhaKey
  label: string
  tipo: 'valor' | 'saida' | 'resultado' | 'pct' | 'info'
}> = [
  { key: 'receita_bruta', label: 'Receita Bruta', tipo: 'valor' },
  { key: 'impostos', label: '(−) Impostos', tipo: 'saida' },
  { key: 'receita_liquida', label: '(=) Receita Líquida', tipo: 'resultado' },
  { key: 'desp_operacionais', label: '(−) Desp. Operacionais', tipo: 'saida' },
  { key: 'desp_controladoria', label: '(−) Desp. Controladoria', tipo: 'saida' },
  { key: 'margem', label: '(=) Margem de Contribuição', tipo: 'resultado' },
  { key: 'margem_pct', label: 'Margem %', tipo: 'pct' },
  { key: 'desp_indiretas', label: '(−) Desp. Indiretas', tipo: 'saida' },
  { key: 'resultado', label: '(=) Resultado', tipo: 'resultado' },
  { key: 'dl_gestor', label: 'DL Gestor', tipo: 'valor' },
  { key: 'profissionais', label: 'Profissionais', tipo: 'info' },
  { key: 'custo_hora', label: 'Custo hora total', tipo: 'info' },
]
