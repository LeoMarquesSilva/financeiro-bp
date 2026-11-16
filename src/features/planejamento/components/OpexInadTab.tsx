import { RECEITA_META_INADIMPLENCIA_PCT } from '@/features/receita/constants'
import { usePlanInadimplencia, usePlanInadimplenciaPeriodo, usePlanOpexDashboard } from '../hooks/usePlanejamento'
import type { PlanInadimplenciaPeriodoRow, PlanInadimplenciaRow } from '../types'
import { AREAS_PLANEJAMENTO, MESES_ABREV, soma, variacaoPct, zeros12 } from '../utils/areasPlanejamento'
import { somarAreas, type BaseAno } from '../utils/planejamentoBase'
import { fenixValor } from '../fenix/planejamentoFenix'
import { CarregandoBloco, ErroBloco, PlanKpi, Secao, TabelaMeses, VarPct, moeda, moedaCurta, pct } from './PlanUi'

type Props = { base2025: BaseAno; base2026: BaseAno; ultimoMesFechado: number }

export function OpexInadTab({ base2025, base2026, ultimoMesFechado }: Props) {
  const op25 = usePlanOpexDashboard(2025)
  const op26 = usePlanOpexDashboard(2026)
  const in25 = usePlanInadimplencia(2025)
  const in26 = usePlanInadimplencia(2026)
  const ip25 = usePlanInadimplenciaPeriodo(2025)
  const ip26 = usePlanInadimplenciaPeriodo(2026)
  const fechados = Array.from({ length: ultimoMesFechado }, (_, i) => i + 1)
  const rotuloFechado = (MESES_ABREV[ultimoMesFechado - 1] ?? '').toLowerCase()

  const serie = (evo: { mes: number; realizado: number; previsto: number }[] | undefined, campo: 'realizado' | 'previsto') => {
    const out = zeros12()
    for (const r of evo ?? []) if (r.mes >= 1 && r.mes <= 12) out[r.mes - 1] = Number(r[campo]) || 0
    return out
  }
  const real25 = serie(op25.data?.evolucao, 'realizado')
  const real26 = serie(op26.data?.evolucao, 'realizado').map((v, i) => (i + 1 <= ultimoMesFechado ? v : 0))
  const orc26 = serie(op26.data?.evolucao, 'previsto')
  const ytd25 = soma(fechados.map((m) => real25[m - 1]))
  const ytd26 = soma(fechados.map((m) => real26[m - 1]))
  const orcYtd = soma(fechados.map((m) => orc26[m - 1]))

  /** Por mês (valor congelado no fechamento ou, sem fechamento, em aberto hoje) e % sobre o previsto do mês. */
  const inad = (rows: PlanInadimplenciaRow[] | undefined) => {
    const valor: (number | null)[] = Array(12).fill(null)
    const previsto: number[] = Array(12).fill(0)
    const congelado: boolean[] = Array(12).fill(false)
    for (const r of rows ?? []) {
      const i = r.mes - 1
      if (i < 0 || i > 11) continue
      valor[i] = (valor[i] ?? 0) + r.inadimplencia
      previsto[i] = r.previsto_mes
      congelado[i] = congelado[i] || r.congelado
    }
    const pctMes = valor.map((v, i) => (v != null && previsto[i] > 0 ? (v / previsto[i]) * 100 : null))
    return { valor, pctMes, congelado }
  }
  /** Acumulado do período: mesma conta do painel de Inadimplência (por grupo de cliente). */
  const periodo = (rows: PlanInadimplenciaPeriodoRow[] | undefined) => {
    const esc = rows?.find((r) => r.area_key === 'escritorio')
    const porArea: Record<string, number> = {}
    for (const r of rows ?? []) if (r.area_key !== 'escritorio') porArea[r.area_key] = r.inadimplencia
    return {
      total: esc ? esc.inadimplencia : null,
      previsto: esc?.previsto ?? 0,
      pct: esc && esc.previsto > 0 ? (esc.inadimplencia / esc.previsto) * 100 : null,
      porArea,
    }
  }
  const p25 = periodo(ip25.data)
  const p26 = periodo(ip26.data)
  const i25 = inad(in25.data)
  const i26 = inad(in26.data)

  const blocos = (b: BaseAno) => {
    const areas = somarAreas(b)
    return {
      pessoas: areas.pessoas,
      demais: areas.demais,
      ctrl: b.controladoriaTotal,
      estrutura: b.estrutura,
      outros: b.outros,
    }
  }
  const b25 = blocos(base2025)
  const b26 = blocos(base2026)

  const erro = op25.error ?? op26.error ?? in25.error ?? in26.error ?? ip25.error ?? ip26.error
  if (erro) return <ErroBloco erro={erro} contexto="OPEX e inadimplência" />

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PlanKpi
          rotulo={`OPEX 2026 (jan–${rotuloFechado})`}
          valor={moedaCurta(ytd26)}
          sub={
            <>
              vs. 2025 mesmo período: <VarPct v={variacaoPct(ytd26, ytd25)} />
            </>
          }
          fenixChave="planejamento.opex.ytd"
          explicar={() =>
            fenixValor({
              tela: 'OPEX e Inadimplência',
              titulo: `OPEX realizado 2026 (jan–${rotuloFechado})`,
              valor: moeda(ytd26),
              resumo: 'Despesas pagas no ano até o último mês fechado, pela mesma regra do painel OPEX.',
              conta: [
                { rotulo: `2026 jan–${rotuloFechado}`, valor: moeda(ytd26), numero: ytd26 },
                { rotulo: `2025 jan–${rotuloFechado}`, valor: moeda(ytd25), numero: ytd25 },
                { rotulo: 'Orçamento no período', valor: moeda(orcYtd), numero: orcYtd, tipo: 'info' },
              ],
              regras: ['Fora do OPEX: distribuição de lucros, sócios, outras receitas, empréstimos, investimentos e deduções da receita.'],
              fonteTecnica: 'opex_dashboard (evolucao.realizado / evolucao.previsto)',
            })
          }
        />
        <PlanKpi
          rotulo="Orçamento OPEX 2026 no período"
          valor={orcYtd > 0 ? moedaCurta(orcYtd) : '—'}
          tom={orcYtd > 0 ? (ytd26 <= orcYtd ? 'bom' : 'ruim') : 'neutro'}
          sub={orcYtd > 0 ? `Realizado ÷ orçamento: ${pct((ytd26 / orcYtd) * 100)}` : 'Sem orçamento importado'}
        />
        {([
          { ano: 2025, p: p25, rotulo: 'Inadimplência 2025' },
          { ano: 2026, p: p26, rotulo: `Inadimplência 2026 (jan–${rotuloFechado})` },
        ] as const).map(({ ano, p, rotulo }) => (
          <PlanKpi
            key={ano}
            rotulo={rotulo}
            valor={pct(p.pct)}
            tom={p.pct != null && p.pct <= RECEITA_META_INADIMPLENCIA_PCT ? 'bom' : 'ruim'}
            sub={p.total != null ? `${moeda(p.total)} · meta ${RECEITA_META_INADIMPLENCIA_PCT}%` : undefined}
            fenixChave={`planejamento.inadimplencia.${ano}`}
            explicar={() =>
              fenixValor({
                tela: 'OPEX e Inadimplência',
                titulo: rotulo,
                valor: pct(p.pct),
                resumo: 'Valor que segue em aberto dos títulos vencidos no período, sobre o previsto do período. Mesma conta do acumulado do painel de Inadimplência.',
                formula: 'Inadimplência % = em aberto no período ÷ previsto no período × 100',
                conta: [
                  { rotulo: 'Em aberto no período', valor: moeda(p.total ?? 0), numero: p.total ?? 0 },
                  { rotulo: 'Previsto no período', valor: moeda(p.previsto), numero: p.previsto, operador: '÷' },
                ],
                regras: [
                  'Período: janeiro até o último mês fechado (o painel de Inadimplência, no padrão, inclui também o mês corrente).',
                  'Calculado por grupo de cliente: pagamento de um mês cobre título de outro mês do mesmo grupo.',
                ],
                fonteTecnica: 'planejamento_inadimplencia_periodo → receita_inadimplencia_grupos_periodo',
              })
            }
          />
        ))}
      </div>

      <Secao titulo="OPEX mês a mês" subtitulo="Mesma regra do painel OPEX. Orçamento = previsto importado para 2026.">
        {op25.isLoading || op26.isLoading ? (
          <CarregandoBloco altura="h-32" />
        ) : (
          <TabelaMeses
            linhas={[
              { rotulo: 'OPEX 2025', valores: real25 },
              { rotulo: 'OPEX 2026', valores: real26.map((v, i) => (i + 1 <= ultimoMesFechado ? v : null)), destaque: true },
              { rotulo: 'Orçamento 2026', valores: orc26 },
              {
                rotulo: '2026 ÷ orçamento',
                valores: real26.map((v, i) => (i + 1 <= ultimoMesFechado && orc26[i] > 0 ? (v / orc26[i]) * 100 : null)),
                formato: 'pct',
                total: orcYtd > 0 ? (ytd26 / orcYtd) * 100 : null,
              },
            ]}
          />
        )}
      </Secao>

      <Secao
        titulo="Composição das despesas (regra do DL)"
        subtitulo="Áreas = pessoas e demais despesas lançadas nas áreas jurídicas; Controladoria = Operações Legais; Estrutura = Facilities, Financeiro, Marketing, RH, TI e Comercial; Outros = sócios, conta corrente de clientes e afins. Sem impostos sobre faturamento. Em 2025, folha reclassificada pela pessoa."
      >
        <TabelaMeses
          ano={2025}
          linhas={[
            { rotulo: 'Pessoas das áreas', valores: b25.pessoas },
            { rotulo: 'Demais das áreas', valores: b25.demais },
            { rotulo: 'Controladoria', valores: b25.ctrl },
            { rotulo: 'Estrutura', valores: b25.estrutura },
            { rotulo: 'Outros', valores: b25.outros },
            {
              rotulo: 'Total',
              valores: b25.pessoas.map((v, i) => v + b25.demais[i] + b25.ctrl[i] + b25.estrutura[i] + b25.outros[i]),
              destaque: true,
            },
          ]}
        />
        <div className="mt-4" />
        <TabelaMeses
          ano={2026}
          linhas={[
            { rotulo: 'Pessoas das áreas', valores: b26.pessoas, projetado: base2026.projetado },
            { rotulo: 'Demais das áreas', valores: b26.demais, projetado: base2026.projetado },
            { rotulo: 'Controladoria', valores: b26.ctrl, projetado: base2026.projetado },
            { rotulo: 'Estrutura', valores: b26.estrutura, projetado: base2026.projetado },
            { rotulo: 'Outros', valores: b26.outros, projetado: base2026.projetado },
            {
              rotulo: 'Total',
              valores: b26.pessoas.map((v, i) => v + b26.demais[i] + b26.ctrl[i] + b26.estrutura[i] + b26.outros[i]),
              destaque: true,
              projetado: base2026.projetado,
            },
          ]}
        />
        <p className="mt-2 text-[11px] text-slate-500">Em itálico: nov–dez/26 projetados repetindo {rotuloFechado}/26.</p>
      </Secao>

      <Secao
        titulo="Inadimplência mês a mês"
        subtitulo={`% sobre o previsto do mês. Meta: até ${RECEITA_META_INADIMPLENCIA_PCT}%. 2026 usa o valor congelado no fechamento de cada mês (igual ao painel de Inadimplência); 2025 não tem fechamento congelado, então mostra o que ainda está em aberto hoje dos títulos vencidos em cada mês. A coluna Período traz o acumulado do painel (por grupo de cliente), que não é a soma dos meses.`}
      >
        {in25.isLoading || in26.isLoading ? (
          <CarregandoBloco altura="h-32" />
        ) : (
          <TabelaMeses
            rotuloTotal="Período"
            linhas={[
              { rotulo: 'Inadimplência 2025 (R$)', valores: i25.valor, total: p25.total },
              { rotulo: 'Inadimplência 2025 (%)', valores: i25.pctMes, formato: 'pct', total: p25.pct },
              { rotulo: 'Inadimplência 2026 (R$)', valores: i26.valor, total: p26.total, destaque: true },
              { rotulo: 'Inadimplência 2026 (%)', valores: i26.pctMes, formato: 'pct', total: p26.pct },
            ]}
          />
        )}
      </Secao>

      <Secao
        titulo="Inadimplência por área"
        subtitulo={`Acumulado do período (jan–dez/25 e jan–${rotuloFechado}/26), por grupo de cliente e área. A soma das áreas pode diferir um pouco do total do escritório, que compensa pagamentos entre áreas do mesmo grupo.`}
      >
        {ip25.isLoading || ip26.isLoading ? (
          <CarregandoBloco altura="h-32" />
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Área</th>
                <th className="px-2 py-1.5 text-right font-medium">2025</th>
                <th className="px-2 py-1.5 text-right font-medium">2026</th>
                <th className="px-2 py-1.5 text-right font-medium">Variação</th>
              </tr>
            </thead>
            <tbody>
              {[...AREAS_PLANEJAMENTO.map((a) => ({ k: a.key as string, nome: a.nome })), { k: 'outros', nome: 'Outros departamentos' }].map((a) => (
                <tr key={a.k} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-slate-800">{a.nome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(p25.porArea[a.k] ?? 0)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(p26.porArea[a.k] ?? 0)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <VarPct v={variacaoPct(p26.porArea[a.k] ?? 0, p25.porArea[a.k] ?? 0)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Secao>
    </div>
  )
}
