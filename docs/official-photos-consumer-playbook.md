# Playbook: consumir fotos oficiais do ORQESTRAI

Use este arquivo como padrão em **qualquer sistema** (Responsum, SIOE, novos projetos).
A fonte canônica das fotos oficiais é o ORQESTRAI. Os outros sistemas **só consultam**.

## O que já está pronto no ORQESTRAI

- Edge Function: `official-photos-api`
- Base URL:

```text
https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/official-photos-api
```

- Consumidores já criados: `responsum` e `sioe`
- Autenticação por chave individual (hash no banco; texto puro só no secret manager)
- Limite padrão: 300 req/min por consumidor
- Batch: até 100 IDs por chamada

## O que você precisa fazer agora

### 1) Guardar a chave do sistema

Cada sistema tem uma chave própria (`ofp_...`).

Coloque **somente no backend / secret manager**:

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `OFFICIAL_PHOTOS_API_KEY` | sim | `ofp_responsum_...` |
| `ORQESTRAI_PHOTOS_URL` | recomendada | `https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/official-photos-api` |

Regras:

- Nunca use `NEXT_PUBLIC_*` / `VITE_*` / variável de browser
- Nunca compartilhe a mesma chave entre sistemas
- Se a chave vazar: rotacione no Marketing System e atualize o secret

### 2) Escolher a estratégia de identidade

| Prioridade | Método | Quando usar |
|---|---|---|
| 1 | `GET /v1/photos/{externalUserId}` | Produção (recomendado) |
| 1 | `POST /v1/photos/batch` | Listas / telas com vários colaboradores |
| 2 | `GET /v1/photos?email=...` | Temporário, só até vincular IDs |

`externalUserId` = ID da pessoa **no seu sistema**.

O ORQESTRAI precisa ter o vínculo em `official_photo_system_links`:

```text
(consumer_id, external_user_id) → user_id do ORQESTRAI
```

Sem vínculo, a API responde `404` no lookup por ID.  
Fallback por e-mail pode responder `409` se o e-mail estiver duplicado.

### 3) Implementar um client server-side

Exemplo TypeScript (Next.js / Node / Edge):

```ts
const BASE =
  process.env.ORQESTRAI_PHOTOS_URL ??
  "https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/official-photos-api";

const API_KEY = process.env.OFFICIAL_PHOTOS_API_KEY;

if (!API_KEY) {
  throw new Error("OFFICIAL_PHOTOS_API_KEY não configurada.");
}

export type OfficialPhoto = {
  externalUserId: string | null;
  userId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  source: "selected" | "legacy_avatar" | "none";
  version: string;
  updatedAt: string;
};

export async function getOfficialPhoto(externalUserId: string): Promise<OfficialPhoto | null> {
  const response = await fetch(
    `${BASE}/v1/photos/${encodeURIComponent(externalUserId)}`,
    {
      headers: { "x-api-key": API_KEY },
      cache: "no-store",
    }
  );

  if (response.status === 404) return null;
  if (response.status === 429) throw new Error("Rate limit da API de fotos.");
  if (!response.ok) throw new Error(`Fotos oficiais: HTTP ${response.status}`);

  const payload = (await response.json()) as { data: OfficialPhoto };
  return payload.data;
}

export async function getOfficialPhotosBatch(externalUserIds: string[]) {
  const response = await fetch(`${BASE}/v1/photos/batch`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ externalUserIds }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Fotos oficiais batch: HTTP ${response.status}`);

  return (await response.json()) as {
    data: OfficialPhoto[];
    notFound: string[];
  };
}
```

### 4) Usar a URL no seu app

- Prefira `photoUrl` retornada pela API
- Se `source === "none"` ou `photoUrl === null`, use placeholder local
- Não grave a foto no seu Storage como fonte da verdade
- Cache curto é ok (ex.: 5–15 min) usando `version` ou `updatedAt` para invalidar

Exemplo de uso em UI:

```tsx
<img
  src={photo?.photoUrl ?? "/avatar-placeholder.svg"}
  alt={photo?.name ?? "Colaborador"}
/>
```

## Checklist por tipo de sistema

### Sistemas já existentes (Responsum / SIOE)

1. [ ] Colocar `OFFICIAL_PHOTOS_API_KEY` no secret manager / env de produção
2. [ ] Criar helper server-side (sem expor chave no front)
3. [ ] Trocar avatares hardcode/locais pela API
4. [ ] Começar com fallback por e-mail **somente** se ainda não houver vínculos
5. [ ] Pedir/cadastrar vínculos `(external_user_id → user_id ORQESTRAI)`
6. [ ] Migrar para lookup por ID + batch
7. [ ] Smoke test: health, 401 sem chave, 404 ID inexistente, batch de 2–3 IDs

### Sistemas novos (padrão obrigatório)

1. [ ] Solicitar cadastro do consumidor no ORQESTRAI (`slug` estável, ex.: `crm-bp`)
2. [ ] Receber chave uma única vez e guardar no secret manager
3. [ ] Copiar este playbook para `docs/official-photos-consumer.md` do projeto
4. [ ] Implementar client server-side no bootstrap do projeto
5. [ ] Definir desde o dia 1 o `externalUserId` (UUID interno do sistema)
6. [ ] Enviar mapa inicial de vínculos ao time do Marketing/ORQESTRAI
7. [ ] Nunca criar pipeline paralelo de “foto oficial” no próprio banco

## Contrato rápido da API

### Health

```http
GET /health
```

```json
{ "ok": true, "service": "official-photos-api", "version": "v1" }
```

### Unitário

```http
GET /v1/photos/{externalUserId}
x-api-key: {OFFICIAL_PHOTOS_API_KEY}
```

### Batch

```http
POST /v1/photos/batch
Content-Type: application/json
x-api-key: {OFFICIAL_PHOTOS_API_KEY}

{ "externalUserIds": ["id-1", "id-2"] }
```

### Códigos

| Status | Significado | Ação no consumidor |
|---|---|---|
| 200 | ok | usar `data` |
| 400 | payload inválido | corrigir request |
| 401 | chave inválida/ausente | checar secret |
| 404 | pessoa não vinculada/não encontrada | fallback local / cadastrar vínculo |
| 409 | e-mail ambíguo | parar fallback; usar ID |
| 429 | quota | retry com backoff |
| 500 | erro interno | retry / alertar |

## Como pedir cadastro / vínculo

Envie para o time do ORQESTRAI:

```text
Sistema: <nome>
Slug sugerido: <slug-kebab-case>
Responsável técnico: <email>
IDs para vincular:
- external_user_id=<uuid-no-seu-sistema>, email=<opcional>, name=<opcional>
```

Se o sistema já tiver usuários espelhados no ORQESTRAI com o mesmo UUID, o vínculo pode ser:

```text
external_user_id = id do seu sistema
user_id = mesmo id no ORQESTRAI
```

## Anti-padrões (não fazer)

- Chamar a API do browser
- Replicar `service_role` do ORQESTRAI no seu projeto
- Usar e-mail como chave permanente
- Cache eterno sem invalidação
- Upload/overwrite da foto oficial no seu Storage como fonte da verdade
- Compartilhar chave entre ambientes/produtos

## Smoke test mínimo (cole no README do sistema)

```bash
# 1) health
curl -s "$ORQESTRAI_PHOTOS_URL/health"

# 2) sem chave => 401
curl -s -o /dev/null -w "%{http_code}\n" "$ORQESTRAI_PHOTOS_URL/v1/photos/teste"

# 3) com chave (unitário)
curl -s -H "x-api-key: $OFFICIAL_PHOTOS_API_KEY" \
  "$ORQESTRAI_PHOTOS_URL/v1/photos/<EXTERNAL_USER_ID>"

# 4) batch
curl -s -X POST -H "x-api-key: $OFFICIAL_PHOTOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"externalUserIds":["id-1","id-2"]}' \
  "$ORQESTRAI_PHOTOS_URL/v1/photos/batch"
```

## Referência operacional no Marketing System

- Contrato detalhado: `docs/official-photos-api.md`
- Rotação de chave (admin autenticado):

```http
POST /api/admin/official-photo-consumers/{slug}/rotate-key
```

Após rotacionar, atualize imediatamente o secret do sistema consumidor.
