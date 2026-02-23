-- Lançamentos de horas por data/grupo/cliente (fonte: VIOS TimeSheets).
-- Sincronizada pelo script no vios-app; total_horas em decimal.

CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  grupo_cliente TEXT,
  cliente TEXT NOT NULL,
  total_horas NUMERIC(12, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timesheets_data ON timesheets(data);
CREATE INDEX idx_timesheets_grupo_cliente ON timesheets(grupo_cliente);
CREATE INDEX idx_timesheets_cliente ON timesheets(cliente);
CREATE INDEX idx_timesheets_data_grupo ON timesheets(data, grupo_cliente);

COMMENT ON TABLE timesheets IS 'Horas lançadas por data, grupo e cliente (VIOS TimeSheets). total_horas em decimal.';

CREATE TRIGGER timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON timesheets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon (dev)" ON timesheets
  FOR ALL TO anon USING (true) WITH CHECK (true);
