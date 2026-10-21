import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ModalConfirmacao } from '@/components/ui/modal-confirmacao'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import { valorNovaReceitaPorMes } from '../utils/receitaMeCalc'
import {
  RECEITA_ME_CHANCE_CLASS,
  RECEITA_ME_CHANCE_LABELS,
  RECEITA_ME_ORIGEM_LABELS,
  RECEITA_ME_TIPOS_RECEITA,
  receitaMeMesRotulo,
} from '../utils/receitaMeLabels'
import type {
  ReceitaMeChance,
  ReceitaMeNovaReceita,
  ReceitaMeNovaReceitaInput,
  ReceitaMeOrigem,
  ReceitaMeRecorrencia,
} from '../types/receitaMe.types'

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

type Props = {
  ano: number
  areaKey: string
  meses: number[]
  novasReceitas: ReceitaMeNovaReceita[]
  gruposConhecidos: string[]
  podeEditar: boolean
  salvando: boolean
  onSalvar: (input: ReceitaMeNovaReceitaInput) => Promise<void>
  onRemover: (id: string) => Promise<void>
}

type Form = {
  id?: string
  nome: string
  origem: ReceitaMeOrigem
  tipo_receita: string
  recorrencia: ReceitaMeRecorrencia
  mes_inicio: number
  mes_fim: number
  valor: string
  chance: ReceitaMeChance
  observacao: string
  meses_baixados: number[]
}

function formVazio(meses: number[]): Form {
  const primeiro = meses[0] ?? 12
  return {
    nome: '',
    origem: 'lead',
    tipo_receita: '',
    recorrencia: 'pontual',
    mes_inicio: primeiro,
    mes_fim: meses[meses.length - 1] ?? 12,
    valor: '',
    chance: 'media',
    observacao: '',
    meses_baixados: [],
  }
}

function parseValor(raw: string): number {
  const limpo = raw.replace(/[^\d,.-]/g, '')
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : 0
}

function descricaoMeses(ano: number, nr: ReceitaMeNovaReceita): string {
  if (nr.recorrencia === 'pontual') return `Pontual em ${receitaMeMesRotulo(ano, nr.mes_inicio)}`
  return `Mensal ${receitaMeMesRotulo(ano, nr.mes_inicio)}–${receitaMeMesRotulo(ano, nr.mes_fim)}`
}

export function ReceitaMeNovasReceitas({
  ano,
  areaKey,
  meses,
  novasReceitas,
  gruposConhecidos,
  podeEditar,
  salvando,
  onSalvar,
  onRemover,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState<Form>(() => formVazio(meses))
  const [erro, setErro] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<ReceitaMeNovaReceita | null>(null)

  useEffect(() => {
    if (!aberto) setErro(null)
  }, [aberto])

  const linhas = useMemo(
    () =>
      novasReceitas
        .filter((n) => n.area_key === areaKey)
        .map((n) => {
          const porMes = valorNovaReceitaPorMes(n, meses)
          return { nr: n, noHorizonte: Object.values(porMes).reduce((s, v) => s + v, 0) }
        }),
    [novasReceitas, areaKey, meses],
  )
  const totalMe = linhas.filter((l) => l.nr.chance !== 'baixa').reduce((s, l) => s + l.noHorizonte, 0)
  const potencial = linhas.filter((l) => l.nr.chance === 'baixa').reduce((s, l) => s + l.noHorizonte, 0)
  const gruposSet = useMemo(() => new Set(gruposConhecidos), [gruposConhecidos])
  /** Meses do horizonte; na edição, inclui os já salvos mesmo que tenham passado. */
  const opcoesMeses = useMemo(
    () => [...new Set([...meses, form.mes_inicio, form.mes_fim])].sort((a, b) => a - b),
    [meses, form.mes_inicio, form.mes_fim],
  )
  const datalistId = `me-grupos-${areaKey}`

  const abrirNova = () => {
    setForm(formVazio(meses))
    setAberto(true)
  }

  const abrirEdicao = (nr: ReceitaMeNovaReceita) => {
    setForm({
      id: nr.id,
      nome: nr.nome,
      origem: nr.origem,
      tipo_receita: nr.tipo_receita ?? '',
      recorrencia: nr.recorrencia,
      mes_inicio: nr.mes_inicio,
      mes_fim: nr.mes_fim,
      valor: String(nr.valor).replace('.', ','),
      chance: nr.chance,
      observacao: nr.observacao ?? '',
      meses_baixados: nr.meses_baixados,
    })
    setAberto(true)
  }

  const salvar = async () => {
    const nome = form.nome.trim()
    const valor = parseValor(form.valor)
    if (!nome) {
      setErro('Informe o cliente ou lead.')
      return
    }
    if (!(valor > 0)) {
      setErro('Informe um valor maior que zero.')
      return
    }
    if (form.recorrencia === 'mensal' && form.mes_fim < form.mes_inicio) {
      setErro('O mês final precisa ser igual ou depois do inicial.')
      return
    }
    const grupo = gruposSet.has(nome) ? nome : null
    try {
      await onSalvar({
        id: form.id,
        ano,
        area_key: areaKey,
        nome,
        grupo_cliente: grupo,
        origem: grupo && form.origem === 'lead' ? 'cliente_existente' : form.origem,
        tipo_receita: form.tipo_receita || null,
        recorrencia: form.recorrencia,
        mes_inicio: form.mes_inicio,
        mes_fim: form.recorrencia === 'pontual' ? form.mes_inicio : form.mes_fim,
        valor,
        chance: form.chance,
        observacao: form.observacao || null,
        meses_baixados: form.meses_baixados,
      })
      setAberto(false)
    } catch {
      // O toast de erro vem da mutation; o formulário fica aberto para tentar de novo.
    }
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setErro(null)
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Novas receitas até dezembro</h3>
          <p className="text-xs text-slate-500">
            Cliente existente, lead ou êxito que ainda não virou título no VIOS. Chance baixa fica como potencial,
            fora da estimativa.
          </p>
        </div>
        {podeEditar && meses.length > 0 && (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={abrirNova}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Incluir nova receita
          </Button>
        )}
      </div>

      {linhas.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma nova receita informada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-left font-semibold">Cliente ou lead</th>
                <th className="px-3 py-2 text-left font-semibold">Origem</th>
                <th className="px-3 py-2 text-left font-semibold">Quando</th>
                <th className="px-3 py-2 text-right font-semibold">Valor</th>
                <th className="px-3 py-2 text-right font-semibold">No horizonte</th>
                <th className="px-3 py-2 text-left font-semibold">Chance</th>
                <th className="w-16 px-2 py-2" aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ nr, noHorizonte }) => (
                <tr key={nr.id} className="border-b border-slate-100 last:border-0">
                  <td className="max-w-[240px] px-3 py-2 text-slate-800">
                    <p className="truncate" title={nr.nome}>{nr.nome}</p>
                    {(nr.tipo_receita || nr.observacao) && (
                      <p className="truncate text-[11px] text-slate-500" title={nr.observacao ?? undefined}>
                        {[nr.tipo_receita, nr.observacao].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{RECEITA_ME_ORIGEM_LABELS[nr.origem]}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {descricaoMeses(ano, nr)}
                    {nr.meses_baixados.length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        Virou título em {nr.meses_baixados.map((m) => receitaMeMesRotulo(ano, m)).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700" title={formatCurrency(nr.valor)}>
                    {formatCurrencyCompact(nr.valor)}
                    {nr.recorrencia === 'mensal' ? '/mês' : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900" title={formatCurrency(noHorizonte)}>
                    {formatCurrencyCompact(noHorizonte)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', RECEITA_ME_CHANCE_CLASS[nr.chance])}>
                      {RECEITA_ME_CHANCE_LABELS[nr.chance]}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {podeEditar && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => abrirEdicao(nr)}
                          aria-label={`Editar ${nr.nome}`}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setRemovendo(nr)}
                          aria-label={`Remover ${nr.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-slate-900">
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2 font-semibold" colSpan={4}>
                  Na estimativa
                  {potencial > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      + {formatCurrencyCompact(potencial)} de potencial (chance baixa)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrencyCompact(totalMe)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar nova receita' : 'Incluir nova receita'}</DialogTitle>
            <DialogDescription>Entra na melhor estimativa da área a partir do mês informado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 px-6 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="me-nome">Cliente ou lead</Label>
              <Input
                id="me-nome"
                list={datalistId}
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Grupo Metalcasty"
                autoFocus
              />
              <datalist id={datalistId}>
                {gruposConhecidos.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-slate-500">
                Escolha um grupo da lista para cliente existente. Assim, quando o título aparecer no VIOS, o sistema avisa
                para baixar a estimativa.
              </p>
            </div>
            <div>
              <Label htmlFor="me-origem">Origem</Label>
              <select id="me-origem" className={SELECT_CLASS} value={form.origem} onChange={(e) => set('origem', e.target.value as ReceitaMeOrigem)}>
                {(Object.keys(RECEITA_ME_ORIGEM_LABELS) as ReceitaMeOrigem[]).map((o) => (
                  <option key={o} value={o}>
                    {RECEITA_ME_ORIGEM_LABELS[o]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="me-tipo">Tipo de receita</Label>
              <select id="me-tipo" className={SELECT_CLASS} value={form.tipo_receita} onChange={(e) => set('tipo_receita', e.target.value)}>
                <option value="">Não informado</option>
                {RECEITA_ME_TIPOS_RECEITA.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="me-recorrencia">Recorrência</Label>
              <select
                id="me-recorrencia"
                className={SELECT_CLASS}
                value={form.recorrencia}
                onChange={(e) => set('recorrencia', e.target.value as ReceitaMeRecorrencia)}
              >
                <option value="pontual">Pontual (um mês)</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
            <div>
              <Label htmlFor="me-valor">{form.recorrencia === 'mensal' ? 'Valor por mês' : 'Valor'}</Label>
              <Input
                id="me-valor"
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => set('valor', e.target.value)}
                placeholder="8.000,00"
              />
            </div>
            <div>
              <Label htmlFor="me-mes-inicio">{form.recorrencia === 'mensal' ? 'A partir de' : 'Mês'}</Label>
              <select
                id="me-mes-inicio"
                className={SELECT_CLASS}
                value={form.mes_inicio}
                onChange={(e) => set('mes_inicio', Number(e.target.value))}
              >
                {opcoesMeses.map((m) => (
                  <option key={m} value={m}>
                    {receitaMeMesRotulo(ano, m)}
                  </option>
                ))}
              </select>
            </div>
            {form.recorrencia === 'mensal' ? (
              <div>
                <Label htmlFor="me-mes-fim">Até</Label>
                <select
                  id="me-mes-fim"
                  className={SELECT_CLASS}
                  value={form.mes_fim}
                  onChange={(e) => set('mes_fim', Number(e.target.value))}
                >
                  {opcoesMeses.map((m) => (
                    <option key={m} value={m}>
                      {receitaMeMesRotulo(ano, m)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div />
            )}
            <div className="sm:col-span-2">
              <Label>Chance de entrar</Label>
              <div className="mt-1 flex gap-2" role="radiogroup" aria-label="Chance de entrar">
                {(Object.keys(RECEITA_ME_CHANCE_LABELS) as ReceitaMeChance[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={form.chance === c}
                    onClick={() => set('chance', c)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      form.chance === c ? RECEITA_ME_CHANCE_CLASS[c] : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                    )}
                  >
                    {RECEITA_ME_CHANCE_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="me-obs">Observação</Label>
              <Textarea
                id="me-obs"
                rows={2}
                value={form.observacao}
                onChange={(e) => set('observacao', e.target.value)}
                placeholder="Proposta enviada em 15/10, aguardando aprovação do conselho"
              />
            </div>
            {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModalConfirmacao
        open={removendo != null}
        onClose={() => setRemovendo(null)}
        title="Remover nova receita"
        description={removendo ? `"${removendo.nome}" sai da melhor estimativa. A remoção fica registrada no histórico.` : ''}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={async () => {
          if (removendo) await onRemover(removendo.id)
          setRemovendo(null)
        }}
      />
    </section>
  )
}
