-- Perfil Coordenador: Overview da própria área em Eficiência Operacional
-- (sem Indicadores Resultado / Amostra Chamados; sem outras abas).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'coordenador'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'coordenador';
  END IF;
END $$;
