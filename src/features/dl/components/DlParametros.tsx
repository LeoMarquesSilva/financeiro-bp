import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Lock, Plus, Save, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { formatCurrency } from '@/shared/utils/format'
import { MESES_ABREV } from '@/features/receita/constants'
import {
  useDlAliquotas,
  useDlCarteiraCliente,
  useDlCarteiras,
  useDlClientesArea,
  useDlExcluirGestor,
  useDlFechamentos,
  useDlGestores,
  useDlParametros,
  useDlRegraNegativo,
  useDlResultado,
  useDlSalvarAliquotas,
  useDlSalvarGestor,
  useDlSalvarParametros,
} from '../hooks/useDl'
import type {
  DlArea,
  DlClienteArea,
  DlFechamento,
  DlGestor,
  DlGestorCliente,
  DlMesRow,
  DlParametroMensal,
  DlRegraNegativo,
} from '../types/dl.types'

type Props = {
  ano: number
  areas: DlArea[]
}

type Draft = Record<string, string>

const chave = (area: string, mes: number) => `${area}|${mes}`
const MESES = Array.from({ length: 12 }, (_, i) => i + 1)

function num(v: string | undefined): number | null {
  if (v == null || v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const fmt = (v: number, casas: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas })

const inputCls =
  'h-8 rounded-md border border-slate-200 bg-white px-1.5 text-right text-xs tabular-nums placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

function CabecalhoMeses({ fechados }: { fechados: Set<number> }) {
  return (
    <>
      {MESES.map((m) => (
        <th key={m} className="px-1 py-2 text-center font-medium">
          {fechados.has(m) && <Lock className="mr-0.5 inline h-3 w-3 text-slate-400" aria-label="Mês fechado" />}
          {MESES_ABREV[m - 1]}
        </th>
      ))}
    </>
  )
}

function GradeParametro({
  titulo,
  descricao,
  legenda,
  areas,
  draft,
  automatico,
  casas,
  fechados,
  onChange,
  totalAlvo,
}: {
  titulo: string
  descricao: string
  legenda: string
  areas: DlArea[]
  draft: Draft
  /** Valor que o cálculo usa quando a célula fica em branco (mostrado em cinza). */
  automatico: Draft
  casas: number
  fechados: Set<number>
  onChange: (k: string, v: string) => void
  totalAlvo?: number
}) {
  const totais = MESES.map((mes) =>
    areas.reduce((s, a) => {
      const k = chave(a.area_key, mes)
      return s + (num(draft[k]) ?? num(automatico[k]) ?? 0)
    }, 0),
  )
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
      <p className="mb-3 text-xs text-slate-500">{descricao}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 text-left font-medium">Área</th>
              <CabecalhoMeses fechados={fechados} />
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.area_key} className="border-b border-slate-100">
                <td className="whitespace-nowrap py-1.5 pr-3 text-left text-slate-700">{a.nome}</td>
                {MESES.map((mes) => {
                  const k = chave(a.area_key, mes)
                  return (
                    <td key={mes} className="px-1 py-1">
                      <input
                        inputMode="decimal"
                        value={draft[k] ?? ''}
                        placeholder={automatico[k] ?? ''}
                        disabled={fechados.has(mes)}
                        onChange={(e) => onChange(k, e.target.value)}
                        className={cn(inputCls, 'w-16')}
                        aria-label={`${a.nome} ${MESES_ABREV[mes - 1]}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="bg-slate-50 text-xs font-semibold text-slate-700">
              <td className="py-2 pr-3 text-left">Total</td>
              {totais.map((t, i) => (
                <td
                  key={i}
                  className={cn(
                    'px-1 py-2 text-right tabular-nums',
                    totalAlvo != null && t > 0 && Math.abs(t - totalAlvo) > 0.05 && 'text-rose-700',
                  )}
                >
                  {t > 0 ? fmt(t, casas) : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        {legenda} Mês fechado não pode ser alterado.
        {totalAlvo != null && ` O total de cada mês precisa fechar em ${totalAlvo}%.`}
      </p>
    </section>
  )
}

/** Clientes da área com caixa no ano. Sem marcação = entrou automaticamente (cliente novo). */
function CarteiraGestor({
  gestor,
  ano,
  clientes,
  linhas,
}: {
  gestor: DlGestor
  ano: number
  clientes: DlClienteArea[]
  linhas: Map<string, boolean>
}) {
  const mutar = useDlCarteiraCliente()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'novos' | 'excluidos'>('todos')
  const termo = busca.trim().toLowerCase()

  const daArea = useMemo(
    () =>
      clientes
        .filter((c) => c.area_key === gestor.area_key)
        .map((c) => ({ ...c, incluido: linhas.get(c.cliente) ?? true, novo: !linhas.has(c.cliente) })),
    [clientes, gestor.area_key, linhas],
  )
  const lista = daArea.filter(
    (c) =>
      (!termo || c.cliente.toLowerCase().includes(termo)) &&
      (filtro === 'todos' || (filtro === 'novos' ? c.novo : !c.incluido)),
  )
  const incluidos = daArea.filter((c) => c.incluido).length
  const novos = daArea.filter((c) => c.novo).length

  const alternar = (cliente: string, incluir: boolean) =>
    mutar.mutate(
      { gestorId: gestor.id, cliente, incluir },
      { onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao salvar carteira') },
    )

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{incluidos}</span> de {daArea.length} clientes com recebimento
          em {ano} entram no DL de {gestor.nome}
          {novos > 0 && (
            <>
              {' '}
              · <span className="font-semibold text-emerald-700">{novos} novos</span> entraram automaticamente
            </>
          )}
          . Desmarque para excluir.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as typeof filtro)}
            className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs"
            aria-label="Filtrar clientes"
          >
            <option value="todos">Todos</option>
            <option value="novos">Só novos</option>
            <option value="excluidos">Só excluídos</option>
          </select>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente"
              className="h-8 w-56 rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs"
            />
          </label>
        </div>
      </div>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-white">
        {lista.map((c) => (
          <li key={c.cliente}>
            <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-slate-50">
              <input
                type="checkbox"
                checked={c.incluido}
                onChange={(e) => alternar(c.cliente, e.target.checked)}
                disabled={mutar.isPending}
              />
              <span className={cn('flex-1 truncate', c.incluido ? 'text-slate-900' : 'text-slate-400 line-through')}>
                {c.cliente}
              </span>
              {c.novo && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  novo
                </span>
              )}
              <span className="tabular-nums text-slate-400">{formatCurrency(c.liquido)}</span>
            </label>
          </li>
        ))}
        {lista.length === 0 && <li className="px-2.5 py-3 text-center text-xs text-slate-400">Nenhum cliente encontrado</li>}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">
        Mudar a carteira altera o DL de meses já fechados: a diferença entra como ajuste no próximo mês.
      </p>
    </div>
  )
}

function GestorLinha({
  gestor,
  areas,
  ano,
  resumoCarteira,
  aberto,
  onToggle,
}: {
  gestor: DlGestor | null
  areas: DlArea[]
  ano: number
  resumoCarteira?: { incluidos: number; novos: number }
  aberto?: boolean
  onToggle?: () => void
}) {
  const salvar = useDlSalvarGestor()
  const excluir = useDlExcluirGestor()
  const [form, setForm] = useState({
    nome: gestor?.nome ?? '',
    area_key: gestor?.area_key ?? areas[0]?.area_key ?? '',
    pct: String(gestor?.pct ?? ''),
    mes_inicio: gestor?.mes_inicio ?? 1,
    mes_fim: gestor?.mes_fim ?? 12,
  })

  const onSalvar = async () => {
    const pct = num(form.pct)
    if (!form.nome.trim() || pct == null) {
      toast.error('Informe nome e % do gestor')
      return
    }
    try {
      await salvar.mutateAsync({
        id: gestor?.id,
        ano,
        area_key: form.area_key,
        nome: form.nome.trim(),
        pct,
        mes_inicio: form.mes_inicio,
        mes_fim: Math.max(form.mes_inicio, form.mes_fim),
      })
      toast.success('Gestor salvo')
      if (!gestor) setForm({ ...form, nome: '', pct: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar gestor')
    }
  }

  const onExcluir = async () => {
    if (!gestor) return
    try {
      await excluir.mutateAsync(gestor.id)
      toast.success('Gestor removido')
    } catch {
      toast.error('Gestor com mês fechado não pode ser removido: encerre a vigência no mês em que saiu.')
    }
  }

  const sel = 'h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs'
  return (
    <tr className="border-b border-slate-100">
      <td className="py-1.5 pr-2">
        <input
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Nome"
          className={cn(sel, 'w-36')}
        />
      </td>
      <td className="px-2 py-1.5">
        <select value={form.area_key} onChange={(e) => setForm({ ...form, area_key: e.target.value })} className={sel}>
          {areas.map((a) => (
            <option key={a.area_key} value={a.area_key}>
              {a.nome}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input
          inputMode="decimal"
          value={form.pct}
          onChange={(e) => setForm({ ...form, pct: e.target.value })}
          placeholder="%"
          className={cn(sel, 'w-16 text-right')}
        />
      </td>
      <td className="px-2 py-1.5">
        <select
          value={form.mes_inicio}
          onChange={(e) => setForm({ ...form, mes_inicio: Number(e.target.value) })}
          className={sel}
        >
          {MESES.map((m) => (
            <option key={m} value={m}>
              {MESES_ABREV[m - 1]}
            </option>
          ))}
        </select>
        <span className="mx-1 text-xs text-slate-400">até</span>
        <select value={form.mes_fim} onChange={(e) => setForm({ ...form, mes_fim: Number(e.target.value) })} className={sel}>
          {MESES.map((m) => (
            <option key={m} value={m}>
              {MESES_ABREV[m - 1]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5">
        {gestor && (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
          >
            {aberto ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {`${resumoCarteira?.incluidos ?? 0} clientes no DL`}
            {resumoCarteira && resumoCarteira.novos > 0 && (
              <span className="text-emerald-700">· {resumoCarteira.novos} novos</span>
            )}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap py-1.5 pl-2 text-right">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => void onSalvar()} disabled={salvar.isPending}>
          {gestor ? <Save className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
          {gestor ? 'Salvar' : 'Adicionar'}
        </Button>
        {gestor && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-1 h-8 text-rose-600"
            onClick={() => void onExcluir()}
            disabled={excluir.isPending}
            aria-label={`Remover ${gestor.nome}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </td>
    </tr>
  )
}

function RegraNegativo({ areas, gestores }: { areas: DlArea[]; gestores: DlGestor[] }) {
  const salvar = useDlRegraNegativo()
  const comGestor = areas.filter((a) => gestores.some((g) => g.area_key === a.area_key))
  const onChange = (areaKey: string, regra: DlRegraNegativo) =>
    salvar.mutate(
      { areaKey, regra },
      {
        onSuccess: () => toast.success('Regra do negativo salva. DL recalculado.'),
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao salvar a regra'),
      },
    )
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900">Regra do DL negativo</h3>
      <p className="mb-3 text-xs text-slate-500">
        Mensal: mês negativo vira zero e não desconta dos outros meses. Acumulado: o negativo compensa no ano (o DL
        pago até o mês nunca passa do % sobre o resultado acumulado). Pendente de definição dos sócios.
      </p>
      <div className="flex flex-wrap gap-3">
        {comGestor.map((a) => (
          <label key={a.area_key} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
            {a.nome}
            <select
              value={a.regra_negativo}
              onChange={(e) => onChange(a.area_key, e.target.value as DlRegraNegativo)}
              disabled={salvar.isPending}
              className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs"
            >
              <option value="mensal">Mensal</option>
              <option value="acumulado">Acumulado no ano</option>
            </select>
          </label>
        ))}
      </div>
    </section>
  )
}

export function DlParametros({ ano, areas }: Props) {
  const { user } = useAuth()
  const { data: parametros, isLoading } = useDlParametros(ano)
  const { data: resultado } = useDlResultado(ano)
  const { data: aliquotasData } = useDlAliquotas(ano)
  const { data: fechamentosData } = useDlFechamentos(ano)
  const { data: gestoresData } = useDlGestores(ano)
  const gestores: DlGestor[] = useMemo(() => gestoresData ?? [], [gestoresData])
  const { data: clientesArea } = useDlClientesArea(ano)
  const { data: carteirasData } = useDlCarteiras(gestores.map((g) => g.id))
  const salvar = useDlSalvarParametros(user?.email ?? null)
  const salvarAliquotas = useDlSalvarAliquotas(ano, user?.email ?? null)
  const [gestorAberto, setGestorAberto] = useState<string | null>(null)

  const fechados = useMemo(() => new Set(((fechamentosData ?? []) as DlFechamento[]).map((f) => f.mes)), [fechamentosData])

  /** Por gestor: cliente → incluído? (sem linha = entra automaticamente). */
  const carteiras = useMemo(() => {
    const m = new Map<string, Map<string, boolean>>()
    for (const c of (carteirasData ?? []) as DlGestorCliente[]) {
      if (!m.has(c.gestor_id)) m.set(c.gestor_id, new Map())
      m.get(c.gestor_id)!.set(c.cliente, c.incluido)
    }
    return m
  }, [carteirasData])

  const resumoCarteira = (g: DlGestor) => {
    const linhas = carteiras.get(g.id) ?? new Map<string, boolean>()
    const daArea = ((clientesArea ?? []) as DlClienteArea[]).filter((c) => c.area_key === g.area_key)
    return {
      incluidos: daArea.filter((c) => linhas.get(c.cliente) ?? true).length,
      novos: daArea.filter((c) => !linhas.has(c.cliente)).length,
    }
  }

  const linhasMes = useMemo(() => (resultado ?? []) as DlMesRow[], [resultado])
  const prolabore = MESES.map((mes) => linhasMes.find((r) => r.mes === mes)?.socios_prolabore ?? 0)

  /** O que o cálculo usa hoje em cada célula (placeholder quando não há valor digitado). */
  const automatico = useMemo(() => {
    const prof: Draft = {}
    const pct: Draft = {}
    const aliq: Draft = {}
    for (const r of linhasMes) {
      prof[chave(r.area_key, r.mes)] = fmt(r.profissionais, 0)
      pct[chave(r.area_key, r.mes)] = r.origem_controladoria === 'sem_dado' ? '' : fmt(r.pct_controladoria, 2)
      aliq[String(r.mes)] = fmt(r.aliquota, 4)
    }
    return { prof, pct, aliq }
  }, [linhasMes])

  const inicial = useMemo(() => {
    const prof: Draft = {}
    const pct: Draft = {}
    const aliq: Draft = {}
    for (const p of parametros ?? []) {
      if (p.profissionais != null) prof[chave(p.area_key, p.mes)] = String(p.profissionais)
      if (p.pct_controladoria != null) pct[chave(p.area_key, p.mes)] = String(p.pct_controladoria)
    }
    for (const a of aliquotasData ?? []) aliq[String(a.mes)] = String(a.aliquota)
    return { prof, pct, aliq }
  }, [parametros, aliquotasData])

  const [prof, setProf] = useState<Draft>({})
  const [pct, setPct] = useState<Draft>({})
  const [aliq, setAliq] = useState<Draft>({})
  useEffect(() => {
    setProf(inicial.prof)
    setPct(inicial.pct)
    setAliq(inicial.aliq)
  }, [inicial])

  const alterado =
    JSON.stringify(prof) !== JSON.stringify(inicial.prof) ||
    JSON.stringify(pct) !== JSON.stringify(inicial.pct) ||
    JSON.stringify(aliq) !== JSON.stringify(inicial.aliq)

  const onSalvar = async () => {
    const mensais: DlParametroMensal[] = []
    for (const a of areas) {
      for (const mes of MESES) {
        if (fechados.has(mes)) continue
        const k = chave(a.area_key, mes)
        const p = num(prof[k])
        const c = num(pct[k])
        if (p === num(inicial.prof[k]) && c === num(inicial.pct[k])) continue
        mensais.push({ ano, mes, area_key: a.area_key, profissionais: p, pct_controladoria: c })
      }
    }
    const aliqSalvar = []
    const aliqApagar: number[] = []
    for (const mes of MESES) {
      if (fechados.has(mes)) continue
      const v = num(aliq[String(mes)])
      const antes = num(inicial.aliq[String(mes)])
      if (v === antes) continue
      if (v == null) aliqApagar.push(mes)
      else if (v <= 0 || v >= 100) {
        toast.error(`Alíquota de ${MESES_ABREV[mes - 1]} inválida`)
        return
      } else aliqSalvar.push({ ano, mes, aliquota: v })
    }
    try {
      await salvar.mutateAsync(mensais)
      await salvarAliquotas.mutateAsync({ salvar: aliqSalvar, apagarMeses: aliqApagar })
      toast.success('Parâmetros salvos. DL recalculado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar parâmetros')
    }
  }

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />

  const salvando = salvar.isPending || salvarAliquotas.isPending

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
        <p className="max-w-3xl">
          Receitas e despesas vêm direto do SIOE. Profissionais (cadastro de RH) e % da Controladoria (Fechamento
          Legal Ops) também são automáticos: o valor em cinza é o que o cálculo usa. Digite só para corrigir um mês. A
          alíquota do imposto vem da contabilidade e precisa ser informada todo mês.
        </p>
        <Button type="button" size="sm" className="gap-2" onClick={() => void onSalvar()} disabled={!alterado || salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Salvar parâmetros
        </Button>
      </div>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900">Alíquota do imposto (%)</h3>
        <p className="mb-3 text-xs text-slate-500">
          Alíquota efetiva do mês (Simples Nacional; muda com o faturamento e com a migração para o Lucro Presumido).
          Aplicada sobre os recebimentos com NFS-e. Mês em branco usa a do último mês cadastrado (cinza).
        </p>
        <div className="flex flex-wrap gap-2">
          {MESES.map((mes) => {
            const herdada = !inicial.aliq[String(mes)] && linhasMes.some((r) => r.mes === mes && r.receita_bruta > 0)
            return (
              <label key={mes} className="flex w-20 flex-col text-[11px] font-medium uppercase text-slate-500">
                <span>
                  {fechados.has(mes) && <Lock className="mr-0.5 inline h-3 w-3 text-slate-400" aria-hidden />}
                  {MESES_ABREV[mes - 1]}
                  {herdada && !aliq[String(mes)] && <span className="ml-0.5 text-rose-500">ª</span>}
                </span>
                <input
                  inputMode="decimal"
                  value={aliq[String(mes)] ?? ''}
                  placeholder={automatico.aliq[String(mes)] ?? ''}
                  disabled={fechados.has(mes)}
                  onChange={(e) => setAliq((d) => ({ ...d, [String(mes)]: e.target.value }))}
                  className={cn(inputCls, 'mt-0.5 w-full normal-case')}
                  aria-label={`Alíquota ${MESES_ABREV[mes - 1]}`}
                />
              </label>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">ª mês com recebimento e sem alíquota cadastrada.</p>
      </section>

      <GradeParametro
        titulo="Profissionais por área"
        descricao="Base do rateio das despesas indiretas (indiretas ÷ total de profissionais × profissionais da área)."
        legenda="Em branco = cadastro de RH: quem trabalhou ao menos um dia no mês na área (quem entra no último dia conta no mês seguinte; advogado parceiro não conta)."
        areas={areas}
        draft={prof}
        automatico={automatico.prof}
        casas={1}
        fechados={fechados}
        onChange={(k, v) => setProf((d) => ({ ...d, [k]: v }))}
      />
      <GradeParametro
        titulo="% de horas da Ops (rateio da Controladoria)"
        descricao="Participação de cada área nas horas da equipe de Operações Legais (timesheet); aplica-se sobre as despesas de Operações Legais."
        legenda="Em branco = Fechamento Legal Ops do mês (sem o do mês, usa o último gravado)."
        areas={areas}
        draft={pct}
        automatico={automatico.pct}
        casas={2}
        fechados={fechados}
        onChange={(k, v) => setPct((d) => ({ ...d, [k]: v }))}
        totalAlvo={100}
      />

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900">Parcela fixa dos sócios (pró-labore)</h3>
        <p className="mb-3 text-xs text-slate-500">
          Vem do VIOS (plano PRÓ-LABORE) e é somada às despesas indiretas antes do rateio por profissionais.
        </p>
        <div className="flex flex-wrap gap-2">
          {MESES.map((mes, i) => (
            <div key={mes} className="flex w-24 flex-col text-[11px] font-medium uppercase text-slate-500">
              {MESES_ABREV[mes - 1]}
              <span className="mt-0.5 flex h-8 items-center justify-end rounded-md border border-slate-100 bg-slate-50 px-1.5 text-xs normal-case tabular-nums text-slate-700">
                {prolabore[i]! > 0 ? formatCurrency(prolabore[i]!).replace(',00', '') : '—'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900">Gestores e % de DL</h3>
        <p className="mb-3 text-xs text-slate-500">
          DL do gestor = % × resultado dos clientes da carteira (líquido do cliente − despesas da área rateadas pela
          receita líquida). Cliente novo da área entra na carteira automaticamente; quem estava com 0% na planilha
          ficou excluído. O mês negativo segue a regra da área (abaixo).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2 text-left font-medium">Gestor</th>
                <th className="px-2 py-2 text-left font-medium">Área</th>
                <th className="px-2 py-2 text-left font-medium">%</th>
                <th className="px-2 py-2 text-left font-medium">Vigência</th>
                <th className="px-2 py-2 text-left font-medium">Carteira</th>
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody>
              {gestores.map((g) => (
                <Fragment key={`${g.id}-${g.pct}-${g.nome}-${g.mes_inicio}-${g.mes_fim}`}>
                  <GestorLinha
                    gestor={g}
                    areas={areas}
                    ano={ano}
                    resumoCarteira={resumoCarteira(g)}
                    aberto={gestorAberto === g.id}
                    onToggle={() => setGestorAberto((a) => (a === g.id ? null : g.id))}
                  />
                  {gestorAberto === g.id && (
                    <tr>
                      <td colSpan={6} className="pb-3 pt-1">
                        <CarteiraGestor
                          gestor={g}
                          ano={ano}
                          clientes={clientesArea ?? []}
                          linhas={carteiras.get(g.id) ?? new Map()}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              <GestorLinha gestor={null} areas={areas} ano={ano} />
            </tbody>
          </table>
        </div>
      </section>

      <RegraNegativo areas={areas} gestores={gestores} />
    </div>
  )
}
