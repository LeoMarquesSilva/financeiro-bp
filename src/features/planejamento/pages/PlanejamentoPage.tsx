import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Compass, Link2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModalConfirmacao } from '@/components/ui/modal-confirmacao'
import { cn } from '@/lib/utils'
import { RECEITA_META_INADIMPLENCIA_PCT } from '@/features/receita/constants'
import {
  ANO_ALVO,
  useCenarioMutations,
  usePlanBases,
  usePlanCenarios,
  usePlanInadimplencia,
  usePlanInadimplenciaPeriodo,
} from '../hooks/usePlanejamento'
import { carregarIndicadoresEscritorio } from '../hooks/useIndicadores'
import { taxaEfetivaEscritorio } from '../utils/planejamentoBase'
import { normalizarPremissas, premissasPadrao, simular, linhasMetasOficiais, type Premissas } from '../utils/planejamentoCalc'
import { historico25a26, modelosCenario, type ModeloCenario } from '../utils/planejamentoModelos'
import { resumoInadimplencia } from '../utils/inadimplenciaResumo'
import { linhasMetasOperacionais } from '../utils/indicadoresOperacionais'
import { exportarPlanejamentoExcel } from '../utils/planejamentoExcelExport'
import type { PlanCenarioRow } from '../types'
import { CarregandoBloco, ErroBloco } from '../components/PlanUi'
import { ReceitaTab } from '../components/ReceitaTab'
import { MargemTab } from '../components/MargemTab'
import { OpexInadTab } from '../components/OpexInadTab'
import { OperacionalTab } from '../components/OperacionalTab'
import { PessoasTab } from '../components/PessoasTab'
import { SimuladorTab } from '../components/SimuladorTab'

type Confirmacao = { titulo: string; texto: string; rotulo: string; destrutivo?: boolean; acao: () => Promise<void> }

/**
 * Planejamento Estratégico 2027 (menu "Planejamento 2027"; perfis Admin e Financeiro por padrão).
 * Os números vêm das RPCs `planejamento_*` e dos módulos Receita/ME, OPEX, Inadimplência e Eficiência.
 */
export function PlanejamentoPage() {
  const qc = useQueryClient()
  const bases = usePlanBases()
  const inadMes26 = usePlanInadimplencia(2026)
  const inadPer26 = usePlanInadimplenciaPeriodo(2026)
  const inadPer25 = usePlanInadimplenciaPeriodo(2025)
  const inadimplencia = useMemo(
    () =>
      inadMes26.data && inadPer26.data
        ? {
            r26: resumoInadimplencia(inadMes26.data, inadPer26.data, bases.ultimoMesFechado),
            r25: resumoInadimplencia(undefined, inadPer25.data, 12),
          }
        : null,
    [inadMes26.data, inadPer26.data, inadPer25.data, bases.ultimoMesFechado],
  )
  const cenariosQ = usePlanCenarios(ANO_ALVO)
  const mut = useCenarioMutations(ANO_ALVO)
  const cenarios: PlanCenarioRow[] = useMemo(() => cenariosQ.data ?? [], [cenariosQ.data])

  const [aba, setAba] = useState('receita')
  const [cenarioId, setCenarioId] = useState<string | null>(null)
  const [nome, setNome] = useState('Cenário base')
  const [premissas, setPremissas] = useState<Premissas | null>(null)
  const [salvo, setSalvo] = useState<string>('')
  const [iniciado, setIniciado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  const padrao = useMemo(() => {
    if (!bases.real2026 || !bases.fechados) return null
    return premissasPadrao({
      aliquotaPct: taxaEfetivaEscritorio(bases.real2026, bases.fechados) * 100,
      inadimplenciaMetaPct: RECEITA_META_INADIMPLENCIA_PCT,
    })
  }, [bases.real2026, bases.fechados])

  const historico = useMemo(
    () => (bases.base2025 && bases.base2026 ? historico25a26(bases.base2025, bases.base2026) : null),
    [bases.base2025, bases.base2026],
  )
  const modelos = useMemo(() => (historico && padrao ? modelosCenario(historico, padrao) : []), [historico, padrao])

  const carregarModelo = useCallback((m: ModeloCenario) => {
    setCenarioId(null)
    setNome(m.nome)
    setPremissas(structuredClone(m.premissas))
    setSalvo('')
  }, [])

  const abrir = useCallback(
    (c: PlanCenarioRow | null) => {
      if (!padrao) return
      const p = c ? normalizarPremissas(c.premissas, padrao) : padrao
      const n = c?.nome ?? 'Novo cenário'
      setCenarioId(c?.id ?? null)
      setNome(n)
      setPremissas(p)
      setSalvo(c ? JSON.stringify({ n, p }) : '')
    },
    [padrao],
  )

  useEffect(() => {
    if (iniciado || !padrao || cenariosQ.isLoading) return
    const inicial = cenarios.find((c) => c.oficial) ?? cenarios[0] ?? null
    if (inicial) abrir(inicial)
    else {
      // Sem cenário salvo: começa pelo cenário pronto "Manter o ritmo" (repete o crescimento 25→26).
      const ritmo = modelos.find((m) => m.id === 'ritmo')
      if (!ritmo) return
      carregarModelo(ritmo)
    }
    setIniciado(true)
  }, [iniciado, padrao, cenariosQ.isLoading, cenarios, abrir, modelos, carregarModelo])

  const alterado = premissas != null && JSON.stringify({ n: nome, p: premissas }) !== salvo
  const resultado = useMemo(
    () => (bases.base2026 && premissas ? simular(bases.base2026, premissas) : null),
    [bases.base2026, premissas],
  )
  const oficial = cenarios.find((c) => c.oficial) ?? null
  const resultadoOficial = useMemo(
    () => (bases.base2026 && padrao && oficial ? simular(bases.base2026, normalizarPremissas(oficial.premissas, padrao)) : null),
    [bases.base2026, padrao, oficial],
  )

  const executar = async (fn: () => Promise<void>, ok?: string) => {
    setOcupado(true)
    try {
      await fn()
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
    } finally {
      setOcupado(false)
    }
  }

  const trocarCenario = (id: string | null) => {
    const ir = () => abrir(cenarios.find((c) => c.id === id) ?? null)
    if (alterado) {
      setConfirmacao({
        titulo: 'Descartar alterações?',
        texto: 'O cenário atual tem alterações não salvas. Trocar de cenário descarta essas alterações.',
        rotulo: 'Descartar e trocar',
        destrutivo: true,
        acao: async () => ir(),
      })
    } else ir()
  }

  const aplicarModelo = (m: ModeloCenario) => {
    // Só pergunta se há algo a perder: alterações não salvas que não são um cenário pronto intacto.
    const atual = JSON.stringify(premissas)
    const intacto = modelos.some((x) => JSON.stringify(x.premissas) === atual)
    if (alterado && !intacto) {
      setConfirmacao({
        titulo: `Carregar o cenário pronto “${m.rotulo}”?`,
        texto: 'O cenário atual tem alterações não salvas. Carregar o cenário pronto descarta essas alterações.',
        rotulo: 'Descartar e carregar',
        destrutivo: true,
        acao: async () => carregarModelo(m),
      })
    } else carregarModelo(m)
  }

  const salvar = () =>
    executar(async () => {
      if (!premissas) return
      const c = cenarioId
        ? await mut.salvar.mutateAsync({ id: cenarioId, nome: nome.trim(), premissas })
        : await mut.criar.mutateAsync({ nome: nome.trim(), premissas })
      setCenarioId(c.id)
      setSalvo(JSON.stringify({ n: c.nome, p: premissas }))
      setNome(c.nome)
    }, 'Cenário salvo')

  const duplicar = () =>
    executar(async () => {
      if (!premissas) return
      const atualNome = cenarios.find((c) => c.id === cenarioId)?.nome
      const novoNome = nome.trim() === atualNome ? `${nome.trim()} (cópia)` : nome.trim()
      const c = await mut.criar.mutateAsync({ nome: novoNome, premissas })
      setCenarioId(c.id)
      setNome(c.nome)
      setSalvo(JSON.stringify({ n: c.nome, p: premissas }))
    }, 'Cenário criado')

  const excluir = () => {
    if (!cenarioId) return
    setConfirmacao({
      titulo: 'Excluir cenário?',
      texto: `O cenário “${nome}” será apagado. Só quem criou (ou um admin) pode excluir.`,
      rotulo: 'Excluir',
      destrutivo: true,
      acao: () =>
        executar(async () => {
          await mut.excluir.mutateAsync(cenarioId)
          const resto = cenarios.filter((c) => c.id !== cenarioId)
          abrir(resto.find((c) => c.oficial) ?? resto[0] ?? null)
        }, 'Cenário excluído'),
    })
  }

  const oficializar = () => {
    if (!cenarioId || !resultado || !premissas) return
    setConfirmacao({
      titulo: 'Oficializar este cenário como meta 2027?',
      texto: `“${nome}” passa a ser a meta oficial de 2027 (receita, margem por área e mês e metas operacionais). ${
        oficial && oficial.id !== cenarioId ? `O oficial atual (“${oficial.nome}”) deixa de ser oficial.` : ''
      }`,
      rotulo: 'Oficializar',
      acao: () =>
        executar(
          () =>
            mut.oficializar.mutateAsync({
              id: cenarioId,
              linhas: linhasMetasOficiais(resultado, premissas.escritorio.inadimplenciaMetaPct),
              operacionais: linhasMetasOperacionais(premissas.operacionais),
            }),
          'Cenário oficializado como meta 2027',
        ),
    })
  }

  const exportar = async () => {
    if (!bases.base2025 || !bases.base2026 || !premissas || !resultado) return
    setExportando(true)
    try {
      const indicadores = await carregarIndicadoresEscritorio(qc, bases.ultimoMesFechado)
      await exportarPlanejamentoExcel({
        geradoEm: new Date(),
        cenarioNome: nome.trim() || 'Cenário',
        oficial: Boolean(cenarios.find((c) => c.id === cenarioId)?.oficial),
        premissas,
        base2025: bases.base2025,
        base2026: bases.base2026,
        ultimoMesFechado: bases.ultimoMesFechado,
        resultado,
        indicadores,
        inadimplencia,
      })
    } catch (e) {
      toast.error(`Não foi possível gerar o Excel: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExportando(false)
    }
  }

  const copiarLink = () => {
    void navigator.clipboard
      .writeText(window.location.origin + window.location.pathname)
      .then(() => toast.success('Link copiado'))
      .catch(() => toast.error('Não foi possível copiar o link'))
  }

  const pronto = bases.base2025 && bases.base2026 && premissas && resultado

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Compass className="h-6 w-6 shrink-0 text-indigo-700" aria-hidden />
            Planejamento Estratégico 2027
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Receita, margem, OPEX, inadimplência, operacional e pessoas de 2025 e 2026, e o simulador de metas 2027.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copiarLink}>
            <Link2 className="h-4 w-4" aria-hidden /> Copiar link
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              bases.refetch()
              void qc.invalidateQueries({ queryKey: ['planejamento'] })
            }}
          >
            <RefreshCw className={cn('h-4 w-4', bases.isLoading && 'animate-spin')} aria-hidden /> Atualizar
          </Button>
        </div>
      </header>

      {bases.error ? (
        <ErroBloco erro={bases.error} contexto="a base do planejamento" />
      ) : !pronto ? (
        <CarregandoBloco altura="h-96" />
      ) : (
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="inline-flex h-auto flex-row flex-wrap items-stretch gap-0.5 p-1">
            <TabsTrigger value="receita">Receita</TabsTrigger>
            <TabsTrigger value="margem">Margem de contribuição</TabsTrigger>
            <TabsTrigger value="opex">OPEX e Inadimplência</TabsTrigger>
            <TabsTrigger value="operacional">Operacional</TabsTrigger>
            <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
            <TabsTrigger value="metas">Metas 2027</TabsTrigger>
          </TabsList>

          <TabsContent value="receita" className="mt-4">
            <ReceitaTab
              base2025={bases.base2025!}
              base2026={bases.base2026!}
              ultimoMesFechado={bases.ultimoMesFechado}
              metaBasePorMes={bases.me.metaBasePorMes}
              contribuicaoMeta={bases.me.contribuicaoMeta}
              oficial2027={resultadoOficial}
              nomeOficial={oficial?.nome ?? null}
            />
          </TabsContent>
          <TabsContent value="margem" className="mt-4">
            <MargemTab base2025={bases.base2025!} base2026={bases.base2026!} ultimoMesFechado={bases.ultimoMesFechado} />
          </TabsContent>
          <TabsContent value="opex" className="mt-4">
            <OpexInadTab base2025={bases.base2025!} base2026={bases.base2026!} ultimoMesFechado={bases.ultimoMesFechado} />
          </TabsContent>
          <TabsContent value="operacional" className="mt-4">
            <OperacionalTab ultimoMesFechado={bases.ultimoMesFechado} operacionais={premissas!.operacionais} nomeCenario={nome} />
          </TabsContent>
          <TabsContent value="pessoas" className="mt-4">
            <PessoasTab ultimoMesFechado={bases.ultimoMesFechado} premissas={premissas!} nomeCenario={nome} />
          </TabsContent>
          <TabsContent value="metas" className="mt-4">
            <SimuladorTab
              base2025={bases.base2025!}
              base2026={bases.base2026!}
              ultimoMesFechado={bases.ultimoMesFechado}
              premissas={premissas!}
              onPremissas={setPremissas}
              resultado={resultado!}
              cenarios={cenarios}
              cenarioId={cenarioId}
              nome={nome}
              onNome={setNome}
              alterado={alterado}
              ocupado={ocupado}
              onSelecionar={trocarCenario}
              onNovo={() => trocarCenario(null)}
              onSalvar={() => void salvar()}
              onDuplicar={() => void duplicar()}
              onExcluir={excluir}
              onOficializar={oficializar}
              onExportar={() => void exportar()}
              exportando={exportando}
              modelos={modelos}
              historico={historico}
              onAplicarModelo={aplicarModelo}
              inadimplencia={inadimplencia}
            />
          </TabsContent>
        </Tabs>
      )}

      {confirmacao && (
        <ModalConfirmacao
          open
          onClose={() => setConfirmacao(null)}
          title={confirmacao.titulo}
          description={confirmacao.texto}
          confirmLabel={confirmacao.rotulo}
          variant={confirmacao.destrutivo ? 'destructive' : 'default'}
          onConfirm={confirmacao.acao}
        />
      )}
    </div>
  )
}
