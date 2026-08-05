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
| `feriados` | `Feriados.xlsx` (site Controladoria) | `sp_feriados` | replace |
| `turnover` | `Gestão/Indicadores Juridico/2025/Turnover BP (1).xlsx` | `sp_turnover` | replace |
| `usuarios_area` | `Usuários x Área.xlsx` | `sp_usuarios_area` | replace |
| `publicacoes` | Lista SharePoint `91e8ba11…` (CONTROLADORIAJURDICA) | `sp_publicacoes` | **acumulativo** (lista rotativa ~7 dias na origem; o histórico vive aqui) |
| `protocolos` | Lista "CONTROLE DE PROTOCOLOS" `4e115aab…` | `sp_protocolos` | acumulativo |
| `treinamentos` | Lista `30ea2880…` | `sp_treinamentos_presenca` | acumulativo |
| `tarefas` | `Tarefas.csv` (Bases Atualizacoes) | `sp_tarefas` | acumulativo (só Status=Concluída) |
| `tarefas_historico` | `Historico/*.csv` combinados | `sp_tarefas_historico` | acumulativo |
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

### 4. Agendamento diário

No mesmo servidor que roda os syncs VIOS (Task Scheduler, ~06:00 — ver
`README_VIOS_SYNC.md`), adicionar uma tarefa diária:

```
cmd /c "cd /d C:\caminho\do\SIOE && npm run sync:sharepoint >> logs\sync-sharepoint.log 2>&1"
```

## Pendências conhecidas

- **`Usuários x Área.xlsx`** está no OneDrive **pessoal** (samuel_bpplaw_com_br);
  o app registration não alcança OneDrive pessoal com `Sites.Read.All`. Mover o
  arquivo para `Bases Atualizacoes` no site Controladoria (caminho já esperado
  pelo sync) ou concedar `Files.Read.All` + ajustar a rota do drive.
- A carga inicial das tabelas foi feita a partir dos dados embutidos no `.pbix`
  (agosto/2026). O primeiro sync real apenas atualiza/acrescenta a partir daí.
- O monitoramento fica em `sharepoint_sync_log` (o painel mostra "atualizado em"
  a partir da última entrada por fonte).
