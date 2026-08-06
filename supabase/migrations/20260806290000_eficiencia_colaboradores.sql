-- Base canônica de colaboradores para o módulo Eficiência (Resultado Metas Bismarchi Pires).
-- Fonte de verdade: ORQESTRAI.hr_employees, sincronizado via scripts/sync-colaboradores.mjs.
-- colaboradores_divergencias registra o que não bate entre ORQESTRAI e RESPONSUM
-- (nome/e-mail/área/status), para o admin revisar — sem alterar nada nos sistemas de origem.

-- ============================================================
-- COLABORADORES
-- ============================================================
CREATE TABLE public.colaboradores (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orqestrai_employee_id   UUID UNIQUE,
  full_name               TEXT NOT NULL,
  email                   TEXT,
  area                    TEXT NOT NULL,
  area_orqestrai          TEXT,
  cargo                   TEXT,
  nivel_hierarquico       TEXT NOT NULL DEFAULT 'colaborador'
    CHECK (nivel_hierarquico IN ('socio', 'gerente', 'coordenador', 'colaborador')),
  is_active               BOOLEAN NOT NULL DEFAULT true,
  admission_date          DATE,
  termination_date        DATE,
  vios_ci                 TEXT,
  responsum_user_id       UUID,
  responsum_email         TEXT,
  synced_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX colaboradores_area_idx ON public.colaboradores (area);
CREATE INDEX colaboradores_email_idx ON public.colaboradores (lower(email));
CREATE INDEX colaboradores_nivel_hierarquico_idx ON public.colaboradores (nivel_hierarquico);
CREATE INDEX colaboradores_is_active_idx ON public.colaboradores (is_active);

COMMENT ON TABLE public.colaboradores IS
  'Espelho canônico de colaboradores do escritório, sincronizado de ORQESTRAI.hr_employees (scripts/sync-colaboradores.mjs). Usado pelo módulo Eficiência para vincular pessoa/área/hierarquia, e para acesso granular por módulo (team_members.colaborador_id).';
COMMENT ON COLUMN public.colaboradores.area IS
  'Área normalizada no padrão Eficiência/RESPONSUM (ex.: Reestruturação, Contratos). Ver área_orqestrai para o valor bruto de origem.';
COMMENT ON COLUMN public.colaboradores.area_orqestrai IS
  'Valor bruto de hr_employees.department no ORQESTRAI (ex.: Insolvência), preservado para rastreio do de-para.';
COMMENT ON COLUMN public.colaboradores.nivel_hierarquico IS
  'Derivado do cargo (hr_employees.position) no sync: contém "Sócio" -> socio; "Gerente" -> gerente; "Coordenador" -> coordenador; senão colaborador.';
COMMENT ON COLUMN public.colaboradores.responsum_user_id IS
  'app_c009c0e4f1_users.id na RESPONSUM quando houve match por e-mail. NULL se não encontrado (ver colaboradores_divergencias).';

-- ============================================================
-- DIVERGÊNCIAS ORQESTRAI x RESPONSUM (diagnóstico, não altera nada nos sistemas de origem)
-- ============================================================
CREATE TABLE public.colaboradores_divergencias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           TEXT NOT NULL
    CHECK (tipo IN ('sem_conta_responsum', 'sem_registro_orqestrai', 'area_diferente', 'status_diferente')),
  full_name      TEXT NOT NULL,
  email          TEXT,
  detalhe        TEXT,
  detectado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvido      BOOLEAN NOT NULL DEFAULT false,
  resolvido_em   TIMESTAMPTZ
);

CREATE INDEX colaboradores_divergencias_tipo_idx ON public.colaboradores_divergencias (tipo);
CREATE INDEX colaboradores_divergencias_resolvido_idx ON public.colaboradores_divergencias (resolvido);

COMMENT ON TABLE public.colaboradores_divergencias IS
  'Diagnóstico gerado a cada execução de scripts/sync-colaboradores.mjs: pessoas que não batem entre ORQESTRAI.hr_employees e RESPONSUM.app_c009c0e4f1_users (por e-mail). Apenas leitura/alerta — nenhum dado é alterado nos sistemas de origem.';

-- ============================================================
-- updated_at automático (reaproveita a função compartilhada set_sp_updated_at)
-- ============================================================
CREATE TRIGGER colaboradores_updated_at BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

-- ============================================================
-- RLS (mesmo padrão permissivo das demais tabelas do painel Eficiência)
-- ============================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['colaboradores', 'colaboradores_divergencias']
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
