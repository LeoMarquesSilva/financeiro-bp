-- Maio/2026: remove R$ 10.000 do Grupo Recicla (LAtasa — pagamento antecipado) do snapshot congelado.

UPDATE public.receita_inadimplencia_fechamento_mensal
SET
  valor_total = 345166.71,
  pct_recebido = ROUND((345166.71 / public.receita_previsto_mes(2026, 5)) * 100, 1),
  congelado_em = now()
WHERE ano = 2026
  AND mes = 5;
