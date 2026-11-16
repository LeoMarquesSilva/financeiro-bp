-- Planejamento 2027: ajuste PROVISÓRIO da receita 2025 até o VIOS ser corrigido.
--
-- A receita 2025 do VIOS (regra da Receita: honorários na cota, recebidos sem juros, por data de
-- pagamento) soma R$ 10.283.718,39; o controle financeiro (aba "Base CR" de
-- Receita_Bruta_Dashboard_Setembro_2026.xlsx = classe Honorários da aba REC do
-- FLUXO_DE_CAIXA_OPERACIONAL_2025) soma R$ 11.011.433,25. Em 2026 os dois batem ao centavo.
-- Decisão do usuário (11/11/2026): o planejamento usa o total mensal do controle em 2025 e a
-- diferença vai para a área de cada recebimento:
--   * recebimento do controle ligado a um título do VIOS → área do título;
--   * sem título → rateio por área do controle; senão o centro de custo do controle;
--   * título pago só no VIOS → sai da área dele;
--   * o que não tem área no controle e a diferença Excel × aba REC → rateados pela receita do VIOS do mês.
-- Soma de cada mês = Excel − VIOS. Conciliação linha a linha em exports/conciliacao-receita-2025-excel-x-vios.xlsx.
-- Quando o VIOS for corrigido, apagar as linhas do ano: DELETE FROM planejamento_receita_ajuste WHERE ano = 2025.

CREATE TABLE IF NOT EXISTS public.planejamento_receita_ajuste (
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  area_key text NOT NULL CHECK (area_key IN ('insolvencia', 'trabalhista', 'civel', 'contratos', 'rec_credito', 'add', 'tributario', 'sem_area')),
  valor numeric(15, 2) NOT NULL,
  fonte text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, mes, area_key)
);

COMMENT ON TABLE public.planejamento_receita_ajuste IS
  'Ajuste provisório da receita (controle financeiro − VIOS) por mês e área, somado à receita do VIOS no Planejamento. Apagar quando o VIOS for corrigido.';

ALTER TABLE public.planejamento_receita_ajuste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planejamento_receita_ajuste_leitura ON public.planejamento_receita_ajuste;
CREATE POLICY planejamento_receita_ajuste_leitura ON public.planejamento_receita_ajuste
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.planejamento_receita_ajuste FROM anon;
GRANT SELECT ON public.planejamento_receita_ajuste TO authenticated;

DELETE FROM public.planejamento_receita_ajuste WHERE ano = 2025;
INSERT INTO public.planejamento_receita_ajuste (ano, mes, area_key, valor, fonte)
SELECT v.ano, v.mes, v.area_key, v.valor, 'Controle financeiro 2025 (Receita_Bruta_Dashboard_Setembro_2026.xlsx, aba Base CR) − VIOS; conciliação de 11/11/2026'
FROM (VALUES
  (2025, 1, 'add', 31.88),
  (2025, 1, 'civel', -8334.88),
  (2025, 1, 'contratos', 12661.37),
  (2025, 1, 'insolvencia', 5440.27),
  (2025, 1, 'trabalhista', -9515.63),
  (2025, 1, 'tributario', 3.80),
  (2025, 2, 'civel', 36410.10),
  (2025, 2, 'contratos', 360.00),
  (2025, 2, 'insolvencia', 15533.63),
  (2025, 2, 'trabalhista', 7893.28),
  (2025, 3, 'add', 13649.59),
  (2025, 3, 'civel', 30669.15),
  (2025, 3, 'contratos', 6063.46),
  (2025, 3, 'insolvencia', 52999.63),
  (2025, 3, 'trabalhista', 22939.20),
  (2025, 3, 'tributario', 546.73),
  (2025, 4, 'add', -5863.87),
  (2025, 4, 'civel', 61582.00),
  (2025, 4, 'contratos', 12856.26),
  (2025, 4, 'insolvencia', 2193.09),
  (2025, 4, 'trabalhista', 4926.77),
  (2025, 5, 'add', 32946.28),
  (2025, 5, 'civel', 5279.46),
  (2025, 5, 'contratos', 11892.43),
  (2025, 5, 'insolvencia', 70193.68),
  (2025, 5, 'trabalhista', 12888.57),
  (2025, 5, 'tributario', 220.99),
  (2025, 6, 'add', 61612.40),
  (2025, 6, 'civel', -4539.54),
  (2025, 6, 'contratos', 421.24),
  (2025, 6, 'insolvencia', 29408.77),
  (2025, 6, 'sem_area', 5.82),
  (2025, 6, 'trabalhista', -1394.30),
  (2025, 7, 'add', -11329.86),
  (2025, 7, 'civel', -7907.58),
  (2025, 7, 'contratos', -15118.36),
  (2025, 7, 'insolvencia', 37194.50),
  (2025, 7, 'sem_area', -4350.00),
  (2025, 7, 'trabalhista', 3959.06),
  (2025, 7, 'tributario', 16.96),
  (2025, 8, 'add', 21470.26),
  (2025, 8, 'civel', -9514.96),
  (2025, 8, 'contratos', -2054.46),
  (2025, 8, 'insolvencia', 17974.90),
  (2025, 8, 'sem_area', -3500.00),
  (2025, 8, 'trabalhista', -4090.07),
  (2025, 8, 'tributario', 576.08),
  (2025, 9, 'add', 49737.39),
  (2025, 9, 'civel', 226868.35),
  (2025, 9, 'contratos', 4644.05),
  (2025, 9, 'insolvencia', 10000.03),
  (2025, 9, 'sem_area', 4066.70),
  (2025, 9, 'trabalhista', 10694.22),
  (2025, 9, 'tributario', 713.52),
  (2025, 10, 'add', -2176.83),
  (2025, 10, 'civel', -5097.05),
  (2025, 10, 'contratos', 10746.35),
  (2025, 10, 'insolvencia', -1599.61),
  (2025, 10, 'sem_area', 14.00),
  (2025, 10, 'trabalhista', -10213.87),
  (2025, 10, 'tributario', -635.36),
  (2025, 11, 'add', -2973.85),
  (2025, 11, 'civel', -2030.34),
  (2025, 11, 'contratos', 927.67),
  (2025, 11, 'insolvencia', -72909.66),
  (2025, 11, 'sem_area', 500.00),
  (2025, 11, 'trabalhista', 22187.88),
  (2025, 11, 'tributario', 5.82),
  (2025, 12, 'add', 9155.69),
  (2025, 12, 'civel', -16884.60),
  (2025, 12, 'contratos', 26084.47),
  (2025, 12, 'insolvencia', -20532.40),
  (2025, 12, 'trabalhista', -14715.17),
  (2025, 12, 'tributario', -4170.64)
) AS v(ano, mes, area_key, valor);
