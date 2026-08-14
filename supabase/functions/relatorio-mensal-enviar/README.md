# relatorio-mensal-enviar

Edge Function que envia **gestão à vista** diária SIOE (mês corrente, dia 1 até hoje) por e-mail via **Microsoft Graph**.

## Secrets (mesmos da cobrança + cron)

| Variável | Descrição |
|----------|-----------|
| `MS_TENANT_ID` | Azure AD tenant |
| `MS_CLIENT_ID` | App registration |
| `MS_CLIENT_SECRET` | Client secret |
| `MS_SENDER` | E-mail remetente (usuário Graph) |
| `RELATORIO_MENSAL_CRON_SECRET` | Header `x-cron-secret` para pg_cron |
| `SIOE_PUBLIC_URL` | Link no corpo do e-mail (opcional) |

## Vault (cron)

```sql
select vault.create_secret('https://<project>.supabase.co/functions/v1/relatorio-mensal-enviar', 'relatorio_mensal_enviar_url');
select vault.create_secret('<segredo-forte>', 'relatorio_mensal_cron_secret');
```

## Invocação

- **Cron:** `POST` body `{ "modo": "cron" }` + header `x-cron-secret`
- **Manual (admin):** JWT + `{ "modo": "manual", "ano"?, "mes"? }`
- **Teste (admin):** JWT + `{ "modo": "teste", "email_teste"?: "..." }`

## Fase 2 (não implementada)

Anexos PNG (gráfico comparativo, cards Overview) e Excel Indicadores Resultado — ver plano em `.cursor/plans/`.
