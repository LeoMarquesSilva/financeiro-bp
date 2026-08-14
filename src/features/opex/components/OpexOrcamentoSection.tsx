import { useMemo, useRef, useState, type ComponentProps } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInput, formatDate, formatNumberToCurrencyInput, parseCurrencyBr } from '@/shared/utils/format'
import { MESES_CURTOS, MESES_LONGOS, OPEX_FORNECEDOR_NAO_CADASTRADO } from '../constants'
import { toggleMesFiltro } from '../utils/opexPeriodo'
import { useOpexOrcamento } from '../hooks/useOpexOrcamento'
import { opexOrcamentoService } from '../services/opexOrcamentoService'
import { opexService } from '../services/opexService'
import {
  exportOrcamentoBackupExcel,
  parseOrcamentoXlsxFile,
  type OpexOrcamentoParseResult,
} from '../utils/opexOrcamentoImport'
import {
  countDepartamentosUnicos,
  countFornecedoresUnicos,
  countPlanosContasUnicos,
  countPlanosMicroUnicos,
  departamentoOrcamentoLabel,
  montarDescricaoOrcamento,
  parseFornecedorDescricao,
  planosContasDasLinhas,
} from '../utils/opexOrcamentoGrouping'
import { departamentoLabel } from '../utils/departamentoLabel'
import { OpexOrcamentoMesChart } from './OpexOrcamentoMesChart'
import { OpexOrcamentoHierarchyTable } from './OpexOrcamentoHierarchyTable'
import type { OpexDashboard, OpexOrcamentoLinha } from '../types/opex.types'

function numberToCurrencyInput(value: number): string {
  return formatNumberToCurrencyInput(value)
}

function CurrencyBrInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
        R$
      </span>
      <Input
        {...props}
        value={value}
        onChange={(e) => onValueChange(formatCurrencyInput(e.target.value))}
        onFocus={(e) => e.target.select()}
        className="pl-10 tabular-nums"
        inputMode="numeric"
      />
    </div>
  )
}

type Props = {
  ano: number
}

type LinhaForm = {
  meses: number[]
  grupo_conta: string
  plano_contas: string
  fornecedor: string
  descricao: string
  departamento: string
  valor: string
}

type ValorEditContext = {
  linha: OpexOrcamentoLinha
  titulo: string
  /** Linhas do nível hierárquico — troca de plano/depto propaga a todo o grupo. */
  linhasGrupo?: OpexOrcamentoLinha[]
  editarDepartamento?: boolean
}

type ValorEditGrupoOpts = {
  editarDepartamento?: boolean
}

type DescricaoEditContext = {
  linhas: OpexOrcamentoLinha[]
  titulo: string
}

const emptyForm = (): LinhaForm => ({
  meses: [],
  grupo_conta: '',
  plano_contas: '',
  fornecedor: '',
  descricao: '',
  departamento: '',
  valor: '',
})

const MESES_ANO = Array.from({ length: 12 }, (_, i) => i + 1)

const ORCAMENTO_FIELD_SELECT =
  'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

const ORCAMENTO_MES_CHIP =
  'rounded-lg border px-2 py-2 text-xs font-medium capitalize transition-colors sm:py-1.5'

export function OpexOrcamentoSection({ ano }: Props) {
  const { meta, linhas, isLoading, invalidate } = useOpexOrcamento(ano)
  const fileRef = useRef<HTMLInputElement>(null)

  const [busca, setBusca] = useState('')
  const [mesFiltro, setMesFiltro] = useState<number | null>(null)
  const [importPreview, setImportPreview] = useState<OpexOrcamentoParseResult | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importando, setImportando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<LinhaForm>(emptyForm())
  const [expandido, setExpandido] = useState(false)
  const [planosContasAbertos, setPlanosContasAbertos] = useState<Set<string>>(() => new Set())
  const [planosMicroAbertos, setPlanosMicroAbertos] = useState<Set<string>>(() => new Set())
  const [fornecedoresAbertos, setFornecedoresAbertos] = useState<Set<string>>(() => new Set())
  const [departamentosAbertos, setDepartamentosAbertos] = useState<Set<string>>(() => new Set())
  const [descricoesAbertas, setDescricoesAbertas] = useState<Set<string>>(() => new Set())
  const [valorEdit, setValorEdit] = useState<ValorEditContext | null>(null)
  const [valorEditGrupoConta, setValorEditGrupoConta] = useState('')
  const [valorEditPlanoContas, setValorEditPlanoContas] = useState('')
  const [valorEditDepartamento, setValorEditDepartamento] = useState('')
  const [valorInput, setValorInput] = useState('')
  const [descricaoEdit, setDescricaoEdit] = useState<DescricaoEditContext | null>(null)
  const [descricaoInput, setDescricaoInput] = useState('')
  const [salvandoDescricao, setSalvandoDescricao] = useState(false)
  const [replicarProximos, setReplicarProximos] = useState(false)
  const [salvandoValor, setSalvandoValor] = useState(false)

  const linhasFiltradas = useMemo((): OpexOrcamentoLinha[] => {
    const q = busca.trim().toLowerCase()
    return linhas.filter((l: OpexOrcamentoLinha) => {
      if (mesFiltro != null && l.mes !== mesFiltro) return false
      if (!q) return true
      return (
        l.grupo_conta.toLowerCase().includes(q) ||
        l.plano_contas.toLowerCase().includes(q) ||
        l.titulo_ref.toLowerCase().includes(q) ||
        l.descricao.toLowerCase().includes(q) ||
        l.departamento.toLowerCase().includes(q) ||
        parseFornecedorDescricao(l).fornecedor.toLowerCase().includes(q) ||
        parseFornecedorDescricao(l).descricaoDetalhe.toLowerCase().includes(q)
      )
    })
  }, [linhas, busca, mesFiltro])

  const totalFiltrado = useMemo(
    () => linhasFiltradas.reduce((s: number, l: OpexOrcamentoLinha) => s + l.valor, 0),
    [linhasFiltradas],
  )

  const planosContasAgrupados = useMemo(
    () => planosContasDasLinhas(linhasFiltradas),
    [linhasFiltradas],
  )

  const { data: dashboardGrupos } = useQuery({
    queryKey: ['opex', 'grupos-conta-opcoes', ano],
    queryFn: () => opexService.fetchDashboard(ano),
    staleTime: 5 * 60 * 1000,
    select: (data: OpexDashboard) =>
      data.grupos.map((g) => g.grupo_conta).filter((g) => g.trim()),
  })

  const grupoContaOpcoes = useMemo(() => {
    const set = new Set<string>(dashboardGrupos ?? [])
    for (const l of linhas) {
      const g = l.grupo_conta.trim()
      if (g) set.add(g)
    }
    if (form.grupo_conta.trim()) set.add(form.grupo_conta.trim())
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [dashboardGrupos, linhas, form.grupo_conta])

  const grupoContaSelecionado = form.grupo_conta.trim()

  const { data: planosDoGrupo } = useQuery({
    queryKey: ['opex', 'planos-micro-opcoes', ano, grupoContaSelecionado],
    queryFn: () => opexService.fetchPlanosGrupo(ano, grupoContaSelecionado),
    enabled: (dialogOpen || valorEdit != null) && grupoContaSelecionado.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const valorEditGrupoSelecionado = valorEditGrupoConta.trim()

  const { data: planosDoGrupoValorEdit } = useQuery({
    queryKey: ['opex', 'planos-micro-opcoes', ano, valorEditGrupoSelecionado],
    queryFn: () => opexService.fetchPlanosGrupo(ano, valorEditGrupoSelecionado),
    enabled: valorEdit != null && valorEditGrupoSelecionado.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const planoMicroOpcoesValorEdit = useMemo(() => {
    if (!valorEditGrupoSelecionado) return []
    const set = new Set<string>()
    for (const p of planosDoGrupoValorEdit ?? []) {
      const plano = p.plano_contas.trim()
      if (plano) set.add(plano)
    }
    for (const l of linhas) {
      if (l.grupo_conta.trim() === valorEditGrupoSelecionado) {
        const plano = l.plano_contas.trim()
        if (plano) set.add(plano)
      }
    }
    if (valorEditPlanoContas.trim()) set.add(valorEditPlanoContas.trim())
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [valorEditGrupoSelecionado, planosDoGrupoValorEdit, linhas, valorEditPlanoContas])

  const planoMicroOpcoes = useMemo(() => {
    if (!grupoContaSelecionado) return []
    const set = new Set<string>()
    for (const p of planosDoGrupo ?? []) {
      const plano = p.plano_contas.trim()
      if (plano) set.add(plano)
    }
    for (const l of linhas) {
      if (l.grupo_conta.trim() === grupoContaSelecionado) {
        const plano = l.plano_contas.trim()
        if (plano) set.add(plano)
      }
    }
    if (form.plano_contas.trim()) set.add(form.plano_contas.trim())
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [grupoContaSelecionado, planosDoGrupo, linhas, form.plano_contas])

  const planoMicroSelecionado = form.plano_contas.trim()

  const { data: titulosPlanoOrcamento } = useQuery({
    queryKey: ['opex', 'fornecedores-opcoes', ano, grupoContaSelecionado, planoMicroSelecionado],
    queryFn: () => opexService.fetchPlanoTitulos(ano, grupoContaSelecionado, planoMicroSelecionado),
    enabled: dialogOpen && grupoContaSelecionado.length > 0 && planoMicroSelecionado.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const fornecedorOpcoes = useMemo(() => {
    const set = new Set<string>()
    for (const t of titulosPlanoOrcamento ?? []) {
      const fornecedor = t.fornecedor.trim()
      if (fornecedor && fornecedor !== '—') set.add(fornecedor)
    }
    for (const l of linhas) {
      if (grupoContaSelecionado && l.grupo_conta.trim() !== grupoContaSelecionado) continue
      if (planoMicroSelecionado && l.plano_contas.trim() !== planoMicroSelecionado) continue
      const { fornecedor } = parseFornecedorDescricao(l)
      if (fornecedor && fornecedor !== 'Sem fornecedor') set.add(fornecedor)
    }
    if (form.fornecedor.trim()) set.add(form.fornecedor.trim())
    set.delete(OPEX_FORNECEDOR_NAO_CADASTRADO)
    const cadastrados = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [OPEX_FORNECEDOR_NAO_CADASTRADO, ...cadastrados]
  }, [
    titulosPlanoOrcamento,
    linhas,
    grupoContaSelecionado,
    planoMicroSelecionado,
    form.fornecedor,
  ])

  const { data: departamentosVios } = useQuery({
    queryKey: ['opex', 'departamentos-opcoes', ano],
    queryFn: () => opexService.fetchDepartamentos(ano),
    enabled: dialogOpen || valorEdit != null,
    staleTime: 5 * 60 * 1000,
  })

  const departamentoOpcoes = useMemo(() => {
    const set = new Set<string>()
    for (const d of departamentosVios ?? []) {
      const dept = d.departamento.trim()
      if (dept && dept !== 'Sem departamento') set.add(dept)
    }
    for (const l of linhas) {
      const dept = departamentoOrcamentoLabel(l)
      if (dept && dept !== 'Sem departamento') set.add(dept)
    }
    if (form.departamento.trim()) set.add(form.departamento.trim())
    if (valorEditDepartamento.trim()) set.add(valorEditDepartamento.trim())
    return Array.from(set).sort((a, b) =>
      departamentoLabel(a).localeCompare(departamentoLabel(b), 'pt-BR'),
    )
  }, [departamentosVios, linhas, form.departamento, valorEditDepartamento])

  const toggleSet = (setter: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void) =>
    (key: string) => {
      setter((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    }
  const togglePlanoContas = toggleSet(setPlanosContasAbertos)
  const togglePlanoMicro = toggleSet(setPlanosMicroAbertos)
  const toggleFornecedor = toggleSet(setFornecedoresAbertos)
  const toggleDepartamento = toggleSet(setDepartamentosAbertos)
  const toggleDescricao = toggleSet(setDescricoesAbertas)

  const handleSelectFile = async (file: File | null) => {
    if (!file) return
    setErro(null)
    try {
      const parsed = await parseOrcamentoXlsxFile(file, ano)
      if (!parsed.linhas.length) {
        setErro('Nenhuma linha válida encontrada na planilha.')
        return
      }
      setImportFile(file)
      setImportPreview(parsed)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao ler planilha.')
    }
  }

  const handleConfirmImport = async () => {
    if (!importPreview?.linhas.length) return
    setImportando(true)
    setErro(null)
    try {
      await opexOrcamentoService.importReplace(ano, importPreview.linhas, { origem: 'import' })
      setImportPreview(null)
      setImportFile(null)
      await invalidate()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao importar orçamento.')
    } finally {
      setImportando(false)
    }
  }

  const handleExportBackup = async () => {
    setErro(null)
    try {
      const payload = linhas.map((l: OpexOrcamentoLinha) => ({
        mes: l.mes,
        grupo_conta: l.grupo_conta,
        plano_contas: l.plano_contas,
        conta_numero: l.conta_numero,
        titulo_ref: l.titulo_ref,
        descricao: l.descricao,
        valor: l.valor,
        departamento: l.departamento,
        fixo: l.fixo,
      }))
      await exportOrcamentoBackupExcel(payload, ano)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao exportar backup.')
    }
  }

  const abrirEditarValor = (
    linha: OpexOrcamentoLinha,
    titulo: string,
    linhasGrupo?: OpexOrcamentoLinha[],
    opts?: ValorEditGrupoOpts,
  ) => {
    setValorEdit({ linha, titulo, linhasGrupo, editarDepartamento: opts?.editarDepartamento })
    setValorEditGrupoConta(linha.grupo_conta.trim())
    setValorEditPlanoContas(linha.plano_contas.trim())
    setValorEditDepartamento(departamentoOrcamentoLabel(linha))
    setValorInput(numberToCurrencyInput(linha.valor))
    setReplicarProximos(false)
    setErro(null)
  }

  const linhaReferencia = (grupoLinhas: OpexOrcamentoLinha[]) => {
    if (mesFiltro != null) {
      return grupoLinhas.find((l) => l.mes === mesFiltro) ?? null
    }
    return [...grupoLinhas].sort((a, b) => a.mes - b.mes)[0] ?? null
  }

  const abrirEditarValorGrupo = (
    grupoLinhas: OpexOrcamentoLinha[],
    tituloBase: string,
    opts?: ValorEditGrupoOpts,
  ) => {
    const linha = linhaReferencia(grupoLinhas)
    if (!linha) return
    abrirEditarValor(
      linha,
      `${tituloBase} · ${MESES_CURTOS[linha.mes - 1]}`,
      grupoLinhas,
      opts,
    )
  }

  const abrirEditarDescricao = (
    linhasGrupo: OpexOrcamentoLinha[],
    descricao: string,
    tituloBase: string,
  ) => {
    setDescricaoEdit({ linhas: linhasGrupo, titulo: tituloBase })
    setDescricaoInput(descricao)
    setErro(null)
  }

  const handleSalvarDescricao = async () => {
    if (!descricaoEdit) return
    const descricao = descricaoInput.trim()
    if (!descricao) {
      setErro('Informe a descrição.')
      return
    }
    setSalvandoDescricao(true)
    setErro(null)
    try {
      await opexOrcamentoService.updateDescricaoLinhas(descricaoEdit.linhas, descricao)
      setDescricaoEdit(null)
      await invalidate()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar descrição.')
    } finally {
      setSalvandoDescricao(false)
    }
  }

  const handleSalvarValor = async () => {
    if (!valorEdit) return
    const valor = parseCurrencyBr(valorInput)
    const grupo_conta = valorEditGrupoConta.trim()
    const plano_contas = valorEditPlanoContas.trim()
    const departamento = valorEditDepartamento.trim()
    if (valor <= 0) {
      setErro('Informe um valor maior que zero.')
      return
    }
    if (!grupo_conta || !plano_contas) {
      setErro('Selecione o plano contas e o plano micro.')
      return
    }
    if (valorEdit.editarDepartamento && !departamento) {
      setErro('Selecione o departamento.')
      return
    }
    setSalvandoValor(true)
    setErro(null)
    try {
      await opexOrcamentoService.updateValorComReplicacao(valorEdit.linha, valor, {
        replicarProximosMeses: replicarProximos,
        todasLinhas: linhas,
        grupo_conta,
        plano_contas,
        departamento: valorEdit.editarDepartamento ? departamento : undefined,
        linhasGrupo: valorEdit.linhasGrupo,
      })
      setValorEdit(null)
      await invalidate()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar valor.')
    } finally {
      setSalvandoValor(false)
    }
  }

  const abrirNovaLinha = () => {
    setEditId(null)
    const mesDefault = mesFiltro ?? new Date().getMonth() + 1
    setForm({ ...emptyForm(), meses: [mesDefault] })
    setDialogOpen(true)
  }

  const handleSalvarLinha = async () => {
    const meses = [...form.meses].sort((a, b) => a - b)
    const valor = parseCurrencyBr(form.valor)
    if (
      !meses.length ||
      meses.some((m) => m < 1 || m > 12) ||
      !form.grupo_conta.trim() ||
      !form.plano_contas.trim() ||
      !form.fornecedor.trim() ||
      !form.departamento.trim() ||
      valor <= 0
    ) {
      setErro('Selecione ao menos um mês e preencha plano contas, plano micro, fornecedor, departamento e valor.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const descricaoDetalhe = form.descricao.trim()
      const descricao = montarDescricaoOrcamento(descricaoDetalhe, form.fornecedor.trim())
      const titulo_ref = descricaoDetalhe || form.departamento.trim() || '—'
      const payload = {
        grupo_conta: form.grupo_conta.trim(),
        plano_contas: form.plano_contas.trim(),
        conta_numero: '',
        titulo_ref,
        descricao,
        departamento: form.departamento.trim(),
        valor,
      }

      if (editId) {
        await opexOrcamentoService.upsertLinha({
          id: editId,
          mes: meses[0],
          ...payload,
        })
      } else {
        await Promise.all(
          meses.map((mes) =>
            opexOrcamentoService.upsertLinha({
              ano,
              mes,
              ...payload,
            }),
          ),
        )
      }
      setDialogOpen(false)
      await invalidate()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar linha.')
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir esta linha do orçamento?')) return
    setErro(null)
    try {
      await opexOrcamentoService.deleteLinha(id)
      await invalidate()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir linha.')
    }
  }

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        className="flex w-full flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 text-left transition-colors hover:bg-slate-50/80 sm:px-5"
      >
        <div className="flex min-w-0 items-start gap-2">
          {expandido ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          )}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
            <FileSpreadsheet className="h-4 w-4 text-violet-700" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Orçamento congelado — {ano}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Previsão orçamentária anual separada do VIOS. Usada como previsto principal no dashboard.
            </p>
            {meta?.importado ? (
              <p className="mt-2 text-xs text-emerald-700">
                Congelado em {formatDate(meta.congelado_em?.slice(0, 10) ?? null)} ·{' '}
                {formatCurrency(meta.total_ano ?? 0)}
              </p>
            ) : (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Orçamento não importado — o dashboard usa previsto VIOS como fallback.
              </p>
            )}
          </div>
        </div>
        {!expandido && meta?.importado && (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            {formatCurrency(meta.total_ano ?? 0)} / ano
          </span>
        )}
      </button>

      {expandido && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleSelectFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Importar Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!linhas.length}
              onClick={() => void handleExportBackup()}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Backup Excel
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={abrirNovaLinha}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nova linha
            </Button>
          </div>

      {erro && (
        <p className="mx-4 mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-5" role="alert">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar plano contas, micro, fornecedor, departamento ou descrição…"
          className="max-w-xs"
        />
        {mesFiltro != null && (
          <button
            type="button"
            onClick={() => setMesFiltro(null)}
            className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-100"
          >
            {MESES_CURTOS[mesFiltro - 1]}
            <X className="h-3 w-3" aria-hidden />
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {countPlanosContasUnicos(linhasFiltradas)} planos contas ·{' '}
          {countPlanosMicroUnicos(linhasFiltradas)} micro · {countFornecedoresUnicos(linhasFiltradas)} fornecedores ·{' '}
          {countDepartamentosUnicos(linhasFiltradas)} departamentos ·{' '}
          {linhasFiltradas.length} linhas · {formatCurrency(totalFiltrado)}
        </span>
      </div>

      {!isLoading && linhasFiltradas.length > 0 && (
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Distribuição mensal do orçamento filtrado — clique em um mês para filtrar a tabela.
            </p>
            {mesFiltro == null && (
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Visão anual
              </span>
            )}
          </div>
          <OpexOrcamentoMesChart
            linhas={linhasFiltradas}
            mesSelecionado={mesFiltro}
            onMesSelect={setMesFiltro}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando orçamento…
          </div>
        ) : !linhasFiltradas.length ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Nenhuma linha de orçamento. Importe uma planilha ou adicione manualmente.
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3 sm:px-5">Plano contas</th>
                <th className="px-4 py-3">Plano de contas micro</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <OpexOrcamentoHierarchyTable
              grupos={planosContasAgrupados}
              mesFiltro={mesFiltro}
              onMesSelect={setMesFiltro}
              planosContasAbertos={planosContasAbertos}
              planosMicroAbertos={planosMicroAbertos}
              fornecedoresAbertos={fornecedoresAbertos}
              departamentosAbertos={departamentosAbertos}
              descricoesAbertas={descricoesAbertas}
              onTogglePlanoContas={togglePlanoContas}
              onTogglePlanoMicro={togglePlanoMicro}
              onToggleFornecedor={toggleFornecedor}
              onToggleDepartamento={toggleDepartamento}
              onToggleDescricao={toggleDescricao}
              onEditarValor={abrirEditarValor}
              onEditarValorGrupo={abrirEditarValorGrupo}
              onEditarDescricao={abrirEditarDescricao}
              onExcluir={(id) => void handleExcluir(id)}
            />
          </table>
        )}
      </div>
        </>
      )}

      <Dialog open={importPreview != null} onOpenChange={(open) => !open && setImportPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar importação do orçamento {ano}</DialogTitle>
            <DialogDescription>
              {importFile?.name} · {importPreview?.linhas.length ?? 0} linhas · total{' '}
              {formatCurrency(importPreview?.totalGeral ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs">
              {importPreview?.preview.map((l, i) => (
                <div key={i} className="flex justify-between gap-3 py-1.5">
                  <span className="truncate">
                    {MESES_CURTOS[l.mes - 1]} · {l.grupo_conta} / {l.plano_contas}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatCurrency(l.valor)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-amber-700">
              Isso substituirá todo o orçamento de {ano} existente.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportPreview(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={importando} onClick={() => void handleConfirmImport()}>
              {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Substituir orçamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={valorEdit != null} onOpenChange={(open) => !open && setValorEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar orçamento</DialogTitle>
            <DialogDescription>{valorEdit?.titulo}</DialogDescription>
          </DialogHeader>
          {valorEdit && (
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-4 rounded-xl border border-slate-200/80 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="orcamento-valor-edit-grupo">Plano contas</Label>
                  <select
                    id="orcamento-valor-edit-grupo"
                    value={valorEditGrupoConta}
                    onChange={(e) => {
                      const grupo_conta = e.target.value
                      setValorEditGrupoConta(grupo_conta)
                      setValorEditPlanoContas((prev) =>
                        valorEditGrupoConta === grupo_conta ? prev : '',
                      )
                    }}
                    className={ORCAMENTO_FIELD_SELECT}
                  >
                    <option value="">Selecione o plano contas…</option>
                    {grupoContaOpcoes.map((grupo) => (
                      <option key={grupo} value={grupo}>
                        {grupo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="orcamento-valor-edit-plano">Plano de contas micro</Label>
                  <select
                    id="orcamento-valor-edit-plano"
                    value={valorEditPlanoContas}
                    onChange={(e) => setValorEditPlanoContas(e.target.value)}
                    className={ORCAMENTO_FIELD_SELECT}
                    disabled={!valorEditGrupoSelecionado}
                  >
                    <option value="">
                      {valorEditGrupoSelecionado
                        ? 'Selecione o plano micro…'
                        : 'Selecione o plano contas primeiro'}
                    </option>
                    {planoMicroOpcoesValorEdit.map((plano) => (
                      <option key={plano} value={plano}>
                        {plano}
                      </option>
                    ))}
                  </select>
                </div>
                {valorEdit.editarDepartamento ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="orcamento-valor-edit-departamento">Departamento</Label>
                    <select
                      id="orcamento-valor-edit-departamento"
                      value={valorEditDepartamento}
                      onChange={(e) => setValorEditDepartamento(e.target.value)}
                      className={ORCAMENTO_FIELD_SELECT}
                    >
                      <option value="">Selecione o departamento…</option>
                      {departamentoOpcoes.map((departamento) => (
                        <option key={departamento} value={departamento}>
                          {departamentoLabel(departamento)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orcamento-valor-edit">
                  Valor em {MESES_LONGOS[valorEdit.linha.mes - 1]} ({MESES_CURTOS[valorEdit.linha.mes - 1]})
                </Label>
                <CurrencyBrInput
                  id="orcamento-valor-edit"
                  value={valorInput}
                  onValueChange={setValorInput}
                  placeholder="0,00"
                  autoFocus
                />
              </div>
              {valorEdit.linha.mes < 12 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <Checkbox
                    checked={replicarProximos}
                    onCheckedChange={(checked) => setReplicarProximos(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">
                      Replicar para os meses seguintes
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Aplica o mesmo valor de {MESES_CURTOS[valorEdit.linha.mes - 1]} em{' '}
                      {12 - valorEdit.linha.mes} mês(es):{' '}
                      {MESES_CURTOS.slice(valorEdit.linha.mes)
                        .map((m) => m.toUpperCase())
                        .join(', ')}
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setValorEdit(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={salvandoValor} className="gap-1.5" onClick={() => void handleSalvarValor()}>
              {salvandoValor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={descricaoEdit != null} onOpenChange={(open) => !open && setDescricaoEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar descrição</DialogTitle>
            <DialogDescription>{descricaoEdit?.titulo}</DialogDescription>
          </DialogHeader>
          {descricaoEdit && (
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="orcamento-descricao-edit">Descrição</Label>
                <Input
                  id="orcamento-descricao-edit"
                  value={descricaoInput}
                  onChange={(e) => setDescricaoInput(e.target.value)}
                  placeholder="Ex.: SEGURO RESPONSABILIDADE CIVIL - PARCELA 10/10"
                  autoFocus
                />
                <p className="text-[11px] leading-snug text-slate-500">
                  Atualiza todos os meses deste lançamento ({descricaoEdit.linhas.length}{' '}
                  {descricaoEdit.linhas.length === 1 ? 'linha' : 'linhas'}). O fornecedor vinculado
                  é preservado.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDescricaoEdit(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={salvandoDescricao}
              className="gap-1.5"
              onClick={() => void handleSalvarDescricao()}
            >
              {salvandoDescricao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar linha' : 'Nova linha de orçamento'}</DialogTitle>
            <DialogDescription>
              Informe plano, fornecedor, departamento e valor. O lançamento é replicado em cada mês selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-5">
            <section className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Label className="text-slate-700">Meses</Label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, meses: MESES_ANO }))}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      form.meses.length === 12
                        ? 'border-violet-400 bg-violet-100 text-violet-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200',
                    )}
                  >
                    Ano inteiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, meses: [] }))}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-violet-200"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {MESES_CURTOS.map((label, idx) => {
                  const mes = idx + 1
                  const selected = form.meses.includes(mes)
                  return (
                    <button
                      key={mes}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          meses: toggleMesFiltro(f.meses, mes),
                        }))
                      }
                      className={cn(
                        ORCAMENTO_MES_CHIP,
                        selected
                          ? 'border-violet-400 bg-violet-100 text-violet-900 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/60',
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {form.meses.length === 0
                  ? 'Selecione um ou mais meses — o valor será replicado em cada um.'
                  : form.meses.length === 1
                    ? `1 mês selecionado (${MESES_LONGOS[form.meses[0]! - 1]})`
                    : `${form.meses.length} meses selecionados — valor replicado em cada um`}
              </p>
            </section>

            <div className="space-y-1.5">
              <Label htmlFor="orcamento-valor">Valor</Label>
              <CurrencyBrInput
                id="orcamento-valor"
                value={form.valor}
                onValueChange={(valor) => setForm((f) => ({ ...f, valor }))}
              />
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200/80 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="orcamento-grupo">Plano contas</Label>
                <select
                  id="orcamento-grupo"
                  value={form.grupo_conta}
                  onChange={(e) => {
                    const grupo_conta = e.target.value
                    setForm((f) => ({
                      ...f,
                      grupo_conta,
                      plano_contas: f.grupo_conta === grupo_conta ? f.plano_contas : '',
                      fornecedor: f.grupo_conta === grupo_conta ? f.fornecedor : '',
                    }))
                  }}
                  className={ORCAMENTO_FIELD_SELECT}
                  required
                >
                  <option value="">Selecione o plano contas…</option>
                  {grupoContaOpcoes.map((grupo) => (
                    <option key={grupo} value={grupo}>
                      {grupo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orcamento-plano">Plano de contas micro</Label>
                <select
                  id="orcamento-plano"
                  value={form.plano_contas}
                  onChange={(e) => {
                    const plano_contas = e.target.value
                    setForm((f) => ({
                      ...f,
                      plano_contas,
                      fornecedor: f.plano_contas === plano_contas ? f.fornecedor : '',
                    }))
                  }}
                  className={ORCAMENTO_FIELD_SELECT}
                  required
                  disabled={!grupoContaSelecionado}
                >
                  <option value="">
                    {grupoContaSelecionado ? 'Selecione o plano micro…' : 'Selecione o plano contas primeiro'}
                  </option>
                  {planoMicroOpcoes.map((plano) => (
                    <option key={plano} value={plano}>
                      {plano}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="orcamento-fornecedor">Fornecedor</Label>
                <select
                  id="orcamento-fornecedor"
                  value={form.fornecedor}
                  onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
                  className={ORCAMENTO_FIELD_SELECT}
                  required
                  disabled={!planoMicroSelecionado}
                >
                  <option value="">
                    {planoMicroSelecionado ? 'Selecione o fornecedor…' : 'Selecione o plano micro primeiro'}
                  </option>
                  {fornecedorOpcoes.map((fornecedor) => (
                    <option key={fornecedor} value={fornecedor}>
                      {fornecedor}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="orcamento-departamento">Departamento</Label>
                <select
                  id="orcamento-departamento"
                  value={form.departamento}
                  onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))}
                  className={ORCAMENTO_FIELD_SELECT}
                  required
                >
                  <option value="">Selecione…</option>
                  {departamentoOpcoes.map((departamento) => (
                    <option key={departamento} value={departamento}>
                      {departamentoLabel(departamento)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="orcamento-descricao">Descrição</Label>
                <Input
                  id="orcamento-descricao"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="bg-slate-50/50">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={salvando} className="gap-1.5" onClick={() => void handleSalvarLinha()}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
