# Taxa de recuperação do comitê de inadimplência

## Regra

No dia **05/02/2026** foi iniciado o comitê de inadimplência. A taxa de recuperação é calculada a partir dessa data.

- **Numerador:** soma dos valores pagos a partir de 05/02/2026: `inadimplencia_pagamentos` (data_pagamento >= 05/02) + `financeiro_parcelas` (data_baixa >= 05/02, vinculadas por pessoa_id).
- **Denominador:** valor total em aberto no início do comitê (estoque em 05/02).
- **Fórmula:** Taxa de recuperação = (Total pago desde 05/02) / (Valor total em aberto no início) × 100.

**Pagamentos a partir de 05/02 entram na porcentagem de recuperação.**

## Valor total em aberto no início (denominador)

O sistema não guarda snapshot histórico do valor em aberto em 05/02. O valor total em aberto no início é **reconstruído** por cliente:

- Por cliente do comitê: `valor_em_aberto (atual) + soma dos pagamentos desse cliente desde 05/02`.
- Valor total em aberto no início = soma desses valores para todos os clientes do comitê.

Interpretação: “o que estava em aberto no início” = “o que ainda está em aberto” + “o que foi pago desde o início”.

## Colunas / tabelas utilizadas

- **clients_inadimplencia:** `id`, `valor_em_aberto`, `pessoa_id`
- **inadimplencia_pagamentos:** `client_id`, `data_pagamento`, `valor_pago`
- **financeiro_parcelas:** `pessoa_id`, `data_baixa`, `valor`, `valor_pago` (parcelas pagas com data_baixa >= 05/02)

## Constante no código

`DATA_INICIO_COMITE = '2026-02-05'` em `src/shared/constants/inadimplencia.ts`.
