CREATE OR REPLACE VIEW "public"."clients_inadimplencia_list" AS
 WITH base AS (
         SELECT c.id,
            c.razao_social,
            c.cnpj,
            c.contato,
            c.gestor,
            c.area,
            c.status_classe,
            c.dias_em_aberto,
            c.valor_em_aberto,
            c.valor_mensal,
            c.qtd_processos,
            c.horas_total,
            c.horas_por_ano,
            c.prioridade,
            c.data_vencimento,
            c.observacoes_gerais,
            c.ultima_providencia,
            c.data_providencia,
            c.follow_up,
            c.data_follow_up,
            c.resolvido_at,
            c.reaberto_at,
            c.pessoa_id,
            c.created_at,
            c.updated_at,
            c.created_by,
            COALESCE(( SELECT GREATEST(0, (CURRENT_DATE - fp.data_vencimento)) AS "greatest"
                   FROM financeiro_parcelas fp
                  WHERE (((fp.pessoa_id IN ( SELECT p2.id
                           FROM pessoas p2
                          WHERE ((p2.grupo_cliente = ( SELECT p1.grupo_cliente
                                   FROM pessoas p1
                                  WHERE (p1.id = c.pessoa_id)
                                 LIMIT 1)) AND (( SELECT p1.grupo_cliente
                                   FROM pessoas p1
                                  WHERE (p1.id = c.pessoa_id)
                                 LIMIT 1) IS NOT NULL)))) OR ((fp.pessoa_id = c.pessoa_id) AND (( SELECT p1.grupo_cliente
                           FROM pessoas p1
                          WHERE (p1.id = c.pessoa_id)
                         LIMIT 1) IS NULL))) AND (fp.situacao = 'ABERTO'::text) AND (fp.data_vencimento < CURRENT_DATE))
                  ORDER BY fp.data_vencimento
                 LIMIT 1), c.dias_em_aberto) AS dias_computado,
            COALESCE(
              CASE WHEN c.pessoa_id IS NOT NULL THEN
                (
                  SELECT COALESCE(SUM(fp.valor), 0)
                  FROM financeiro_parcelas fp
                  WHERE (
                    (
                      (fp.pessoa_id IN ( SELECT p2.id FROM pessoas p2 WHERE (p2.grupo_cliente = (SELECT p1.grupo_cliente FROM pessoas p1 WHERE p1.id = c.pessoa_id LIMIT 1) AND (SELECT p1.grupo_cliente FROM pessoas p1 WHERE p1.id = c.pessoa_id LIMIT 1) IS NOT NULL))) 
                      OR 
                      (fp.pessoa_id = c.pessoa_id AND (SELECT p1.grupo_cliente FROM pessoas p1 WHERE p1.id = c.pessoa_id LIMIT 1) IS NULL)
                    ) 
                    AND fp.situacao = 'ABERTO'::text 
                    AND fp.data_vencimento < CURRENT_DATE
                  )
                )
              ELSE NULL END,
              c.valor_em_aberto
            )::numeric(12,2) AS valor_em_aberto_computado,
            COALESCE(( SELECT fp.valor
                   FROM financeiro_parcelas fp
                  WHERE (((fp.pessoa_id IN ( SELECT p2.id
                           FROM pessoas p2
                          WHERE ((p2.grupo_cliente = ( SELECT p1.grupo_cliente
                                   FROM pessoas p1
                                  WHERE (p1.id = c.pessoa_id)
                                 LIMIT 1)) AND (( SELECT p1.grupo_cliente
                                   FROM pessoas p1
                                  WHERE (p1.id = c.pessoa_id)
                                 LIMIT 1) IS NOT NULL)))) OR ((fp.pessoa_id = c.pessoa_id) AND (( SELECT p1.grupo_cliente
                           FROM pessoas p1
                          WHERE (p1.id = c.pessoa_id)
                         LIMIT 1) IS NULL))) AND (fp.situacao = 'ABERTO'::text) AND (fp.data_vencimento >= CURRENT_DATE))
                  ORDER BY fp.data_vencimento
                 LIMIT 1), c.valor_mensal) AS valor_mensal_computado
           FROM clients_inadimplencia c
        )
 SELECT id,
    razao_social,
    cnpj,
    contato,
    gestor,
    area,
    status_classe,
    valor_em_aberto_computado AS valor_em_aberto,
    qtd_processos,
    horas_total,
    horas_por_ano,
    data_vencimento,
    observacoes_gerais,
    ultima_providencia,
    data_providencia,
    follow_up,
    data_follow_up,
    resolvido_at,
    reaberto_at,
    pessoa_id,
    created_at,
    updated_at,
    created_by,
    dias_computado AS dias_em_aberto,
    valor_mensal_computado AS valor_mensal,
        CASE
            WHEN (dias_computado > 5) THEN 'urgente'::text
            WHEN (dias_computado >= 3) THEN 'atencao'::text
            ELSE 'controlado'::text
        END AS prioridade
   FROM base;