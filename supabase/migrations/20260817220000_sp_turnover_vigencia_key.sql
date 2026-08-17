-- Turnover: mesma admissão pode gerar transferência + desligamento final (área/desligamento distintos).
-- A chave (nome, admissao) sozinha descartava linhas no sync (ex.: Mariana Boscatto Ops Legais 2025).

ALTER TABLE public.sp_turnover
  DROP CONSTRAINT IF EXISTS sp_turnover_nome_admissao_key;

CREATE UNIQUE INDEX sp_turnover_vigencia_key ON public.sp_turnover (
  nome,
  admissao,
  COALESCE(area, ''),
  COALESCE(desligamento, DATE '9999-12-31')
);

COMMENT ON INDEX public.sp_turnover_vigencia_key IS
  'Vigência turnover: nome+admissão+área+desligamento (permite transferência com mesma admissão).';

-- Backfill: linha perdida no dedupe antigo (Voluntário Ops Legais 30/05/2025).
INSERT INTO public.sp_turnover (nome, area, cargo, admissao, desligamento, tipo_desligamento)
SELECT
  'MARIANA BOSCATTO VIEIRA DA SILVA',
  'Operações Legais',
  'Supervisor',
  DATE '2021-03-16',
  DATE '2025-05-30',
  'Voluntário'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sp_turnover t
  WHERE t.nome = 'MARIANA BOSCATTO VIEIRA DA SILVA'
    AND COALESCE(t.area, '') = 'Operações Legais'
    AND t.admissao = DATE '2021-03-16'
    AND t.desligamento = DATE '2025-05-30'
);
