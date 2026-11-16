-- Cobrança D+1: feriados de sp_feriados (Feriados.xlsx) também não são dia útil.
-- Ex.: venc. 10/10 (sáb) → 12/10 feriado → efetivo 13/10 (ter) → cobrança 14/10 (qua).
-- A cobrança trabalha em 28/10 (Servidor Público) e 19/11 (Dia da Bandeira): esses ficam de fora.
-- Indicador: cobrado entre o vencimento e o D+1 conta como dentro (antes era só no dia exato).

CREATE OR REPLACE FUNCTION public.cobranca_eh_feriado(d date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sp_feriados f
    WHERE d BETWEEN f.data AND COALESCE(f.data_fim, f.data)
      AND COALESCE(f.nome, '') !~* '(servidor|bandeira)'
  );
$$;

COMMENT ON FUNCTION public.cobranca_eh_feriado(date) IS
  'Feriado para a cobrança (sp_feriados), exceto Dia do Servidor Público e Dia da Bandeira, em que a cobrança trabalha.';

CREATE OR REPLACE FUNCTION public.cobranca_proximo_dia_util(d date)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF d IS NULL THEN
    RETURN NULL;
  END IF;
  WHILE EXTRACT(ISODOW FROM d) IN (6, 7) OR public.cobranca_eh_feriado(d) LOOP
    d := d + 1;
  END LOOP;
  RETURN d;
END;
$$;

COMMENT ON FUNCTION public.cobranca_proximo_dia_util(date) IS
  'Avança a data até cair em dia útil (segunda a sexta, fora dos feriados da cobrança).';

CREATE OR REPLACE FUNCTION public.cobranca_vencimento_efetivo(data_vencimento date)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT public.cobranca_proximo_dia_util(data_vencimento);
$$;

COMMENT ON FUNCTION public.cobranca_vencimento_efetivo(date) IS
  'Vencimento efetivo: se cair em sábado, domingo ou feriado, prorroga para o próximo dia útil.';

CREATE OR REPLACE FUNCTION public.cobranca_prazo_d1(data_vencimento date)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT public.cobranca_proximo_dia_util(
    public.cobranca_vencimento_efetivo(data_vencimento) + 1
  );
$$;

COMMENT ON FUNCTION public.cobranca_prazo_d1(date) IS
  'Data-alvo da cobrança D+1: 1 dia útil após o vencimento efetivo (fim de semana e feriado não contam).';

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
  adj.plano_contas,
  fp.data_vencimento,
  adj.valor,
  GREATEST(
    0,
    (CURRENT_DATE - public.cobranca_prazo_d1(fp.data_vencimento))::integer
  ) AS dias_atraso,
  p.nome                         AS pessoa_nome,
  p.grupo_cliente,
  p.telefone                     AS pessoa_telefone,
  p.email                        AS pessoa_email,
  public.cobranca_vencimento_efetivo(fp.data_vencimento) AS data_vencimento_efetivo,
  public.cobranca_prazo_d1(fp.data_vencimento) AS data_prazo_d1,
  COALESCE(ev.tem_whatsapp, false) AS tem_whatsapp,
  COALESCE(ev.tem_whatsapp_d1, false) AS tem_whatsapp_d1,
  COALESCE(ev.tem_email, false)    AS tem_email,
  COALESCE(ev.cobrancas_total, 0)  AS cobrancas_total,
  ev.ultima_cobranca_at,
  ev.ultima_cobranca_canal,
  COALESCE(ev.tem_whatsapp, false) AS concluido
FROM financeiro_parcelas fp
LEFT JOIN pessoas p ON p.id = fp.pessoa_id
CROSS JOIN LATERAL (
  SELECT
    public.financeiro_parcela_valor_sem_outras_receitas(fp.ci_titulo, fp.valor, fp.plano_contas) AS valor,
    public.financeiro_parcela_plano_sem_outras_receitas(fp.ci_titulo, fp.plano_contas) AS plano_contas
) adj
LEFT JOIN LATERAL (
  SELECT
    bool_or(ce.canal = 'whatsapp' AND ce.status = 'enviado') AS tem_whatsapp,
    bool_or(
      ce.canal = 'whatsapp'
      AND ce.status = 'enviado'
      AND (ce.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        BETWEEN fp.data_vencimento AND public.cobranca_prazo_d1(fp.data_vencimento)
    ) AS tem_whatsapp_d1,
    bool_or(ce.canal = 'email' AND ce.status = 'enviado')    AS tem_email,
    count(*) FILTER (WHERE ce.status = 'enviado')            AS cobrancas_total,
    max(ce.created_at) FILTER (WHERE ce.status = 'enviado')  AS ultima_cobranca_at,
    (
      SELECT ce2.canal::text
      FROM cobranca_eventos ce2
      WHERE ce2.parcela_id = fp.id AND ce2.status = 'enviado'
      ORDER BY ce2.created_at DESC
      LIMIT 1
    ) AS ultima_cobranca_canal
  FROM cobranca_eventos ce
  WHERE ce.parcela_id = fp.id
) ev ON true
WHERE fp.situacao = 'ABERTO'
  AND public.financeiro_titulo_eh_receber(fp.tipo)
  AND CURRENT_DATE >= public.cobranca_prazo_d1(fp.data_vencimento)
  AND NOT public.cobranca_eh_saldo_parcial(fp.nro_titulo)
  AND adj.valor > 0.005
  AND NOT EXISTS (
    SELECT 1 FROM cobranca_arquivamentos a WHERE a.parcela_id = fp.id
  );

COMMENT ON VIEW cobranca_painel IS
  'Painel de cobrança (RECEBER), sem itens de OUTRAS RECEITAS. tem_whatsapp_d1 = WhatsApp enviado entre o vencimento e o data_prazo_d1 (fim de semana e feriado não contam).';

GRANT EXECUTE ON FUNCTION public.cobranca_eh_feriado(date) TO anon, authenticated;
