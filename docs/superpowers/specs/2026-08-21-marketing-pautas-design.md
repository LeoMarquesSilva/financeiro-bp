# Pautas de Marketing no SIOE — Design

## Objetivo

Adicionar ao módulo Operações Legais → Marketing uma quarta meta de 10 pautas entregues por mês pelo escritório e uma visão operacional capaz de mostrar volume entregue, responsáveis, atrasos e o ponto atual do fluxo.

## Fonte de verdade

- A pauta é a tarefa `MATERIAL MARKETING - REELS/POST/ARTIGO` em `sp_tarefas_historico`.
- A entrega do advogado ocorre quando a tarefa principal é concluída.
- As etapas posteriores são `2. REVISAR` e `3. PROTOCOLAR`.
- Tarefas canceladas não contam na meta.
- A pessoa que concluiu a tarefa principal é a autora da entrega.
- Para pautas ainda abertas, o sync do SharePoint deve preservar o campo original de responsável da agenda. Enquanto a fonte não fornecer esse campo, a interface deve exibir “Responsável não sincronizado”, sem inferir nomes.
- Fotos, nomes canônicos e áreas vêm de `colaboradores`, sincronizada com o ORQESTRAI.

## Regras do funil

Cada pauta usa o CI da tarefa principal como identificador. As duas tarefas imediatamente seguintes, quando pertencem ao mesmo processo e apontam para a tarefa principal, representam revisão e protocolo.

Ordem de estágio:

1. `Aguardando envio`: tarefa principal aberta.
2. `Em revisão`: tarefa principal concluída e revisão ainda aberta.
3. `Em protocolo`: revisão concluída e protocolo ainda aberto.
4. `Finalizada`: protocolo concluído, ou todas as etapas existentes concluídas.
5. `Cancelada`: tarefa principal cancelada; excluída da meta e dos atrasos.

Uma pauta fica atrasada quando a etapa atual está aberta e o prazo dessa etapa é anterior à data de referência.

## Métrica

- Meta-base: 10 pautas por mês para o escritório inteiro.
- Valor realizado: tarefas principais concluídas cuja `data_conclusao` esteja dentro do período selecionado.
- Períodos diferentes de um mês usam meta proporcional à duração, mantendo a legenda `10/mês`.
- Comparação: mesmo intervalo imediatamente anterior, seguindo o calendário já usado pelo painel.

## Interface

### Indicadores

O bloco principal passa a ter quatro cartões: Alcance, Engajamento, Postagens e Pautas. O cartão de Pautas mostra entregues, meta proporcional, progresso e variação contra o período anterior.

### Aba Pautas

A nova aba apresenta:

- resumo do funil por estágio;
- atrasadas, vencendo em sete dias e tarefas sem responsável sincronizado;
- ranking de entregas por advogado no período;
- lista detalhada com foto, responsável, área, etapa atual, prazo e situação;
- filtros por etapa, área e busca por nome;
- canceladas separadas da operação ativa.

O seletor global de período controla também essa aba.

## Estados e falhas

- Falha dos dados de pautas não deve derrubar os dados do Instagram; a aba apresenta erro próprio e permite tentar novamente.
- Sem pautas no período, mostrar estado vazio claro.
- Sem responsável, nunca deduzir a pessoa por área, timesheet ou conclusão de outra pauta.
- Datas são tratadas como datas civis do Brasil, sem deslocamento de fuso.

## Validação

- Testes unitários cobrem agrupamento, estágio, atraso, cancelamento, meta e comparação.
- O sync testa a resolução do campo de responsável com aliases conhecidos.
- Build TypeScript/Vite deve passar.
- A página deve ser verificada no localhost em largura desktop e mobile.
