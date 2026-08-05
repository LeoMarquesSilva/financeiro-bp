-- Painel Eficiência Operacional: tabelas espelho das fontes SharePoint do BI
-- "DASHBOARD - EFICIÊNCIA OPERACIONAL - GERAL". Sync diário via scripts/sharepoint/sync-sharepoint.mjs.
-- sp_publicacoes acumula histórico (a lista SharePoint é rotativa ~7 dias); demais seguem a fonte.

-- ============================================================
-- PUBLICAÇÕES (SLA de Vistagem D+1 — demanda de risco e comum)
-- ============================================================
CREATE TABLE public.sp_publicacoes (
  sp_id                     BIGINT PRIMARY KEY,
  criado                    TIMESTAMPTZ,
  data_publicacao           DATE,
  data_divulgacao           DATE,
  numero_processo           TEXT,
  pasta                     TEXT,
  cliente_principal         TEXT,
  grupo                     TEXT,
  responsavel_principal     TEXT,
  escritorio_responsavel    TEXT,
  area                      TEXT,
  tipo_agendamento          TEXT,
  prioridade_agendamento    TEXT,
  agendado_por              TEXT,
  vistado_por               TEXT,
  area_vistador             TEXT,
  disponibilizado_vistagem  TIMESTAMPTZ,
  vistado_em                TIMESTAMPTZ,
  vistado_d1                TEXT,
  demanda_risco             TEXT,
  status_publicacao         TEXT,
  natureza                  TEXT,
  status                    TEXT,
  acao                      TEXT,
  eficiencia                TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sp_publicacoes_disponibilizado_idx ON public.sp_publicacoes (disponibilizado_vistagem);
CREATE INDEX sp_publicacoes_area_idx ON public.sp_publicacoes (area);
CREATE INDEX sp_publicacoes_demanda_risco_idx ON public.sp_publicacoes (demanda_risco);

COMMENT ON TABLE public.sp_publicacoes IS
  'Espelho acumulativo da lista SharePoint de publicações (site CONTROLADORIAJURDICA, lista 91e8ba11). A lista na origem é rotativa (~7 dias); aqui o histórico é preservado (upsert por sp_id, sem delete). Base do SLA de Vistagem D+1.';
COMMENT ON COLUMN public.sp_publicacoes.vistado_d1 IS
  'Flag "Sim"/"Não": vistado até o próximo dia útil após disponibilização + 12h (considera sp_feriados). Calculado no sync.';
COMMENT ON COLUMN public.sp_publicacoes.area IS
  'De-Para do Escritório responsável (ex.: INSOLVÊNCIA -> Reestruturação). Calculado no sync.';

-- ============================================================
-- PROTOCOLOS (Eficiência de Protocolo)
-- ============================================================
CREATE TABLE public.sp_protocolos (
  sp_id                          BIGINT PRIMARY KEY,
  criado                         TIMESTAMPTZ,
  data_criada                    DATE,
  criado_por                     TEXT,
  nome_limpo                     TEXT,
  area                           TEXT,
  protocolado_em                 DATE,
  protocolado_por                TEXT,
  tipo_protocolo                 TEXT,
  tipo_peca                      TEXT,
  sistema                        TEXT,
  status                         TEXT,
  instancia                      TEXT,
  protocolo_nos_autos            TEXT,
  cliente                        TEXT,
  parte_contraria                TEXT,
  eficiencia_protocolo           TEXT,
  eficiencia_operacional         TEXT,
  eficiencia_justificativa       TEXT,
  inconsistencia_juridico        TEXT,
  inconsistencia_juridico_motivo TEXT,
  status_inconsistencia          TEXT,
  urgente                        TEXT,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sp_protocolos_data_criada_idx ON public.sp_protocolos (data_criada);
CREATE INDEX sp_protocolos_area_idx ON public.sp_protocolos (area);
CREATE INDEX sp_protocolos_nome_limpo_idx ON public.sp_protocolos (nome_limpo);

COMMENT ON TABLE public.sp_protocolos IS
  'Espelho da lista SharePoint "CONTROLE DE PROTOCOLOS" (site CONTROLADORIAJURDICA). Base da Eficiência de Protocolo (% sem inconsistência jurídica).';
COMMENT ON COLUMN public.sp_protocolos.status_inconsistencia IS
  '"EFICIÊNCIA" quando inconsistencia_juridico vazio, senão "INCONSISTÊNCIA". Calculado no sync.';

-- ============================================================
-- TAREFAS (Agendamento/Ciência D+1) — Tarefas.csv (concluídas)
-- ============================================================
CREATE TABLE public.sp_tarefas (
  ci                   BIGINT PRIMARY KEY,
  ci_processo          BIGINT,
  nro_cnj              TEXT,
  area_processo        TEXT,
  grupo_cliente        TEXT,
  cliente              TEXT,
  tarefa               TEXT,
  tarefa_pai           TEXT,
  etiquetas_tarefa     TEXT,
  status               TEXT,
  usuario_conclusao    TEXT,
  data_conclusao       DATE,
  data_para_conclusao  DATE,
  data_limite          DATE,
  justificativa_fatal  TEXT,
  adesao_sem18         TEXT,
  fatal_sem18_d1       TEXT,
  adesao_apos18        TEXT,
  fatal_apos18         TEXT,
  area_conclusao       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sp_tarefas_data_conclusao_idx ON public.sp_tarefas (data_conclusao);
CREATE INDEX sp_tarefas_area_conclusao_idx ON public.sp_tarefas (area_conclusao);
CREATE INDEX sp_tarefas_usuario_idx ON public.sp_tarefas (usuario_conclusao);

COMMENT ON TABLE public.sp_tarefas IS
  'Espelho de Tarefas.csv (biblioteca SharePoint Controladoria, tarefas concluídas do VIOS). Base do indicador Agendamento/Ciência D+1.';
COMMENT ON COLUMN public.sp_tarefas.fatal_sem18_d1 IS
  'Mapeado de adesao_sem18: "Dentro do Prazo"/"Fora do Prazo"/"Pendente"/"Cancelado"/"Iniciado". Calculado no sync.';
COMMENT ON COLUMN public.sp_tarefas.area_conclusao IS
  'Área do usuário na data de conclusão, via lookup em sp_turnover (vigência admissão↔desligamento). Calculado no sync.';

-- ============================================================
-- TAREFAS HISTÓRICO ("Nova" — Historico/*.csv, SLA de Protocolo)
-- ============================================================
CREATE TABLE public.sp_tarefas_historico (
  ci                   BIGINT PRIMARY KEY,
  ci_processo          BIGINT,
  nro_cnj              TEXT,
  grupo_cliente        TEXT,
  cliente              TEXT,
  tarefa               TEXT,
  tarefa_pai           TEXT,
  etiqueta_tarefa      TEXT,
  status               TEXT,
  usuario_conclusao    TEXT,
  conclusao_completa   TIMESTAMPTZ,
  data_conclusao       DATE,
  data_para_conclusao  DATE,
  justificativa_fatal  TEXT,
  excludente           TEXT,
  adesao_apos18        TEXT,
  fatal_apos18         TEXT,
  adesao_sem18         TEXT,
  fatal_sem18          TEXT,
  area_conclusao       TEXT,
  nucleo               TEXT,
  meta_d1              NUMERIC(5, 2),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sp_tarefas_historico_conclusao_idx ON public.sp_tarefas_historico (conclusao_completa);
CREATE INDEX sp_tarefas_historico_area_idx ON public.sp_tarefas_historico (area_conclusao);
CREATE INDEX sp_tarefas_historico_fatal_apos18_idx ON public.sp_tarefas_historico (fatal_apos18);
CREATE INDEX sp_tarefas_historico_usuario_idx ON public.sp_tarefas_historico (usuario_conclusao);

COMMENT ON TABLE public.sp_tarefas_historico IS
  'Espelho combinado dos CSVs de Historico/ (biblioteca SharePoint Controladoria) — tabela "Nova" do BI. Base do SLA de Protocolo (D-1 vs FATAL).';
COMMENT ON COLUMN public.sp_tarefas_historico.fatal_apos18 IS
  'Mapeado de adesao_apos18: Fatal/Fatal Quebra -> FATAL; Pendente -> Pendente; senão D-1. Calculado no sync.';
COMMENT ON COLUMN public.sp_tarefas_historico.excludente IS
  '"Excludente" quando justificativa_fatal está na lista de justificativas excludentes de fatal; senão "Não". Calculado no sync.';
COMMENT ON COLUMN public.sp_tarefas_historico.meta_d1 IS
  'Meta de SLA vigente na data de conclusão (2025: 70/80/90/90 por trimestre; 2026+: 90). Calculado no sync.';

-- ============================================================
-- TURNOVER (retenção de talentos) — Turnover BP.xlsx
-- ============================================================
CREATE TABLE public.sp_turnover (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome               TEXT NOT NULL,
  area               TEXT,
  nucleo             TEXT,
  cargo              TEXT,
  admissao           DATE,
  desligamento       DATE,
  tipo_desligamento  TEXT,
  obs                TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sp_turnover_nome_admissao_key UNIQUE (nome, admissao)
);

CREATE INDEX sp_turnover_desligamento_idx ON public.sp_turnover (desligamento);

COMMENT ON TABLE public.sp_turnover IS
  'Espelho de Turnover BP.xlsx (biblioteca SharePoint Controladoria). Base de retenção de talentos, funcionários ativos e lookup de área por vigência.';

-- ============================================================
-- FERIADOS — Feriados.xlsx (para cálculo de dia útil do SLA)
-- ============================================================
CREATE TABLE public.sp_feriados (
  data             DATE PRIMARY KEY,
  data_fim         DATE,
  nome             TEXT,
  descricao        TEXT,
  posterga_prazos  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sp_feriados IS
  'Espelho de Feriados.xlsx (biblioteca SharePoint Controladoria). Usado no cálculo de dia útil do SLA de Vistagem D+1.';

-- ============================================================
-- USUÁRIOS x ÁREA — Usuários x Área.xlsx
-- ============================================================
CREATE TABLE public.sp_usuarios_area (
  nome        TEXT PRIMARY KEY,
  area        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sp_usuarios_area IS
  'Espelho de "Usuários x Área.xlsx" (OneDrive/SharePoint). Mapeia responsável principal -> área.';

-- ============================================================
-- TREINAMENTOS — lista SharePoint de registro de presença
-- ============================================================
CREATE TABLE public.sp_treinamentos_presenca (
  sp_id             BIGINT PRIMARY KEY,
  colaborador       TEXT,
  treinamento       TEXT,
  treinamento_id    BIGINT,
  status            TEXT,
  tipo_treinamento  TEXT,
  status_colaborador TEXT,
  data              DATE,
  duracao_minutos   NUMERIC(10, 2),
  criado            TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sp_treinamentos_presenca_data_idx ON public.sp_treinamentos_presenca (data);
CREATE INDEX sp_treinamentos_presenca_colaborador_idx ON public.sp_treinamentos_presenca (colaborador);

COMMENT ON TABLE public.sp_treinamentos_presenca IS
  'Espelho da lista SharePoint de registro de presença em treinamentos (site CONTROLADORIAJURDICA, lista 30ea2880). Base do indicador de desenvolvimento de equipe (meta 14h/pessoa/ano).';

-- ============================================================
-- DECISÕES PROCESSUAIS — Decisoes Processuais.csv
-- ============================================================
CREATE TABLE public.sp_decisoes_processuais (
  processo          TEXT PRIMARY KEY,
  pasta             TEXT,
  cliente           TEXT,
  grupo_cliente     TEXT,
  advogado          TEXT,
  autor             TEXT,
  reu               TEXT,
  jurisdicao        TEXT,
  tipo_decisao      TEXT,
  data_decisao      DATE,
  procedimento      TEXT,
  parte             TEXT,
  valor_acao        NUMERIC(15, 2),
  valor_condenacao  NUMERIC(15, 2),
  valor_preparo     NUMERIC(15, 2),
  valor_desembolso  NUMERIC(15, 2),
  dispositivo       TEXT,
  observacao        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sp_decisoes_processuais_data_idx ON public.sp_decisoes_processuais (data_decisao);

COMMENT ON TABLE public.sp_decisoes_processuais IS
  'Espelho de Decisoes Processuais.csv (biblioteca SharePoint Controladoria), deduplicado por processo (decisão mais recente). Base do benefício econômico.';

-- ============================================================
-- LOG DE SYNC
-- ============================================================
CREATE TABLE public.sharepoint_sync_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fonte         TEXT NOT NULL,
  executado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  upserted      INTEGER NOT NULL DEFAULT 0,
  deleted       INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0,
  detalhes      JSONB
);

CREATE INDEX sharepoint_sync_log_fonte_idx ON public.sharepoint_sync_log (fonte, executado_em DESC);

COMMENT ON TABLE public.sharepoint_sync_log IS
  'Log das execuções do sync SharePoint (scripts/sharepoint/sync-sharepoint.mjs). O painel usa a última entrada por fonte para exibir "atualizado em".';

-- ============================================================
-- updated_at automático (trigger única compartilhada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_sp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sp_publicacoes_updated_at BEFORE UPDATE ON public.sp_publicacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();
CREATE TRIGGER sp_protocolos_updated_at BEFORE UPDATE ON public.sp_protocolos
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();
CREATE TRIGGER sp_tarefas_updated_at BEFORE UPDATE ON public.sp_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();
CREATE TRIGGER sp_tarefas_historico_updated_at BEFORE UPDATE ON public.sp_tarefas_historico
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();
CREATE TRIGGER sp_turnover_updated_at BEFORE UPDATE ON public.sp_turnover
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();
CREATE TRIGGER sp_feriados_updated_at BEFORE UPDATE ON public.sp_feriados
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();
CREATE TRIGGER sp_usuarios_area_updated_at BEFORE UPDATE ON public.sp_usuarios_area
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();
CREATE TRIGGER sp_treinamentos_presenca_updated_at BEFORE UPDATE ON public.sp_treinamentos_presenca
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();
CREATE TRIGGER sp_decisoes_processuais_updated_at BEFORE UPDATE ON public.sp_decisoes_processuais
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

-- ============================================================
-- RLS (mesmo padrão permissivo das demais tabelas de sync)
-- ============================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sp_publicacoes', 'sp_protocolos', 'sp_tarefas', 'sp_tarefas_historico',
    'sp_turnover', 'sp_feriados', 'sp_usuarios_area', 'sp_treinamentos_presenca',
    'sp_decisoes_processuais', 'sharepoint_sync_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Allow all for anon" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', t
    );
    EXECUTE format(
      'CREATE POLICY "Allow all for authenticated" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END;
$$;
