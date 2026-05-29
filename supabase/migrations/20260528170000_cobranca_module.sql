-- Modulo de Cobranca Automatizada (SIOE)
-- Tabelas: cobranca_eventos, cobranca_arquivamentos, whatsapp_chats, whatsapp_mensagens
-- View: cobranca_painel (parcelas vencidas D+1 com status de cobranca por canal)
-- Seeds: templates de mensagem em app_settings
-- RLS permissiva (padrao do projeto: leitura/escrita para authenticated; edge functions usam service_role)

-- =========================================================
-- 1) cobranca_eventos: log de cada disparo (whatsapp/email)
-- =========================================================
CREATE TABLE IF NOT EXISTS cobranca_eventos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id          UUID NOT NULL REFERENCES financeiro_parcelas(id) ON DELETE CASCADE,
  pessoa_id           UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  canal               TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email')),
  status              TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'erro')),
  destino             TEXT,
  mensagem            TEXT,
  provider_message_id TEXT,
  erro                TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cobranca_eventos IS 'Registro de cada cobranca disparada (WhatsApp/E-mail) por parcela.';
CREATE INDEX IF NOT EXISTS idx_cobranca_eventos_parcela ON cobranca_eventos(parcela_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_eventos_canal_status ON cobranca_eventos(canal, status);

ALTER TABLE cobranca_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cobranca_eventos_select_authenticated ON cobranca_eventos;
CREATE POLICY cobranca_eventos_select_authenticated ON cobranca_eventos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cobranca_eventos_insert_authenticated ON cobranca_eventos;
CREATE POLICY cobranca_eventos_insert_authenticated ON cobranca_eventos FOR INSERT TO authenticated WITH CHECK (true);

-- =========================================================
-- 2) cobranca_arquivamentos: remocao manual de uma parcela do painel
-- =========================================================
CREATE TABLE IF NOT EXISTS cobranca_arquivamentos (
  parcela_id    UUID PRIMARY KEY REFERENCES financeiro_parcelas(id) ON DELETE CASCADE,
  motivo        TEXT,
  arquivado_by  TEXT,
  arquivado_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE cobranca_arquivamentos IS 'Parcelas removidas manualmente do painel de cobranca (com possibilidade de reverter).';

ALTER TABLE cobranca_arquivamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cobranca_arquivamentos_all_authenticated ON cobranca_arquivamentos;
CREATE POLICY cobranca_arquivamentos_all_authenticated ON cobranca_arquivamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- 3) whatsapp_chats: conversas sincronizadas da Evolution
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_chats (
  remote_jid            TEXT PRIMARY KEY,
  instance              TEXT,
  push_name             TEXT,
  profile_pic_url       TEXT,
  last_message_at       TIMESTAMPTZ,
  last_message_preview  TEXT,
  unread_count          INTEGER NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE whatsapp_chats IS 'Conversas de WhatsApp (Evolution API) para a caixa de entrada.';
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_last_message ON whatsapp_chats(last_message_at DESC NULLS LAST);

ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_chats_all_authenticated ON whatsapp_chats;
CREATE POLICY whatsapp_chats_all_authenticated ON whatsapp_chats FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- 4) whatsapp_mensagens: mensagens das conversas
-- =========================================================
CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance    TEXT,
  remote_jid  TEXT NOT NULL,
  message_id  TEXT,
  from_me     BOOLEAN NOT NULL DEFAULT false,
  tipo        TEXT,
  conteudo    TEXT,
  "timestamp" TIMESTAMPTZ,
  raw         JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE whatsapp_mensagens IS 'Mensagens de WhatsApp (Evolution API), alimentadas por webhook e sync.';
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_mensagens_message_id ON whatsapp_mensagens(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_jid_ts ON whatsapp_mensagens(remote_jid, "timestamp");

ALTER TABLE whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_mensagens_all_authenticated ON whatsapp_mensagens;
CREATE POLICY whatsapp_mensagens_all_authenticated ON whatsapp_mensagens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- 5) View cobranca_painel
--    Parcelas vencidas (D+1) em aberto, nao arquivadas, com status de cobranca.
--    A linha sai do painel quando: paga (situacao != ABERTO, ja excluida),
--    arquivada (excluida), ou concluido = tem_whatsapp AND tem_email (filtro no front).
-- =========================================================
CREATE OR REPLACE VIEW cobranca_painel
WITH (security_invoker = on)
AS
SELECT
  fp.id                          AS parcela_id,
  fp.pessoa_id,
  fp.cliente,
  fp.nro_titulo,
  fp.parcela,
  fp.parcelas,
  fp.descricao,
  fp.data_vencimento,
  fp.valor,
  (CURRENT_DATE - fp.data_vencimento) AS dias_atraso,
  p.nome                         AS pessoa_nome,
  p.grupo_cliente,
  p.telefone                     AS pessoa_telefone,
  p.email                        AS pessoa_email,
  COALESCE(ev.tem_whatsapp, false) AS tem_whatsapp,
  COALESCE(ev.tem_email, false)    AS tem_email,
  COALESCE(ev.cobrancas_total, 0)  AS cobrancas_total,
  ev.ultima_cobranca_at,
  (COALESCE(ev.tem_whatsapp, false) AND COALESCE(ev.tem_email, false)) AS concluido
FROM financeiro_parcelas fp
LEFT JOIN pessoas p ON p.id = fp.pessoa_id
LEFT JOIN LATERAL (
  SELECT
    bool_or(ce.canal = 'whatsapp' AND ce.status = 'enviado') AS tem_whatsapp,
    bool_or(ce.canal = 'email' AND ce.status = 'enviado')    AS tem_email,
    count(*) FILTER (WHERE ce.status = 'enviado')            AS cobrancas_total,
    max(ce.created_at)                                       AS ultima_cobranca_at
  FROM cobranca_eventos ce
  WHERE ce.parcela_id = fp.id
) ev ON true
WHERE fp.situacao = 'ABERTO'
  AND fp.data_vencimento < CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id
  );

COMMENT ON VIEW cobranca_painel IS 'Painel de cobranca: parcelas vencidas em aberto, nao arquivadas, com flags de cobranca por canal.';

-- =========================================================
-- 6) Seeds: templates de mensagem (app_settings)
-- =========================================================
INSERT INTO app_settings (key, value) VALUES
  ('cobranca_template_whatsapp', to_jsonb('Ola, {{nome}}

Nao identificamos o pagamento do honorario referente aos servicos advocaticios no valor de {{valor}}, com vencimento em {{vencimento}}.

Caso ja tenha realizado o pagamento, peco que nos encaminhe o respectivo comprovante para identificacao.

Atenciosamente, Bismarchi Pires Advogados.

{{usuario}}'::text))
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value) VALUES
  ('cobranca_template_email_assunto', to_jsonb('Cobranca - Titulo {{titulo}} vencido em {{vencimento}}'::text))
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value) VALUES
  ('cobranca_template_email_corpo', to_jsonb('Prezado(a) {{nome}},

Identificamos em nosso sistema o titulo {{titulo}} ({{descricao}}), no valor de {{valor}}, com vencimento em {{vencimento}}, atualmente com {{dias_atraso}} dia(s) em atraso.

Solicitamos a regularizacao do pagamento. Caso ja tenha efetuado, por favor desconsidere este e-mail.

Atenciosamente,
Bismarchi Pires Advogados'::text))
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 7) Realtime: publicar tabelas de WhatsApp
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_mensagens;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_chats;
  END IF;
END $$;
