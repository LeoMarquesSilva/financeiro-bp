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

- **Receita bruta:** honorários recebidos, pelo departamento do item no VIOS.
- **Impostos:** 16,0587% do recebido quando o título tem NFS-e (o VIOS grava `N/A` sem NF).
- **Desp. operacionais:** OPEX do departamento (mesma regra do painel OPEX), sem impostos sobre
  faturamento. **Distribuição de lucros — inclusive o DL pago aos gestores —, repasses, investimentos,
  empréstimos e deduções ficam fora** (decisão de 26/10/2026; a planilha descontava o DL pago).
- **Desp. Controladoria:** OPEX de Operações Legais × % de agendamentos da área.
- **Desp. indiretas:** OPEX de Facilities, Financeiro, Marketing, R.H., T.I. e Comercial + **pró-labore
  dos sócios lançado no VIOS**, rateados por profissionais.
- **DL Gestor:** por cliente da carteira do gestor: líquido do cliente − despesas da área (operacionais +
  Controladoria + indiretas) rateadas pela receita líquida; soma × % do gestor. **Mês negativo vira zero**
  (decisão de 26/10/2026). Gestor sem carteira não recebe DL (é o caso do ADD, como na planilha).

Profissionais e % de agendamentos ficam na aba **Parâmetros** (pré-preenchidos com a planilha; o VIOS não
tem essa informação de forma confiável: `colaboradores` não registra desligamentos e 78% de
`sp_agendamento` não tem área). Meses sem cadastro herdam o último mês preenchido. O % e a carteira de
cada gestor também ficam lá.

O DL Gestor de jun–ago fica próximo da planilha; as diferenças vêm de NFS-e lançadas depois da
exportação (imposto maior no SIOE), DL pago e parcelas fixas fora da despesa da área, negativo zerado e
receita alterada no VIOS.

## Pontos em aberto

- **Liberação de Recursos** não é separada no SIOE (a planilha zera de jun em diante e soma em honorários).
- **Renato em Rec. Crédito** (só ago na planilha, com o mesmo valor do Giancarlo) não foi cadastrado.
