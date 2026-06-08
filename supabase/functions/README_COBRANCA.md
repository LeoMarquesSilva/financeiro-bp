# Módulo de Cobrança – Setup (Edge Functions)

Backend do módulo de Cobrança roda em Supabase Edge Functions. As chaves ficam em **secrets** do projeto (nunca no frontend).

## Edge Functions

| Função | verify_jwt | Descrição |
| --- | --- | --- |
| `cobranca-enviar-whatsapp` | true | Envia cobrança por WhatsApp (Evolution `sendText`) e registra em `cobranca_eventos`. |
| `cobranca-enviar-email` | true | Envia cobrança por e-mail (Microsoft Graph `sendMail`) e registra em `cobranca_eventos`. |
| `whatsapp-send` | true | Envia mensagem avulsa (texto, áudio, mídia, reação) pela caixa de WhatsApp. |
| `whatsapp-media` | true | Baixa mídia de mensagem via Evolution `getBase64FromMediaMessage`. |
| `whatsapp-read` | true | Marca mensagens como lidas no WhatsApp (`markMessageAsRead`). |
| `whatsapp-sync` | true | Backfill de conversas/mensagens via `findChats`/`findMessages`. |
| `whatsapp-webhook` | false | Recebe eventos da Evolution e grava em `whatsapp_chats`/`whatsapp_mensagens`. Protegido por `?secret=`. |
| `push-subscribe` | true | Registra/remove inscrição Web Push do usuário (admin/financeiro). |

## Notificações push (WhatsApp)

Quando uma mensagem chega via webhook, usuários com push ativado recebem notificação do sistema operacional — **mesmo com o navegador fechado**.

### 1. Gerar chaves VAPID

```bash
npx web-push generate-vapid-keys
```

### 2. Configurar secrets (Supabase)

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="<chave-publica>" \
  VAPID_PRIVATE_KEY="<chave-privada>" \
  VAPID_SUBJECT="mailto:financeiro@bpplaw.com.br"
```

### 3. Frontend (.env / Vercel)

```
VITE_VAPID_PUBLIC_KEY=<mesma-chave-publica>
```

### 4. Deploy

- Aplicar migration `20260608200000_push_subscriptions.sql`
- Deploy das functions `push-subscribe` e `whatsapp-webhook` (atualizada)

### 5. Ativar no sistema

No módulo **Cobrança > WhatsApp**, clique em **Ativar push** e aceite a permissão do navegador.

> Com a aba aberta, o sistema continua usando toast + som em tempo real. Push complementa quando o app está em segundo plano ou fechado.

## Secrets necessários

Defina no projeto (Dashboard > Edge Functions > Secrets, ou via CLI):

```bash
supabase secrets set \
  EVOLUTION_API_URL="https://dados-evolution-api.a8fvaf.easypanel.host" \
  EVOLUTION_API_KEY="<sua-api-key>" \
  EVOLUTION_INSTANCE="FINANCEIRO - BP" \
  MS_TENANT_ID="<tenant-id>" \
  MS_CLIENT_ID="<application-id>" \
  MS_CLIENT_SECRET="<client-secret>" \
  MS_SENDER="financeiro@bpplaw.com.br" \
  WHATSAPP_WEBHOOK_SECRET="<string-aleatoria-forte>"
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente nas Edge Functions.

## Microsoft Graph (Outlook) – App Registration

1. Portal Entra (Azure AD) > App registrations > New registration.
2. Em **API permissions** > Add a permission > Microsoft Graph > **Application permissions** > `Mail.Send`.
3. Clique em **Grant admin consent**.
4. Em **Certificates & secrets** > New client secret (copie o valor → `MS_CLIENT_SECRET`).
5. Copie **Directory (tenant) ID** → `MS_TENANT_ID` e **Application (client) ID** → `MS_CLIENT_ID`.
6. `MS_SENDER` = a caixa remetente (ex.: `financeiro@bpplaw.com.br`). Recomendado restringir o app a essa caixa via *Application Access Policy* (Exchange Online PowerShell).

## Evolution API – Webhook

Aponte o webhook da instância para a função `whatsapp-webhook`, incluindo o secret:

```
URL: https://wvbptgcevwvubtnetojz.functions.supabase.co/whatsapp-webhook?secret=<WHATSAPP_WEBHOOK_SECRET>
Eventos: MESSAGES_UPSERT, MESSAGES_UPDATE, CHATS_UPSERT, CHATS_UPDATE, SEND_MESSAGE
```

Exemplo de configuração via API:

```bash
curl -X POST "$EVOLUTION_API_URL/webhook/set/FINANCEIRO%20-%20BP" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://wvbptgcevwvubtnetojz.functions.supabase.co/whatsapp-webhook?secret=<WHATSAPP_WEBHOOK_SECRET>",
      "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CHATS_UPSERT", "CHATS_UPDATE", "SEND_MESSAGE"]
    }
  }'
```

## Modelos de mensagem

Os textos de WhatsApp/e-mail ficam em `app_settings` (chaves `cobranca_template_*`) e são editáveis em **Configurações > Modelos de cobrança**. Placeholders: `{{nome}}`, `{{titulo}}`, `{{descricao}}`, `{{valor}}`, `{{vencimento}}`, `{{dias_atraso}}`.
