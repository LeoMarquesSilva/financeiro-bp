-- Vínculos confirmados pelo responsável de Marketing em 2026-08-21.
-- A tarefa principal representa quem deve entregar a pauta; 2. REVISAR,
-- quem deve fazer a revisão. O sync preserva estes valores quando a
-- exportação histórica não informa responsável.
WITH assignments (ci, responsavel) AS (
  VALUES
    (797695::bigint, 'Maria Heloiza Gois Ponce'::text),
    (797696::bigint, 'Samuel Willian Silva'::text),
    (798063::bigint, 'Vinícius Canto Hecksher'::text),
    (798064::bigint, 'Leonardo Loureiro Basso'::text),
    (798242::bigint, 'Giancarlo Murta Zotini'::text),
    (798244::bigint, 'Giancarlo Murta Zotini'::text),
    (799272::bigint, 'Caio Augusto de Alcântara César Silva'::text),
    (799274::bigint, 'Henrique Franco Nascimento'::text)
)
UPDATE public.sp_tarefas_historico AS tarefa
SET responsavel = assignments.responsavel,
    updated_at = now()
FROM assignments
WHERE tarefa.ci = assignments.ci;

WITH assignments (ci, responsavel) AS (
  VALUES
    (797695::bigint, 'Maria Heloiza Gois Ponce'::text),
    (797696::bigint, 'Samuel Willian Silva'::text),
    (798063::bigint, 'Vinícius Canto Hecksher'::text),
    (798064::bigint, 'Leonardo Loureiro Basso'::text),
    (798242::bigint, 'Giancarlo Murta Zotini'::text),
    (798244::bigint, 'Giancarlo Murta Zotini'::text),
    (799272::bigint, 'Caio Augusto de Alcântara César Silva'::text),
    (799274::bigint, 'Henrique Franco Nascimento'::text)
)
UPDATE public.sp_tarefas AS tarefa
SET responsavel = assignments.responsavel,
    updated_at = now()
FROM assignments
WHERE tarefa.ci = assignments.ci;
