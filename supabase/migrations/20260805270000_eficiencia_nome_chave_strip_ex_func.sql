-- Contas desligadas no SharePoint vêm como "Ex Func Nome Completo".
-- Remover o prefixo antes do match com turnover (espelha stripExFuncPrefix no sync).

CREATE OR REPLACE FUNCTION public.eficiencia_nome_chave(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE base
    WHEN 'MEMBROS DE CRISTIANA.COSTA@BISMARCHIPIRES.COM.BR'
      THEN 'CRISTIANE PEREIRA DA COSTA'
    ELSE base
  END
  FROM (
    SELECT NULLIF(
      regexp_replace(
        upper(
          trim(
            extensions.unaccent(
              coalesce(
                regexp_replace(trim(coalesce(p_nome, '')), '^ex\s+func\.?\s+', '', 'i'),
                ''
              )
            )
          )
        ),
        '\s+',
        ' ',
        'g'
      ),
      ''
    ) AS base
  ) s;
$$;

COMMENT ON FUNCTION public.eficiencia_nome_chave(text) IS
  'Chave de match pessoa: strip Ex Func + UPPER(unaccent(trim)) + aliases AD → nome turnover.';
