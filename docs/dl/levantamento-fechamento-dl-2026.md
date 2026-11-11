# Levantamento: planilhas de fechamento do DL 2026

Conferência dos arquivos oficiais (`Resultado DL 2026_V2`, `Base CP 2026_V2`, `Detalhes CP_2026`,
`NOVA BASE CR 2026_V2`, `BASE CR_JUN_DEZ_2026`) contra os dados do SIOE (VIOS), jan–ago/2026.

> Versão sem valores: remuneração de sócios e gestores não fica no repositório. Os números da
> conferência estão no próprio módulo DL (acesso só de admin).

## Resultado da conferência

O SIOE reproduz o DL de **jun–ago quase ao centavo** (despesa por área e Controladoria de junho batem
exatamente). Jan–mai diverge porque a planilha usava outro processo nesses meses (receita de outros
arquivos e despesas da aba PAG classificadas à mão).

- **Impostos maiores no SIOE:** o número da NFS-e de vários títulos foi lançado no VIOS depois da
  exportação usada na planilha. Com a base exportada, o imposto de junho bate exatamente.
- **Receita jul/ago:** Contratos e Insolvência (jul) e Cível (ago) têm lançamentos alterados no VIOS
  depois da exportação.

## Erros e inconsistências nas planilhas

### Resultado DL 2026_V2
1. **Rateios, set–dez:** o total de profissionais (`L11:O11 = SUM(L4:L9)`) e o de agendamentos
   (`L22:O22 = SUM(L15:L20)`) deixam a linha de **Rec. Crédito fora**. Jan–ago estão certos. Quando
   setembro for preenchido, as despesas indiretas e a Controladoria vão sair erradas para todas as áreas.
2. **Valores digitados no lugar de fórmula:** DL Gestor Cível jan–mar e Liberação de Recursos ADD jan–mar.
   Liberação de Recursos de jun em diante está fixa em 0 em todas as áreas.
3. **DL Gestor negativo:** jan–mai a fórmula zera valores negativos (`IF(...<0,0,...)`); a partir de
   junho não zera, e o Trabalhista entra negativo em jul/ago, reduzindo o DL Gestor total.
4. **Regra de negativo diferente por área:** ADD e Trabalhista checam o resultado **anual** (`$P$20`);
   as demais checam só o mês.
5. **DL do Renato fora do total:** `DL MENSAL!D21` soma `'DL REC CREDITO'!D22` (Giancarlo) e não a
   linha 23 (Renato). Em ago as duas linhas têm o mesmo valor, o que sugere fórmula duplicada.
6. **Fontes misturadas:** jan–mai a receita vem de `BASE CR 2026_V2_Abr_Mai_Com-Imposto.xlsx` e
   `BASE CR 2026_V2.xlsx` (arquivos locais em `D:\`, fora do SharePoint); jun–ago vêm da NOVA BASE CR.
   Quem abrir a planilha em outra máquina não atualiza esses vínculos.
7. **Diferença de arredondamento** entre o geral e a soma das áreas na Controladoria de jul (os % de
   agendamentos de jul não fecham exatamente 100).

### Base CP 2026_V2
8. **DESP_INDIRETO está todo digitado à mão** (57 linhas de valores colados, sem fórmula). O total bate
   com o VIOS, mas não se atualiza se um lançamento mudar.
9. **Equipamento de informática descontado duas vezes** nas exclusões do Indireto (linhas 66 e 68):
   o indireto sai menor todo mês de abr a ago.
10. **Parcela fixa dos sócios** é um valor fixo digitado em `DESP_GERAL!C172`, igual em todos os meses;
    em jan o pró-labore lançado no VIOS foi menor que esse valor.
11. **De maio em diante as abas DESP_* têm valores digitados**, somados à mão a partir das tabelas
    dinâmicas do Detalhes CP. A aba PAG só tem jan–abr.
12. **DL pago aos gestores entra como despesa da área** no mês em que é pago (Distribuição de Lucros
    lançada no departamento, inclusive "dividendos parcelas fixas" do Trabalhista). O DL de um mês reduz
    o resultado — e o DL — do mês seguinte.

### NOVA BASE CR 2026_V2
13. O % de DL por cliente vem de `Rateios_V2.xlsx`, que não está entre os arquivos oficiais. Os valores
    resultantes, porém, ficam gravados na coluna de % de cada aba de área (Cível, Insolvência, Contratos,
    ADD, Rec. Crédito, Trabalhista): foi de lá que o SIOE tirou a carteira de cada gestor. Os 131 nomes
    batem exatamente com o cliente do VIOS.

## Como o módulo DL do SIOE calcula

Regras revistas com o consultor financeiro em 11/11/2026.

- **Receita bruta:** honorários recebidos, pelo departamento do item no VIOS. A **Liberação de Recursos**
  (recebimentos em nome do Banco do Brasil) aparece numa linha à parte, dentro da receita bruta.
- **Impostos:** alíquota do mês × recebido com NFS-e (o VIOS grava `N/A` sem NF). A alíquota varia com o
  faturamento (Simples Nacional; vai mudar com a migração para o Lucro Presumido) e é informada todo mês em
  Parâmetros. Mês sem alíquota usa a do último mês cadastrado e fica marcado. Jan–ago/2026: 16,0587%, como
  na planilha.
- **Desp. operacionais:** OPEX do departamento (mesma regra do painel OPEX), sem impostos sobre
  faturamento. **Distribuição de lucros — inclusive o DL pago aos gestores e a antiga parcela fixa do
  Trabalhista —, repasses, investimentos, empréstimos e deduções ficam fora** (decisão de 26/10/2026; a
  parcela fixa era DL e acabou em ago/2026).
- **Desp. Controladoria:** OPEX de Operações Legais × **% de horas da Ops da área** no Fechamento Legal Ops
  (timesheet), gravado em `legal_ops_rateio_mensal` a cada fechamento. O "% de agendamentos" da planilha é
  esse mesmo número. Mês sem fechamento Legal Ops usa o último gravado e fica marcado.
- **Desp. indiretas:** OPEX de Facilities, Financeiro, Marketing, R.H., T.I. e Comercial + **pró-labore
  dos sócios lançado no VIOS**, rateados por profissionais. **Profissionais** vêm do cadastro de RH
  (`sp_turnover`): quem trabalhou ao menos um dia no mês na área (quem entra no último dia conta no mês
  seguinte; advogado parceiro não conta). Jan–ago/2026 mantêm os números digitados da planilha.
- **DL Gestor:** por cliente da carteira do gestor: líquido do cliente − despesas da área (operacionais +
  Controladoria + indiretas) rateadas pela receita líquida; soma × % do gestor. **Cliente novo da área entra
  na carteira automaticamente**; quem estava com 0% na planilha (inclusive o Banco do Brasil, que vai para
  os sócios) ficou marcado como excluído. Mês negativo segue a regra da área: **mensal** (zera o mês,
  padrão) ou **acumulado** (compensa no ano) — pendente de definição dos sócios.
- **Fechamento do mês:** o SIOE grava a foto do mês (áreas e gestores). Depois disso, o que mudar no VIOS
  para um mês fechado (ex.: NFS-e lançada depois) não altera o valor fechado: a diferença entra como ajuste
  no DL do próximo mês fechado, sem deixar o DL do mês negativo (o resto segue para o mês seguinte). Só o
  último mês fechado pode ser reaberto.

Gestores, %, vigência e carteira ficam na aba **Parâmetros**. Profissionais e % da Controladoria podem ser
corrigidos à mão num mês (o valor digitado vence o automático).

## Pontos em aberto

- **Regra do negativo** (mensal × acumulado) depende dos sócios.
- **Corte:** set e out/2026 ainda foram fechados na planilha; falta comparar com o SIOE e decidir o mês
  a partir do qual o SIOE é a fonte oficial.
- **Alíquotas de set/2026 em diante** precisam ser informadas (a planilha usava 16,0587%; em nov/2026 o
  consultor informou 21,36%).
- **Ajuste entre anos:** a diferença de um mês fechado só entra em meses do mesmo ano.
