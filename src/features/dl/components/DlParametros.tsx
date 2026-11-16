import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { formatCurrency } from '@/shared/utils/format'
import { MESES_ABREV } from '@/features/receita/constants'
import {
  useDlCarteiraCliente,
  useDlCarteiras,
  useDlClientesArea,
  useDlExcluirGestor,
  useDlGestores,
  useDlParametros,
  useDlResultado,
  useDlSalvarGestor,
  useDlSalvarParametros,
} from '../hooks/useDl'
import type { DlArea, DlClienteArea, DlGestor, DlMesRow } from '../types/dl.types'

type Props = {
  ano: number
  areas: DlArea[]
}

type Draft = Record<string, string>

const chave = (area: string, mes: number) => `${area}|${mes}`
const MESES = Array.from({ length: 12 }, (_, i) => i + 1)

function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Valor do mês ou, sem cadastro, o último mês anterior (mesma regra do cálculo). */
function herdado(draft: Draft, area: string, mes: number): string {
  for (let m = mes - 1; m >= 1; m--) {
    const v = draft[chave(area, m)]
    if (v != null && v !== '') return v
  }
  return ''
}

function GradeParametro({
  titulo,
  descricao,
  areas,
  draft,
  onChange,
  totalAlvo,
}: {
  titulo: string
  descricao: string
  areas: DlArea[]
  draft: Draft
  onChange: (k: string, v: string) => void
  totalAlvo?: number
}) {
  const totais = MESES.map((mes) =>
    areas.reduce((s, a) => s + (num(draft[chave(a.area_key, mes)] ?? '') ?? num(herdado(draft, a.area_key, mes)) ?? 0), 0),
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
              {MESES.map((m) => (
                <th key={m} className="px-1 py-2 text-center font-medium">
                  {MESES_ABREV[m - 1]}
                </th>
              ))}
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
                        placeholder={herdado(draft, a.area_key, mes)}
                        onChange={(e) => onChange(k, e.target.value)}
                        className="h-8 w-16 rounded-md border border-slate-200 bg-white px-1.5 text-right text-xs tabular-nums placeholder:text-slate-300 focus:border-slate-400 focus:outline-none"
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
                  {t > 0 ? t.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Mês em branco usa o último mês preenchido (valor cinza).
        {totalAlvo != null && ` O total de cada mês precisa fechar em ${totalAlvo}%.`}
      </p>
    </section>
  )
}

/** Clientes da área com caixa no ano; marcados = entram no DL do gestor. */
function CarteiraGestor({
  gestor,
  clientes,
  carteira,
}: {
  gestor: DlGestor
  clientes: DlClienteArea[]
  carteira: Set<string>
}) {
  const mutar = useDlCarteiraCliente()
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  // Cliente da carteira sem recebimento no ano continua listado para poder ser removido.
  const lista = useMemo(() => {
    const daArea = clientes.filter((c) => c.area_key === gestor.area_key)
    const nomes = new Set(daArea.map((c) => c.cliente))
    const semCaixa = [...carteira].filter((c) => !nomes.has(c)).map((cliente) => ({ area_key: gestor.area_key, cliente, liquido: 0 }))
    return [...daArea, ...semCaixa].filter((c) => !termo || c.cliente.toLowerCase().includes(termo))
  }, [clientes, carteira, gestor.area_key, termo])

  const alternar = (cliente: string, incluir: boolean) =>
    mutar.mutate(
      { gestorId: gestor.id, cliente, incluir },
      { onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao salvar carteira') },
    )

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{carteira.size}</span> clientes na carteira de {gestor.nome}.
          Só eles entram no DL do gestor.
        </p>
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
      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-white">
        {lista.map((c) => {
          const marcado = carteira.has(c.cliente)
          return (
            <li key={c.cliente}>
              <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={(e) => alternar(c.cliente, e.target.checked)}
                  disabled={mutar.isPending}
                />
                <span className={cn('flex-1 truncate', marcado ? 'text-slate-900' : 'text-slate-500')}>{c.cliente}</span>
                <span className="tabular-nums text-slate-400">{c.liquido > 0 ? formatCurrency(c.liquido) : 'sem caixa no ano'}</span>
              </label>
            </li>
          )
        })}
        {lista.length === 0 && <li className="px-2.5 py-3 text-center text-xs text-slate-400">Nenhum cliente encontrado</li>}
      </ul>
    </div>
  )
}

function GestorLinha({
  gestor,
  areas,
  ano,
  carteiraQtd,
  aberto,
  onToggle,
}: {
  gestor: DlGestor | null
  areas: DlArea[]
  ano: number
  carteiraQtd?: number
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
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              carteiraQtd ? 'text-slate-700 hover:text-slate-900' : 'text-rose-700',
            )}
          >
            {aberto ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {carteiraQtd ? `${carteiraQtd} clientes` : 'Sem carteira (DL zero)'}
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
            onClick={() => void excluir.mutateAsync(gestor.id).then(() => toast.success('Gestor removido'))}
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

export function DlParametros({ ano, areas }: Props) {
  const { user } = useAuth()
  const { data: parametros, isLoading } = useDlParametros(ano)
  const { data: resultado } = useDlResultado(ano)
  const { data: gestoresData } = useDlGestores(ano)
  const gestores: DlGestor[] = useMemo(() => gestoresData ?? [], [gestoresData])
  const { data: clientesArea } = useDlClientesArea(ano)
  const { data: carteirasData } = useDlCarteiras(gestores.map((g) => g.id))
  const salvar = useDlSalvarParametros(user?.email ?? null)
  const [gestorAberto, setGestorAberto] = useState<string | null>(null)

  const carteiras = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const c of carteirasData ?? []) {
      if (!m.has(c.gestor_id)) m.set(c.gestor_id, new Set())
      m.get(c.gestor_id)!.add(c.cliente)
    }
    return m
  }, [carteirasData])

  const prolabore = useMemo(
    () => MESES.map((mes) => (resultado ?? []).find((r: DlMesRow) => r.mes === mes)?.socios_prolabore ?? 0),
    [resultado],
  )

  const inicial = useMemo(() => {
    const prof: Draft = {}
    const pct: Draft = {}
    for (const p of parametros ?? []) {
      prof[chave(p.area_key, p.mes)] = String(p.profissionais)
      pct[chave(p.area_key, p.mes)] = String(p.pct_controladoria)
    }
    return { prof, pct }
  }, [parametros])

  const [prof, setProf] = useState<Draft>({})
  const [pct, setPct] = useState<Draft>({})
  useEffect(() => {
    setProf(inicial.prof)
    setPct(inicial.pct)
  }, [inicial])

  const alterado =
    JSON.stringify(prof) !== JSON.stringify(inicial.prof) || JSON.stringify(pct) !== JSON.stringify(inicial.pct)

  const onSalvar = async () => {
    const mensais = []
    for (const a of areas) {
      for (const mes of MESES) {
        const k = chave(a.area_key, mes)
        const p = num(prof[k] ?? '')
        const c = num(pct[k] ?? '')
        if (p == null && c == null) continue
        mensais.push({
          ano,
          mes,
          area_key: a.area_key,
          profissionais: p ?? num(herdado(prof, a.area_key, mes)) ?? 0,
          pct_controladoria: c ?? num(herdado(pct, a.area_key, mes)) ?? 0,
        })
      }
    }
    try {
      await salvar.mutateAsync(mensais)
      toast.success('Parâmetros salvos. DL recalculado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar parâmetros')
    }
  }

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
        <p>
          Receitas e despesas vêm direto do SIOE. Aqui ficam só os critérios de rateio, que não existem no VIOS:
          profissionais por área (rateia as despesas indiretas), % de agendamentos (rateia a Controladoria) e o
          % e a carteira de clientes de cada gestor.
        </p>
        <Button type="button" size="sm" className="gap-2" onClick={() => void onSalvar()} disabled={!alterado || salvar.isPending}>
          {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Salvar parâmetros
        </Button>
      </div>

      <GradeParametro
        titulo="Profissionais por área"
        descricao="Base do rateio das despesas indiretas (indiretas ÷ total de profissionais × profissionais da área)."
        areas={areas}
        draft={prof}
        onChange={(k, v) => setProf((d) => ({ ...d, [k]: v }))}
      />
      <GradeParametro
        titulo="% de agendamentos (rateio da Controladoria)"
        descricao="Participação de cada área nos agendamentos; aplica-se sobre as despesas de Operações Legais."
        areas={areas}
        draft={pct}
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
          DL do gestor = % × resultado dos clientes da carteira (líquido do cliente − despesas da área rateadas
          pela receita líquida). Mês negativo vira zero. Gestor sem carteira não recebe DL.
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
                <Fragment key={`${g.id}-${g.pct}-${g.nome}`}>
                  <GestorLinha
                    gestor={g}
                    areas={areas}
                    ano={ano}
                    carteiraQtd={carteiras.get(g.id)?.size ?? 0}
                    aberto={gestorAberto === g.id}
                    onToggle={() => setGestorAberto((a) => (a === g.id ? null : g.id))}
                  />
                  {gestorAberto === g.id && (
                    <tr>
                      <td colSpan={6} className="pb-3 pt-1">
                        <CarteiraGestor gestor={g} clientes={clientesArea ?? []} carteira={carteiras.get(g.id) ?? new Set()} />
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
    </div>
  )
}
