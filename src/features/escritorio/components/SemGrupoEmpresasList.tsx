import { useMemo, useState } from 'react'

import type { EscritorioEmpresaRow } from '@/lib/database.types'

import {

  getFinanceiroEmpresa,

  ordenaEmpresasEscritorio,

  temValorFinanceiro,

  valorTotalEmpresa,

  type OrdenacaoSemGrupoEmpresa,

} from '../services/escritorioService'

import { Button } from '@/components/ui/button'

import { Label } from '@/components/ui/label'

import { formatCurrency, formatHorasHHMMSS } from '@/shared/utils/format'

import { Briefcase, Clock, Banknote, ChevronRight, Filter, ArrowUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'



type FiltroSemGrupo = 'processos' | 'timesheet' | 'valor'



interface SemGrupoEmpresasListProps {

  empresas: EscritorioEmpresaRow[]

  onSelectCliente?: (cliente: EscritorioEmpresaRow) => void

}



function temProcessos(e: EscritorioEmpresaRow): boolean {

  return (Number(e.qtd_processos) || 0) > 0

}



function temTimesheet(e: EscritorioEmpresaRow): boolean {

  return (Number(e.horas_total) || 0) > 0

}



const OPCOES_ORDENACAO: { value: OrdenacaoSemGrupoEmpresa; label: string }[] = [

  { value: 'nome', label: 'Nome (A–Z)' },

  { value: 'valor', label: 'Maior valor (total)' },

  { value: 'valor_aberto', label: 'Maior em aberto' },

  { value: 'valor_atraso', label: 'Maior em atraso' },

  { value: 'processos', label: 'Mais processos' },

  { value: 'timesheet', label: 'Mais timesheet' },

]



export function SemGrupoEmpresasList({ empresas, onSelectCliente }: SemGrupoEmpresasListProps) {

  const [filtrosAtivos, setFiltrosAtivos] = useState<Set<FiltroSemGrupo>>(new Set())

  const [ordenacao, setOrdenacao] = useState<OrdenacaoSemGrupoEmpresa>('nome')



  const contagens = useMemo(() => {

    let comProcessos = 0

    let comTimesheet = 0

    let comValor = 0

    for (const e of empresas) {

      if (temProcessos(e)) comProcessos++

      if (temTimesheet(e)) comTimesheet++

      if (temValorFinanceiro(e)) comValor++

    }

    return { comProcessos, comTimesheet, comValor }

  }, [empresas])



  const empresasExibidas = useMemo(() => {

    let list = empresas

    if (filtrosAtivos.size > 0) {

      list = list.filter((e) => {

        if (filtrosAtivos.has('processos') && !temProcessos(e)) return false

        if (filtrosAtivos.has('timesheet') && !temTimesheet(e)) return false

        if (filtrosAtivos.has('valor') && !temValorFinanceiro(e)) return false

        return true

      })

    }

    return ordenaEmpresasEscritorio(list, ordenacao)

  }, [empresas, filtrosAtivos, ordenacao])



  const toggleFiltro = (filtro: FiltroSemGrupo) => {

    setFiltrosAtivos((prev) => {

      const next = new Set(prev)

      if (next.has(filtro)) next.delete(filtro)

      else next.add(filtro)

      return next

    })

  }



  const opcoesFiltro: { key: FiltroSemGrupo; label: string; icon: typeof Briefcase; count: number }[] = [

    { key: 'processos', label: 'Com processos', icon: Briefcase, count: contagens.comProcessos },

    { key: 'timesheet', label: 'Com timesheet', icon: Clock, count: contagens.comTimesheet },

    { key: 'valor', label: 'Com valor', icon: Banknote, count: contagens.comValor },

  ]



  return (

    <div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">

        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">

          Empresas com dados ({empresas.length})

          {(filtrosAtivos.size > 0 || ordenacao !== 'nome') && (

            <span className="ml-1 normal-case text-slate-400">

              — mostrando {empresasExibidas.length}

            </span>

          )}

        </p>

      </div>



      <div className="mb-2 flex flex-wrap items-center gap-1.5">

        <Filter className="h-3.5 w-3.5 shrink-0 text-slate-400" />

        {opcoesFiltro.map(({ key, label, icon: Icon, count }) => (

          <Button

            key={key}

            type="button"

            variant={filtrosAtivos.has(key) ? 'default' : 'outline'}

            size="sm"

            onClick={() => toggleFiltro(key)}

            className={cn('h-7 px-2 text-xs', filtrosAtivos.has(key) && 'ring-1 ring-slate-400')}

          >

            <Icon className="mr-1 h-3 w-3" />

            {label} ({count})

          </Button>

        ))}

        {filtrosAtivos.size > 0 && (

          <Button

            type="button"

            variant="ghost"

            size="sm"

            onClick={() => setFiltrosAtivos(new Set())}

            className="h-7 px-2 text-xs text-slate-500"

          >

            Limpar filtros

          </Button>

        )}

      </div>



      <div className="mb-2 flex flex-wrap items-center gap-2">

        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />

        <Label htmlFor="ordenacao-sem-grupo" className="text-xs font-medium text-slate-600">

          Ordenar:

        </Label>

        <select

          id="ordenacao-sem-grupo"

          value={ordenacao}

          onChange={(e) => setOrdenacao(e.target.value as OrdenacaoSemGrupoEmpresa)}

          className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"

        >

          {OPCOES_ORDENACAO.map(({ value, label }) => (

            <option key={value} value={value}>

              {label}

            </option>

          ))}

        </select>

      </div>



      <div

        className={cn(

          'overflow-y-auto rounded border border-slate-200 bg-slate-50/50',

          empresas.length > 15 ? 'max-h-[70vh]' : 'max-h-96'

        )}

      >

        <table className="w-full text-sm">

          <thead className="sticky top-0 border-b border-slate-200 bg-slate-100/90 text-xs font-medium uppercase tracking-wide text-slate-500">

            <tr>

              <th className="px-3 py-2 text-left">Empresa</th>

              <th className="hidden w-16 px-2 py-2 text-right sm:table-cell">Proc.</th>

              <th className="hidden w-24 px-2 py-2 text-right md:table-cell">TimeSheet</th>

              <th className="hidden w-24 px-2 py-2 text-right lg:table-cell">Valor</th>

              {onSelectCliente && <th className="w-8 px-1 py-2" aria-hidden />}

            </tr>

          </thead>

          <tbody>

            {empresasExibidas.length === 0 ? (

              <tr>

                <td colSpan={onSelectCliente ? 5 : 4} className="px-3 py-4 text-center italic text-slate-400">

                  Nenhuma empresa corresponde aos filtros

                </td>

              </tr>

            ) : (

              empresasExibidas.map((e) => {

                const processos = Number(e.qtd_processos) || 0

                const horas = Number(e.horas_total) || 0

                const valor = valorTotalEmpresa(e)

                const fin = getFinanceiroEmpresa(e)



                return (

                  <tr key={e.id} className="border-b border-slate-100 last:border-0">

                    <td className="px-1 py-0.5">

                      <button

                        type="button"

                        onClick={() => onSelectCliente?.(e)}

                        disabled={!onSelectCliente}

                        className={cn(

                          'flex w-full items-center gap-1 truncate rounded px-2 py-1.5 text-left text-slate-700',

                          onSelectCliente && 'hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-inset'

                        )}

                      >

                        <span className="min-w-0 truncate">{e.nome}</span>

                      </button>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 pb-1 text-xs text-slate-500 sm:hidden">

                        {processos > 0 && (

                          <span>

                            <Briefcase className="mr-0.5 inline h-3 w-3" />

                            {processos}

                          </span>

                        )}

                        {horas > 0 && (

                          <span>

                            <Clock className="mr-0.5 inline h-3 w-3" />

                            {formatHorasHHMMSS(horas)}

                          </span>

                        )}

                        {valor > 0 && (

                          <span>

                            <Banknote className="mr-0.5 inline h-3 w-3" />

                            {formatCurrency(valor)}

                          </span>

                        )}

                      </div>

                    </td>

                    <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-600 sm:table-cell">

                      {processos > 0 ? processos : '–'}

                    </td>

                    <td className="hidden px-2 py-1.5 text-right tabular-nums text-slate-600 md:table-cell">

                      {horas > 0 ? formatHorasHHMMSS(horas) : '–'}

                    </td>

                    <td className="hidden px-2 py-1.5 text-right lg:table-cell">

                      {valor > 0 ? (

                        <span

                          className={cn(

                            'tabular-nums',

                            fin.valorEmAtraso > 0 ? 'font-medium text-red-700' : 'text-slate-600'

                          )}

                          title={

                            fin.valorEmAtraso > 0

                              ? `${formatCurrency(fin.valorEmAtraso)} em atraso`

                              : undefined

                          }

                        >

                          {formatCurrency(valor)}

                        </span>

                      ) : (

                        '–'

                      )}

                    </td>

                    {onSelectCliente && (

                      <td className="px-1 py-1.5">

                        <button

                          type="button"

                          onClick={() => onSelectCliente(e)}

                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"

                          aria-label={`Abrir ${e.nome}`}

                        >

                          <ChevronRight className="h-4 w-4" />

                        </button>

                      </td>

                    )}

                  </tr>

                )

              })

            )}

          </tbody>

        </table>

      </div>

    </div>

  )

}


