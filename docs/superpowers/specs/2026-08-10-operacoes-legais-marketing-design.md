# Operações Legais — Marketing

## Objetivo

Adicionar ao dashboard de Operações Legais uma aba Marketing equivalente ao Instagram Insights do ORQESTRAI, preservando o histórico existente e passando a atualizar os dados diretamente pela Meta.

## Escopo funcional

- Aba principal `Marketing` dentro de Operações Legais.
- Subabas: Visão geral, Conta & audiência, Por área e Postagens.
- KPIs, comparativos, tendências, distribuição por formato, ranking por área, demografia, filtros e listagem de posts.
- Sincronização manual para administradores e usuários ativos da área Marketing.
- Sincronização automática a cada seis horas para preservar stories e ampliar o histórico diário.
- Migração única e idempotente do histórico do ORQESTRAI.
- Edição dos vínculos de áreas e solicitantes dos posts por administradores e Marketing.

## Arquitetura

O frontend React/Vite lê tabelas próprias no Supabase do `financeiro-bp`. Uma Edge Function autenticada guarda o token da Meta no servidor, consulta a Graph API e faz upsert dos dados. A interface nunca recebe o token. A mesma função aceita invocação manual autenticada e invocação agendada com segredo interno.

O histórico é importado por um script local que lê o Supabase do ORQESTRAI e grava no Supabase do `financeiro-bp`. Identificadores de mídia são preservados; solicitantes são associados por e-mail e, como fallback, por nome normalizado.

## Dados

- `instagram_posts`: conteúdo, mídia, métricas e vínculos.
- `instagram_account_stats`: snapshots de seguidores e volume.
- `instagram_stories`: stories e métricas históricas.
- `instagram_account_insights`: série diária da conta.
- `instagram_demographics`: snapshot demográfico.
- `instagram_settings`: meta mensal de publicações.

Todas as tabelas usam RLS. Usuários autenticados com acesso ao módulo podem ler. Atualizações de vínculos passam por RPC autorizada; sincronização e escrita técnica usam a Edge Function/service role.

## Interface

A aba Marketing possui seletor próprio de período; os filtros globais de ano/mês de Operações Legais ficam ocultos enquanto ela estiver ativa.

- Visão geral: seguidores, alcance, visualizações, interações, engajamento, volume/meta, tendências, formatos e melhores posts.
- Conta & audiência: histórico diário, crescimento e demografia por gênero, idade, país e cidade.
- Por área: ranking, volume, alcance, engajamento e detalhamento por área.
- Postagens: filtros, ordenação, paginação, métricas por publicação e edição de áreas/solicitantes.

O visual segue os componentes, cores e densidade do `financeiro-bp`, mantendo a organização e os cálculos do ORQESTRAI.

## Falhas e estados

- Sem dados: estado vazio com ação de sincronização para usuários autorizados.
- Falha da Meta: mensagem legível sem apagar dados já persistidos.
- Token/configuração ausente: erro técnico apenas na função; a UI informa que a sincronização não está configurada.
- Migração/sync repetidos: upsert idempotente, sem duplicação.
- Vínculo inválido: RPC rejeita áreas ou solicitantes inexistentes/inativos quando aplicável.

## Testes e aceite

- Testes unitários dos cálculos, períodos, permissões e normalização da API.
- Testes de integração dos contratos da Edge Function e das políticas/RPCs.
- Build, lint e teste do fluxo visual em desktop e viewport móvel.
- Nenhum segredo `TOKEN_META_BP` ou service role aparece no bundle do navegador.
