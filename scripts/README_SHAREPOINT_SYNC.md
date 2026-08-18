# Sync SharePoint → Supabase (painel Eficiência Operacional)

Sincroniza as fontes do BI "DASHBOARD - EFICIÊNCIA OPERACIONAL - GERAL" para as
tabelas `sp_*` do Supabase, que alimentam o painel **Eficiência** do SIOE.

```bash
npm run sync:sharepoint                  # todas as fontes
npm run sync:sharepoint -- --only publicacoes,tarefas
npm run sync:sharepoint -- --dump-fields publicacoes   # inspecionar nomes internos dos campos
```

## Fontes

| Fonte | Origem | Tabela | Estratégia |
|---|---|---|---|
| `feriados` | `Feriados.xlsx` (site Controladoria) | `sp_feriados` | replace (apaga o que saiu da planilha) |
| `turnover` | `Gestão/Indicadores Juridico/2025/Turnover BP (1).xlsx` (workbook **date1904**; sync corrige +1462 dias) | `sp_turnover` | replace (apaga o que saiu da planilha) |
| `gestao_pdi` | `…/Base de Gestão de PDI.xlsx` — abas **Elegíveis** + **Desvio…** / Análise Desvios | `sp_gestao_pdi_elegiveis`, `sp_gestao_pdi_desvios` | replace (apaga o que saiu da planilha) |
| `publicacoes` | Lista SharePoint `91e8ba11…` (CONTROLADORIAJURDICA) | `sp_publicacoes` | upsert + apaga órfão **só nos últimos 4 meses** (Graph não filtra essa lista; paginação só acumula a janela); histórico antigo no SIOE não é tocado |
| `agendamento` | Lista SharePoint de solicitações | `sp_agendamento` | upsert + apaga IDs que sumiram da lista |
| `protocolos` | Lista "CONTROLE DE PROTOCOLOS" `4e115aab…` | `sp_protocolos` | upsert + apaga IDs que sumiram da lista |
| `treinamentos` | Lista `30ea2880…` | `sp_treinamentos_presenca` | upsert + apaga IDs que sumiram da lista |
| `processos_numero` | `Processos Lista.csv` (coluna Número) | `sp_processos_numero` | upsert + apaga CIs que saíram do CSV; backfill `nro_cnj` vazio nas tarefas |
| `tarefas` | `Tarefas.csv` (Bases Atualizacoes) | `sp_tarefas` | **acumulativo** (CSV é recorte; só Status=Concluída); `nro_cnj` coalesce com Número do processo |
| `tarefas_historico` | `Historico/*.csv` combinados | `sp_tarefas_historico` | **acumulativo** (arquivos de arquivo; não apaga histórico); mesmo coalesce de `nro_cnj` |
| `decisoes` | `Decisoes Processuais.csv` | `sp_decisoes_processuais` | replace (dedupe por processo, decisão mais recente) |

A **ordem importa**: `feriados` e `turnover` rodam primeiro porque são insumo das
flags calculadas das demais fontes (dia útil do SLA de vistagem; área do usuário
na conclusão).

As regras de negócio (flags D+1 útil, FATAL/D-1, excludentes, De-Para de área,
meta por período) estão centralizadas em `scripts/sharepoint/transforms.mjs` —
replicadas 1:1 das colunas calculadas DAX do BI.

## Configuração (uma vez)

### 1. App registration no Azure AD

1. [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
   Nome sugerido: `SIOE SharePoint Sync`. Single tenant. Sem redirect URI.
2. Na app criada → **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Application permissions** → marcar `Sites.Read.All` e `Files.Read.All` → **Add**.
3. Clicar **Grant admin consent** (precisa de administrador do M365).
4. **Certificates & secrets** → **New client secret** → copiar o **Value** na hora
   (não aparece de novo).
5. Anotar da página **Overview**: *Directory (tenant) ID* e *Application (client) ID*.

### 2. Variáveis no `.env`

```
MS_TENANT_ID=<Directory (tenant) ID>
MS_CLIENT_ID=<Application (client) ID>
MS_CLIENT_SECRET=<Value do client secret>
```

Também são usados `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (já existentes).

### 3. Primeira execução

Os nomes **internos** das colunas de listas SharePoint podem diferir do nome de
exibição (espaços/acentos viram códigos, ex.: `_x0020_`). Se alguma coluna vier
nula na primeira execução:

```bash
npm run sync:sharepoint -- --dump-fields publicacoes
```

e ajustar os aliases em `FIELD_ALIASES`/`pick(...)` no `sync-sharepoint.mjs`.

### 4. Agendamento online (GitHub Actions)

O sync roda **na nuvem**, sem depender do Mac ligado:

| Horário (Brasília) | Gatilho |
|---|---|
| **08:00** | cron (`timezone: America/Sao_Paulo`) |
| **12:00** | cron (`timezone: America/Sao_Paulo`) |

Workflow: `.github/workflows/sync-sharepoint.yml`

O agendamento usa fuso IANA `America/Sao_Paulo` (não é necessário converter para UTC manualmente).
Disparo manual opcional com filtro `--only` (ex.: `tarefas,tarefas_historico`).

#### Secrets no GitHub (Settings → Secrets and variables → Actions)

| Secret | Valor |
|---|---|
| `MS_TENANT_ID` | Directory (tenant) ID do Azure AD |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | Client secret |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (nunca expor no frontend) |

Também é possível disparar manualmente: **Actions → Sync SharePoint (Eficiência) → Run workflow**.

Logs de cada execução ficam na aba Actions do repositório.

#### Cron local (opcional / legado)

Se preferir rodar na máquina local:

```cron
0 8 * * * /caminho/do/SIOE/scripts/sharepoint/run-sync-sharepoint.sh
0 12 * * * /caminho/do/SIOE/scripts/sharepoint/run-sync-sharepoint.sh
```

Log local: `logs/sync-sharepoint.log`.

## Pendências conhecidas

- **`sp_usuarios_area`** (planilha `Usuários x Área.xlsx` do BI) permanece no banco com
  carga inicial do `.pbix`, mas **não entra no sync** — nenhum KPI/RPC do SIOE lê essa tabela;
  área de tarefas/protocolos vem do **Turnover**, publicações do **De-Para de escritório**.
- A carga inicial das demais tabelas foi feita a partir dos dados embutidos no `.pbix`
  (agosto/2026). O primeiro sync real apenas atualiza/acrescenta a partir daí.
- O monitoramento fica em `sharepoint_sync_log` (o painel mostra "atualizado em"
  a partir da última entrada por fonte).
