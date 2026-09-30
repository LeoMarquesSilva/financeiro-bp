-- Levantamento: separa tarefas em Prazo e Providência.
-- Prazo = etiqueta VIOS ENVIAR (a peça do prazo).
-- Fora da conta de prazo e da planilha: as tarefas do fluxo
-- "2. REVISAR", "3. PROTOCOLAR" e "4. VALIDAR PROTOCOLO".
-- Providência = etiqueta PROVIDÊNCIA.

CREATE OR REPLACE FUNCTION public.escritorio_tarefa_classe(p_etiqueta text, p_tarefa text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN upper(trim(coalesce(p_tarefa, ''))) IN (
        '2. REVISAR', 'REVISAR',
        '3. PROTOCOLAR', 'PROTOCOLAR',
        '4. VALIDAR PROTOCOLO', 'VALIDAR PROTOCOLO'
      )
      OR upper(trim(coalesce(p_tarefa, ''))) LIKE '%PROTOCOLAR%'
      OR upper(trim(coalesce(p_tarefa, ''))) LIKE '%VALIDAR PROTOCOLO%'
      OR upper(trim(coalesce(p_etiqueta, ''))) = 'VALIDAR PROTOCOLO'
    THEN NULL
    WHEN upper(trim(coalesce(p_etiqueta, ''))) LIKE '%PROVIDÊNCIA%'
      OR upper(trim(coalesce(p_etiqueta, ''))) LIKE '%PROVIDENCIA%'
    THEN 'Providência'
    WHEN upper(trim(coalesce(p_etiqueta, ''))) = 'ENVIAR'
    THEN 'Prazo'
    ELSE 'Outra'
  END;
$$;

COMMENT ON FUNCTION public.escritorio_tarefa_classe(text, text) IS
  'Prazo = etiqueta ENVIAR. Providência = etiqueta PROVIDÊNCIA. NULL = passo do fluxo (revisar, protocolar, validar protocolo), fora da conta.';

GRANT EXECUTE ON FUNCTION public.escritorio_tarefa_classe(text, text) TO authenticated;
