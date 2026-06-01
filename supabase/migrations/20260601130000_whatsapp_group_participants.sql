-- Participantes de grupos WhatsApp (cache da Evolution API + nomes enriquecidos).

CREATE TABLE IF NOT EXISTS whatsapp_group_participants (
  group_jid         TEXT NOT NULL,
  participant_jid TEXT NOT NULL,
  lid_id            TEXT,
  phone_number      TEXT,
  display_name      TEXT,
  profile_pic_url   TEXT,
  admin_role        TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_jid, participant_jid)
);

COMMENT ON TABLE whatsapp_group_participants IS 'Membros de grupos WhatsApp (@g.us), sincronizados da Evolution API.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_group_participants_group
  ON whatsapp_group_participants (group_jid);

CREATE INDEX IF NOT EXISTS idx_whatsapp_group_participants_lid
  ON whatsapp_group_participants (group_jid, lid_id);

ALTER TABLE whatsapp_group_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_group_participants_all_authenticated ON whatsapp_group_participants;
CREATE POLICY whatsapp_group_participants_all_authenticated
  ON whatsapp_group_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_group_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_group_participants;
  END IF;
END $$;
