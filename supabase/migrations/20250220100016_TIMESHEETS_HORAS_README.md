# Horas no TimeSheets: fórmula correta

## Unidade correta no banco

- **`timesheets.total_horas_decimal`** deve ser sempre em **horas decimais**.
- Exemplos: `10.35` = 10h21min, `4.29` = 4h17min24s.

## Conversões

| Origem        | Fórmula        | Exemplo                    |
|---------------|----------------|----------------------------|
| HH:MM:SS      | H + M/60 + S/3600 | 10:21:00 → 10.35         |
| Segundos      | segundos / 3600  | 37260 → 10.35             |
| Fração de dia (Excel) | valor × 24 | 0.43125 → 10.35        |

## View `timesheets_resumo_por_grupo_ano`

- Faz `SUM(total_horas_decimal)` por grupo e ano.
- Se a soma for inteira e grande (ex.: 8589312), trata como **segundos** e converte: `soma / 3600`.
- Assim o resultado fica em horas decimais para o front exibir em HH:MM:SS.

## Se o total ainda sair errado (ex.: 2385h em vez de 4h17)

Isso costuma indicar:

1. **Linhas duplicadas**  
   O mesmo apontamento foi importado várias vezes (ex.: 556 vezes).  
   Solução: deduplicar por `(data, cliente, colaborador, hora_inicial, descricao)` e manter uma linha por apontamento (ou somar e guardar numa única linha).

2. **Unidade errada na origem**  
   O Excel/export está mandando o valor em outra unidade (ex.: centésimos de minuto).  
   Solução: conferir o formato da célula e o que o sync está lendo; ajustar o parse no sync.

## Corrigir tabela (valores em segundos)

Para converter **cada linha** que ainda estiver em segundos para horas decimais:

```sql
UPDATE timesheets
SET total_horas_decimal = ROUND((total_horas_decimal / 3600)::numeric, 2),
    total_horas = ROUND((total_horas_decimal / 3600)::numeric, 2)
WHERE total_horas_decimal >= 60
  AND (total_horas_decimal > 86400 OR (total_horas_decimal = FLOOR(total_horas_decimal) AND total_horas_decimal <= 86400));
```

Depois rode de novo o sync de TimeSheets (o sync já converte segundos para horas ao importar).
