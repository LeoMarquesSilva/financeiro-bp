import { useMemo } from 'react'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/shared/utils/format'
import {
  proximoAjusteAoClicar,
  type ReceitaMeAreaCalc,
  type ReceitaMeCelula,
  type ReceitaMeLinha,
  type ReceitaMeMesAMes,
  type ReceitaMeNovidadeNovo,
  type ReceitaMeNovidadePagou,
} from '../utils/receitaMeCalc'
import { calcularGapMeta, RECEITA_ME_TOLERANCIA } from '../utils/receitaMeCalc'
import { RECEITA_ME_AREAS, receitaMeAreaLabel, receitaMeMesesRotulo } from '../utils/receitaMeLabels'
import type { useReceitaMeMutations } from '../hooks/useReceitaMe'
import type {
  ReceitaMeAreaStatus,
  ReceitaMeNovaReceita,
  ReceitaMeResponsavel,
  ReceitaMeVisto,
} from '../types/receitaMe.types'
import { ReceitaMeMatriz } from './ReceitaMeMatriz'
import { ReceitaMeNovidades } from './ReceitaMeNovidades'
import { ReceitaMeNovasReceitas } from './ReceitaMeNovasReceitas'
import { ReceitaMeMesAMesTabela } from './ReceitaMeMesAMesTabela'
import { ReceitaMeResumoCards } from './ReceitaMeResumoCards'
import { ReceitaMeForaEstimativa } from './ReceitaMeForaEstimativa'

type Mutations = ReturnType<typeof useReceitaMeMutations>

type Props = {
  ano: number
  calc: ReceitaMeAreaCalc
  status: ReceitaMeAreaStatus | undefined
  responsaveis: ReceitaMeResponsavel[]
  novasReceitas: ReceitaMeNovaReceita[]
  mesAMes: ReceitaMeMesAMes[]
  podeEditar: boolean
  mutations: Mutations
}

export function ReceitaMeAreaPanel({
  ano,
  calc,
  status,
  responsaveis,
  novasReceitas,
  mesAMes,
  podeEditar,
  mutations,
}: Props) {
  const areaKey = calc.areaKey
  const confirmada = Boolean(status?.confirmada_em)
  const { meses, mesCorrente } = calc
  const periodo = receitaMeMesesRotulo(ano, meses)

  const gapArea = useMemo(() => calcularGapMeta(mesAMes), [mesAMes])
  const pctArea = RECEITA_ME_AREAS.find((a) => a.key === areaKey)?.pct ?? 0
  const gruposConhecidos = useMemo(() => calc.linhas.map((l) => l.grupo).sort((a, b) => a.localeCompare(b, 'pt-BR')), [calc.linhas])

  const visto = (grupo: string, mes: number, valor: number): ReceitaMeVisto => ({
    ano,
    area_key: areaKey,
    grupo,
    mes,
    valor_visto: valor,
  })

  const onClickCelula = (linha: ReceitaMeLinha, c: ReceitaMeCelula) => {
    const proximo = proximoAjusteAoClicar(c.estado)
    if (proximo === 'ignorar') return
    const chave = { area_key: areaKey, grupo: linha.grupo, mes: c.mes }
    if (proximo == null) mutations.salvarAjustes({ upserts: [], remover: [chave] })
    else mutations.salvarAjustes({ upserts: [{ ...chave, tipo: proximo, valor_marcado: c.aberto }], remover: [] })
  }

  const onClickLinha = (linha: ReceitaMeLinha) => {
    const abertas = meses.map((m) => linha.celulas[m]).filter((c) => c.aberto > RECEITA_ME_TOLERANCIA)
    if (abertas.length === 0) return
    const todasFora = abertas.every((c) => c.estado === 'nao_paga')
    if (todasFora) {
      mutations.salvarAjustes({
        upserts: [],
        remover: abertas.map((c) => ({ area_key: areaKey, grupo: linha.grupo, mes: c.mes })),
      })
    } else {
      mutations.salvarAjustes({
        upserts: abertas.map((c) => ({
          area_key: areaKey,
          grupo: linha.grupo,
          mes: c.mes,
          tipo: 'nao_paga' as const,
          valor_marcado: c.aberto,
        })),
        remover: [],
      })
    }
  }

  const marcarVistosNovidade = (n: ReceitaMeNovidadeNovo) =>
    mutations.marcarVistos(n.meses.map((m) => visto(n.grupo, m.mes, m.previsto)))

  const onNaoPaga = (n: ReceitaMeNovidadeNovo) => {
    const abertas = n.meses.filter((m) => m.aberto > RECEITA_ME_TOLERANCIA)
    mutations.salvarAjustes({
      upserts: abertas.map((m) => ({
        area_key: areaKey,
        grupo: n.grupo,
        mes: m.mes,
        tipo: 'nao_paga' as const,
        valor_marcado: m.aberto,
      })),
      remover: [],
    })
    void marcarVistosNovidade(n)
  }

  const onBaixarEstimativa = async (n: ReceitaMeNovidadeNovo) => {
    if (!n.duplicidade) return
    const nr = novasReceitas.find((x) => x.id === n.duplicidade?.novaReceitaId)
    await mutations.baixarMesesNovaReceita({
      id: n.duplicidade.novaReceitaId,
      meses: [...(nr?.meses_baixados ?? []), ...n.duplicidade.meses],
    })
    await marcarVistosNovidade(n)
  }

  const onEntendiPagamento = (n: ReceitaMeNovidadePagou) => {
    const chave = { area_key: areaKey, grupo: n.grupo, mes: n.mes }
    if (n.abertoAtual <= RECEITA_ME_TOLERANCIA) mutations.salvarAjustes({ upserts: [], remover: [chave] })
    else
      mutations.salvarAjustes({
        upserts: [{ ...chave, tipo: 'nao_paga', valor_marcado: n.abertoAtual }],
        remover: [],
      })
  }

  const onManterTodas = () => {
    const rows = calc.novidades
      .filter((n): n is ReceitaMeNovidadeNovo => n.tipo === 'novo' && !n.duplicidade)
      .flatMap((n) => n.meses.map((m) => visto(n.grupo, m.mes, m.previsto)))
    void mutations.marcarVistos(rows)
  }

  const onConfirmar = () => {
    const rows: ReceitaMeVisto[] = []
    for (const linha of calc.linhas) {
      for (const m of meses) {
        const c = linha.celulas[m]
        if (c.previsto > 0) rows.push(visto(linha.grupo, m, c.previsto))
      }
    }
    void mutations.confirmarArea({ areaKey, vistos: rows })
  }

  const nomesResponsaveis = responsaveis.filter((r) => r.ativo).map((r) => r.nome).join(', ')
  const pendentes = calc.novidades.length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Melhor estimativa · {receitaMeAreaLabel(areaKey)}</h2>
          <p className="text-sm text-slate-500">
            {periodo ? `Horizonte ${periodo}` : 'Ano encerrado'}
            {nomesResponsaveis ? ` · responsável: ${nomesResponsaveis}` : ' · sem responsável cadastrado'}
            {confirmada && status?.confirmada_em
              ? ` · confirmada em ${formatDateTime(status.confirmada_em)}${status.confirmada_por_nome ? ` por ${status.confirmada_por_nome}` : ''}`
              : ''}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
            !confirmada && 'border-slate-200 bg-slate-100 text-slate-600',
            confirmada && pendentes > 0 && 'border-amber-200 bg-amber-50 text-amber-800',
            confirmada && pendentes === 0 && 'border-emerald-200 bg-emerald-50 text-emerald-700',
          )}
        >
          {confirmada ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden />}
          {!confirmada
            ? 'Ainda não confirmada'
            : pendentes > 0
              ? `${pendentes} ${pendentes === 1 ? 'novidade' : 'novidades'} para revisar`
              : 'Em dia'}
        </span>
      </div>

      {!confirmada && meses.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-900">
          <p className="min-w-0 flex-1">
            Revise a carteira abaixo: marque quem não deve pagar e inclua as novas receitas. Depois de confirmar, você só
            volta aqui quando aparecer novidade no VIOS.
          </p>
          {podeEditar && (
            <Button type="button" size="sm" onClick={onConfirmar} disabled={mutations.confirmando}>
              {mutations.confirmando ? 'Confirmando…' : 'Confirmar melhor estimativa'}
            </Button>
          )}
        </div>
      )}

      {confirmada && (
        <ReceitaMeNovidades
          ano={ano}
          novidades={calc.novidades}
          podeEditar={podeEditar}
          onManter={(n) => void marcarVistosNovidade(n)}
          onNaoPaga={onNaoPaga}
          onBaixarEstimativa={(n) => void onBaixarEstimativa(n)}
          onEntendiPagamento={onEntendiPagamento}
          onManterTodas={onManterTodas}
        />
      )}

      <ReceitaMeResumoCards
        ano={ano}
        gap={gapArea}
        periodoMeta={receitaMeMesesRotulo(ano, mesAMes.map((l) => l.mes))}
        periodoMe={periodo}
        mesCorrente={mesCorrente}
        metaHint={`Meta do SIOE × ${pctArea.toLocaleString('pt-BR')}% (contribuição da área)`}
        composicao={{
          recebido: calc.recebido,
          aberto: calc.aberto,
          fora: calc.fora,
          foraAtraso: calc.foraAtraso,
          foraNaoPaga: calc.foraNaoPaga,
          novas: calc.novas,
          potencial: calc.potencial,
          me: calc.meTotal,
        }}
      />

      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Meta da área mês a mês</h3>
          <p className="text-xs text-slate-500">
            Meta variável do SIOE (a mesma da Gestão à vista: o que faltou nos meses fechados vai para os seguintes),
            rateada pela contribuição da área. Meses fechados entram pelo realizado; os abertos, pela melhor estimativa.
            O total e o gap acumulado usam a meta anual.
          </p>
        </div>
        <ReceitaMeMesAMesTabela ano={ano} linhas={mesAMes} compacta />
      </section>

      {meses.length > 0 && (
        <>
          <ReceitaMeMatriz
            ano={ano}
            calc={calc}
            podeEditar={podeEditar}
            onClickCelula={onClickCelula}
            onClickLinha={onClickLinha}
          />
          <ReceitaMeNovasReceitas
            ano={ano}
            areaKey={areaKey}
            meses={meses}
            novasReceitas={novasReceitas}
            gruposConhecidos={gruposConhecidos}
            podeEditar={podeEditar}
            salvando={mutations.salvandoNova}
            onSalvar={async (input) => {
              await mutations.salvarNovaReceita(input)
            }}
            onRemover={async (id) => {
              await mutations.removerNovaReceita(id)
            }}
          />
          <ReceitaMeForaEstimativa ano={ano} calc={calc} />
        </>
      )}
    </div>
  )
}
