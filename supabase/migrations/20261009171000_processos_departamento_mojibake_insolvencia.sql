-- "InsolvÃªncia" é "Insolvência" com UTF-8 lido como latin1.
-- Corrige o estoque atual e impede o próximo sync do VIOS de separar de novo.

CREATE OR REPLACE FUNCTION public.vios_corrigir_mojibake(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  fixed text;
  i integer;
  seguir boolean := false;
BEGIN
  IF p IS NULL OR position('Ã' IN p) = 0 THEN
    RETURN p;
  END IF;

  FOR i IN 1..(char_length(p) - 1) LOOP
    IF substr(p, i, 1) = 'Ã' AND ascii(substr(p, i + 1, 1)) BETWEEN 128 AND 191 THEN
      seguir := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT seguir THEN
    RETURN p;
  END IF;

  BEGIN
    fixed := convert_from(convert_to(p, 'LATIN1'), 'UTF8');
  EXCEPTION
    WHEN OTHERS THEN
      RETURN p;
  END;

  IF fixed IS NULL OR fixed = '' OR position(chr(65533) IN fixed) > 0 THEN
    RETURN p;
  END IF;

  RETURN fixed;
END;
$$;

COMMENT ON FUNCTION public.vios_corrigir_mojibake(text) IS
  'Desfaz mojibake de texto VIOS (UTF-8 lido como latin1). Nome já acentuado, como GUIMARÃES, permanece.';

CREATE OR REPLACE FUNCTION public.processos_completo_corrigir_mojibake()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.grupo_cliente := public.vios_corrigir_mojibake(NEW.grupo_cliente);
  NEW.departamento := public.vios_corrigir_mojibake(NEW.departamento);
  NEW.area := public.vios_corrigir_mojibake(NEW.area);
  NEW.advogado_responsavel := public.vios_corrigir_mojibake(NEW.advogado_responsavel);
  NEW.cliente := public.vios_corrigir_mojibake(NEW.cliente);
  NEW.acao := public.vios_corrigir_mojibake(NEW.acao);
  NEW.acao_data_cadastro := public.vios_corrigir_mojibake(NEW.acao_data_cadastro);
  NEW.fase_processual := public.vios_corrigir_mojibake(NEW.fase_processual);
  NEW.processo_encerrado := public.vios_corrigir_mojibake(NEW.processo_encerrado);
  NEW.situacao_processo := public.vios_corrigir_mojibake(NEW.situacao_processo);
  NEW.motivo_encerramento := public.vios_corrigir_mojibake(NEW.motivo_encerramento);
  NEW.etiquetas := public.vios_corrigir_mojibake(NEW.etiquetas);
  NEW.vinculo := public.vios_corrigir_mojibake(NEW.vinculo);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS processos_completo_corrigir_mojibake ON public.processos_completo;

CREATE TRIGGER processos_completo_corrigir_mojibake
  BEFORE INSERT OR UPDATE ON public.processos_completo
  FOR EACH ROW
  EXECUTE FUNCTION public.processos_completo_corrigir_mojibake();

UPDATE public.processos_completo
SET
  departamento = public.vios_corrigir_mojibake(departamento),
  acao = public.vios_corrigir_mojibake(acao)
WHERE ci IN ('50851', '47904');
