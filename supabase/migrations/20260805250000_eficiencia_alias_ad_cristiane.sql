-- Alias AD incompleto: "Membros de cristiana.costa@..." → CRISTIANE PEREIRA DA COSTA
-- Conta sem display name completo no AD; linkar ao nome canônico do turnover.

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
        upper(trim(extensions.unaccent(coalesce(p_nome, '')))),
        '\s+',
        ' ',
        'g'
      ),
      ''
    ) AS base
  ) s;
$$;

COMMENT ON FUNCTION public.eficiencia_nome_chave(text) IS
  'Chave de match pessoa: UPPER(unaccent(trim)) + aliases AD incompleto → nome turnover.';

-- Materializa o nome canônico nas linhas já sincronizadas (ranking / racional).
UPDATE public.sp_treinamentos_presenca
SET
  colaborador = 'CRISTIANE PEREIRA DA COSTA',
  updated_at = now()
WHERE public.eficiencia_nome_chave(colaborador) = 'CRISTIANE PEREIRA DA COSTA'
  AND colaborador IS DISTINCT FROM 'CRISTIANE PEREIRA DA COSTA';
