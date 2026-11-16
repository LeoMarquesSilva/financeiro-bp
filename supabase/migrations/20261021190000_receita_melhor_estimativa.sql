-- Melhor estimativa (ME) contínua da Receita.
-- Cada gerente confirma uma vez a carteira da área até dezembro e só volta quando
-- aparece novidade (título novo no VIOS, pagamento de quem estava como "não deve
-- pagar", nova receita estimada que virou título). Os valores de carteira e caixa
-- vêm ao vivo do VIOS; aqui ficam só as decisões manuais, o que o gerente já viu
-- e o histórico de alterações.

-- ---------------------------------------------------------------------------
-- Helpers de identidade
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.receita_me_usuario_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

/** Local-part do e-mail: o domínio varia entre bpplaw e bismarchipires. */
CREATE OR REPLACE FUNCTION public.receita_me_email_local(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT split_part(lower(trim(coalesce(p_email, ''))), '@', 1);
$$;

-- ---------------------------------------------------------------------------
-- 1. Responsáveis por área
-- ---------------------------------------------------------------------------

CREATE TABLE public.receita_me_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_key text NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE UNIQUE INDEX receita_me_responsaveis_area_email_uidx
  ON public.receita_me_responsaveis (area_key, lower(email));

COMMENT ON TABLE public.receita_me_responsaveis IS
  'Gerente(s) que preenchem a melhor estimativa de cada área da Receita.';

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

/**
 * Admin ativo edita qualquer área; responsável ativo edita só a própria.
 * Financeiro fica de fora de propósito: há gerente de área com esse perfil.
 */
CREATE OR REPLACE FUNCTION public.receita_me_pode_editar(p_area_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR (
      public.receita_me_email_local(public.receita_me_usuario_email()) <> ''
      AND EXISTS (
        SELECT 1
        FROM receita_me_responsaveis r
        WHERE r.ativo
          AND r.area_key = p_area_key
          AND public.receita_me_email_local(r.email)
            = public.receita_me_email_local(public.receita_me_usuario_email())
      )
    );
$$;

/** Quem vê a visão do escritório (mesmos perfis da Receita). */
CREATE OR REPLACE FUNCTION public.receita_me_pode_ver_escritorio()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE lower(tm.email) = public.receita_me_usuario_email()
      AND tm.role IN ('admin', 'financeiro', 'comite')
      AND coalesce(tm.is_active, true) = true
  );
$$;

/** Áreas em que o usuário logado é responsável pela ME. */
CREATE OR REPLACE FUNCTION public.receita_me_minhas_areas()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.area_key
  FROM receita_me_responsaveis r
  WHERE r.ativo
    AND public.receita_me_email_local(public.receita_me_usuario_email()) <> ''
    AND public.receita_me_email_local(r.email)
      = public.receita_me_email_local(public.receita_me_usuario_email());
$$;

GRANT EXECUTE ON FUNCTION public.receita_me_pode_editar(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receita_me_pode_ver_escritorio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.receita_me_minhas_areas() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Confirmação da área
-- ---------------------------------------------------------------------------

CREATE TABLE public.receita_me_area_status (
  ano integer NOT NULL,
  area_key text NOT NULL,
  confirmada_em timestamptz,
  confirmada_por text,
  confirmada_por_nome text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (ano, area_key)
);

COMMENT ON TABLE public.receita_me_area_status IS
  'Quando cada área confirmou a melhor estimativa do ano (a partir daí só revisa novidades).';

-- ---------------------------------------------------------------------------
-- 3. Carteira já vista pelo gerente (base das novidades)
-- ---------------------------------------------------------------------------

CREATE TABLE public.receita_me_vistos (
  ano integer NOT NULL,
  area_key text NOT NULL,
  grupo text NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor_visto numeric(14, 2) NOT NULL DEFAULT 0,
  visto_em timestamptz NOT NULL DEFAULT now(),
  visto_por text DEFAULT public.receita_me_usuario_email(),
  PRIMARY KEY (ano, area_key, grupo, mes)
);

COMMENT ON TABLE public.receita_me_vistos IS
  'Previsto (grupo × mês) que o gerente já revisou. Valor acima disso vira novidade.';

-- ---------------------------------------------------------------------------
-- 4. Ajustes da carteira (grupo × mês)
-- ---------------------------------------------------------------------------

CREATE TABLE public.receita_me_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  area_key text NOT NULL,
  grupo text NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  tipo text NOT NULL CHECK (tipo IN ('nao_paga', 'vai_pagar')),
  valor_marcado numeric(14, 2) NOT NULL DEFAULT 0,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text DEFAULT public.receita_me_usuario_email(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE (ano, area_key, grupo, mes)
);

COMMENT ON TABLE public.receita_me_ajustes IS
  'Decisão do gerente sobre o valor em aberto de um grupo no mês: nao_paga (fora da ME) ou vai_pagar (título em atraso que deve entrar).';
COMMENT ON COLUMN public.receita_me_ajustes.valor_marcado IS
  'Valor em aberto no momento da marcação; se cair, o cliente pagou (vira novidade).';

-- ---------------------------------------------------------------------------
-- 5. Novas receitas (cliente existente, lead, êxito/acordo)
-- ---------------------------------------------------------------------------

CREATE TABLE public.receita_me_novas_receitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  area_key text NOT NULL,
  nome text NOT NULL,
  grupo_cliente text,
  origem text NOT NULL CHECK (origem IN ('cliente_existente', 'lead', 'exito_acordo', 'outro')),
  tipo_receita text,
  recorrencia text NOT NULL CHECK (recorrencia IN ('pontual', 'mensal')),
  mes_inicio integer NOT NULL CHECK (mes_inicio BETWEEN 1 AND 12),
  mes_fim integer NOT NULL CHECK (mes_fim BETWEEN 1 AND 12),
  valor numeric(14, 2) NOT NULL CHECK (valor > 0),
  chance text NOT NULL DEFAULT 'media' CHECK (chance IN ('alta', 'media', 'baixa')),
  observacao text,
  meses_baixados integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text DEFAULT public.receita_me_usuario_email(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CHECK (mes_fim >= mes_inicio)
);

CREATE INDEX receita_me_novas_receitas_ano_area_idx
  ON public.receita_me_novas_receitas (ano, area_key);

COMMENT ON TABLE public.receita_me_novas_receitas IS
  'Receita que ainda não existe no VIOS. Valor por mês quando mensal. Chance baixa fica fora da ME (potencial).';
COMMENT ON COLUMN public.receita_me_novas_receitas.meses_baixados IS
  'Meses em que a estimativa virou título no VIOS e deixou de contar (evita contagem dupla).';

-- ---------------------------------------------------------------------------
-- 6. Foto mensal da projeção (evolução sem rodadas)
-- ---------------------------------------------------------------------------

CREATE TABLE public.receita_me_snapshot_mensal (
  ano integer NOT NULL,
  mes_ref integer NOT NULL CHECK (mes_ref BETWEEN 1 AND 12),
  area_key text NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  base text NOT NULL CHECK (base IN ('realizado', 'me')),
  valor numeric(14, 2) NOT NULL DEFAULT 0,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  gerado_por text DEFAULT public.receita_me_usuario_email(),
  PRIMARY KEY (ano, mes_ref, area_key, mes)
);

COMMENT ON TABLE public.receita_me_snapshot_mensal IS
  'Projeção (realizado + ME) registrada no primeiro acesso de cada mês à visão do escritório.';

-- ---------------------------------------------------------------------------
-- 7. Histórico de alterações
-- ---------------------------------------------------------------------------

CREATE TABLE public.receita_me_historico (
  id bigserial PRIMARY KEY,
  ano integer,
  area_key text,
  tabela text NOT NULL,
  operacao text NOT NULL,
  antes jsonb,
  depois jsonb,
  usuario_email text,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX receita_me_historico_ano_area_idx
  ON public.receita_me_historico (ano, area_key, created_at DESC);

COMMENT ON TABLE public.receita_me_historico IS
  'Quem alterou o quê na melhor estimativa (gravado por trigger).';

-- ---------------------------------------------------------------------------
-- Triggers: auditoria de updated_* e histórico
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.receita_me_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := nullif(public.receita_me_usuario_email(), '');
  RETURN NEW;
END;
$$;

CREATE TRIGGER receita_me_responsaveis_touch
  BEFORE INSERT OR UPDATE ON public.receita_me_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.receita_me_touch();

CREATE TRIGGER receita_me_area_status_touch
  BEFORE INSERT OR UPDATE ON public.receita_me_area_status
  FOR EACH ROW EXECUTE FUNCTION public.receita_me_touch();

CREATE TRIGGER receita_me_ajustes_touch
  BEFORE INSERT OR UPDATE ON public.receita_me_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.receita_me_touch();

CREATE TRIGGER receita_me_novas_receitas_touch
  BEFORE INSERT OR UPDATE ON public.receita_me_novas_receitas
  FOR EACH ROW EXECUTE FUNCTION public.receita_me_touch();

CREATE OR REPLACE FUNCTION public.receita_me_registrar_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_email text := nullif(public.receita_me_usuario_email(), '');
  v_nome text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  IF v_email IS NOT NULL THEN
    SELECT tm.full_name INTO v_nome
    FROM team_members tm
    WHERE lower(tm.email) = v_email
    LIMIT 1;
  END IF;

  INSERT INTO receita_me_historico (
    ano, area_key, tabela, operacao, antes, depois, usuario_email, usuario_nome
  ) VALUES (
    nullif(v_row ->> 'ano', '')::integer,
    v_row ->> 'area_key',
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    v_email,
    v_nome
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER receita_me_responsaveis_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.receita_me_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.receita_me_registrar_historico();

CREATE TRIGGER receita_me_area_status_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.receita_me_area_status
  FOR EACH ROW EXECUTE FUNCTION public.receita_me_registrar_historico();

CREATE TRIGGER receita_me_ajustes_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.receita_me_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.receita_me_registrar_historico();

CREATE TRIGGER receita_me_novas_receitas_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.receita_me_novas_receitas
  FOR EACH ROW EXECUTE FUNCTION public.receita_me_registrar_historico();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.receita_me_responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_me_area_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_me_vistos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_me_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_me_novas_receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_me_snapshot_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receita_me_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY receita_me_responsaveis_select
  ON public.receita_me_responsaveis FOR SELECT TO authenticated USING (true);
CREATE POLICY receita_me_responsaveis_insert_admin
  ON public.receita_me_responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin());
CREATE POLICY receita_me_responsaveis_update_admin
  ON public.receita_me_responsaveis FOR UPDATE TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
CREATE POLICY receita_me_responsaveis_delete_admin
  ON public.receita_me_responsaveis FOR DELETE TO authenticated
  USING (public.current_user_is_admin());

CREATE POLICY receita_me_area_status_select
  ON public.receita_me_area_status FOR SELECT TO authenticated USING (true);
CREATE POLICY receita_me_area_status_insert
  ON public.receita_me_area_status FOR INSERT TO authenticated
  WITH CHECK (public.receita_me_pode_editar(area_key));
CREATE POLICY receita_me_area_status_update
  ON public.receita_me_area_status FOR UPDATE TO authenticated
  USING (public.receita_me_pode_editar(area_key))
  WITH CHECK (public.receita_me_pode_editar(area_key));

CREATE POLICY receita_me_vistos_select
  ON public.receita_me_vistos FOR SELECT TO authenticated USING (true);
CREATE POLICY receita_me_vistos_insert
  ON public.receita_me_vistos FOR INSERT TO authenticated
  WITH CHECK (public.receita_me_pode_editar(area_key));
CREATE POLICY receita_me_vistos_update
  ON public.receita_me_vistos FOR UPDATE TO authenticated
  USING (public.receita_me_pode_editar(area_key))
  WITH CHECK (public.receita_me_pode_editar(area_key));

CREATE POLICY receita_me_ajustes_select
  ON public.receita_me_ajustes FOR SELECT TO authenticated USING (true);
CREATE POLICY receita_me_ajustes_insert
  ON public.receita_me_ajustes FOR INSERT TO authenticated
  WITH CHECK (public.receita_me_pode_editar(area_key));
CREATE POLICY receita_me_ajustes_update
  ON public.receita_me_ajustes FOR UPDATE TO authenticated
  USING (public.receita_me_pode_editar(area_key))
  WITH CHECK (public.receita_me_pode_editar(area_key));
CREATE POLICY receita_me_ajustes_delete
  ON public.receita_me_ajustes FOR DELETE TO authenticated
  USING (public.receita_me_pode_editar(area_key));

CREATE POLICY receita_me_novas_receitas_select
  ON public.receita_me_novas_receitas FOR SELECT TO authenticated USING (true);
CREATE POLICY receita_me_novas_receitas_insert
  ON public.receita_me_novas_receitas FOR INSERT TO authenticated
  WITH CHECK (public.receita_me_pode_editar(area_key));
CREATE POLICY receita_me_novas_receitas_update
  ON public.receita_me_novas_receitas FOR UPDATE TO authenticated
  USING (public.receita_me_pode_editar(area_key))
  WITH CHECK (public.receita_me_pode_editar(area_key));
CREATE POLICY receita_me_novas_receitas_delete
  ON public.receita_me_novas_receitas FOR DELETE TO authenticated
  USING (public.receita_me_pode_editar(area_key));

CREATE POLICY receita_me_snapshot_mensal_select
  ON public.receita_me_snapshot_mensal FOR SELECT TO authenticated USING (true);
CREATE POLICY receita_me_snapshot_mensal_insert
  ON public.receita_me_snapshot_mensal FOR INSERT TO authenticated
  WITH CHECK (public.receita_me_pode_ver_escritorio());

CREATE POLICY receita_me_historico_select
  ON public.receita_me_historico FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receita_me_responsaveis TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.receita_me_area_status TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.receita_me_vistos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receita_me_ajustes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receita_me_novas_receitas TO authenticated;
GRANT SELECT, INSERT ON public.receita_me_snapshot_mensal TO authenticated;
GRANT SELECT ON public.receita_me_historico TO authenticated;

-- ---------------------------------------------------------------------------
-- Responsáveis iniciais (out/2026): Renato passou para Recuperação de Crédito;
-- Trabalhista ficou só com o Daniel.
-- ---------------------------------------------------------------------------

INSERT INTO public.receita_me_responsaveis (area_key, nome, email) VALUES
  ('insolvencia', 'Leonardo Loureiro Basso', 'leonardo@bismarchipires.com.br'),
  ('trabalhista', 'Daniel Pressatto Fernandes', 'daniel@bismarchipires.com.br'),
  ('civel', 'Giancarlo Zotini', 'giancarlo@bismarchipires.com.br'),
  ('contratos', 'Wagner Armani', 'wagner.armani@bismarchipires.com.br'),
  ('recuperacao_de_credito', 'Renato Vallim', 'renato@bismarchipires.com.br');
