/** Regras da baseline OPEX v2. A migração grava a mesma lista nas tabelas editáveis. */

export const VERSAO = '2026-09-24.1'
export const MESES = Array.from({ length: 20 }, (_, i) => {
  const ano = 2025 + Math.floor(i / 12)
  const mes = (i % 12) + 1
  return `${ano}-${String(mes).padStart(2, '0')}`
})

export const PARAMETROS = [
  ['periodo_inicio', '2025-01', 'confirmada', 'Jan/2025'],
  ['periodo_fim', '2026-08', 'confirmada', 'Ago/2026. Set/2026 fica de fora por estar aberto.'],
  ['regime_principal', 'caixa', 'confirmada', '2026 em caixa: data_pagamento + valor_pago_item. Competência é visão auxiliar. Aviso: competência de 8.1.01 inconsistente no VIOS.'],
  ['regime_auxiliar', 'competencia', 'confirmada', 'Visão auxiliar. Competência de 8.1.01 inconsistente no VIOS.'],
  ['opex_2025', 'nao_comparavel', 'confirmada', 'Não entra nas comparações das abas 06, 07 e 09. Motivos: 2.2.09.001 contém transferências, aplicações e reserva de bônus; 2.6.01 e 5.14.03 contêm impostos sobre faturamento e folha; 2.3.06 e 2.3.05 estão sem descrição. 2025 permanece na receita.'],
  ['receita_operacional', 'honorarios_brutos', 'confirmada', 'Contas 3.1.01, 3.1.03, 3.1.04, 3.1.05, 3.1.06, 3.1.07 e 3.1.08, fora o departamento Conta Corrente Clientes. DAS à parte, só em 2026.'],
  ['mes_destino_bonus_2025', '2025-12', 'premissa', 'Bônus 8.2.01 pago em jan–fev/2026 vai para competência 2025. O mês dentro de 2025 não foi definido; esta baseline usa dez/2025. Não há provisão de bônus de 2026.'],
  ['metodo_provisao_13_ferias', 'um_doze_da_remuneracao_fixa_do_mes', 'sugerida', 'Provisão do mês = (8.1.01 + 8.1.02 do mês) / 12, separada para 13º e para férias. A visão sem provisão guarda o valor lançado em 8.2.05 e 8.2.04.'],
  ['peso_fte_estagiario', '0.75', 'premissa', 'Todo cargo com Estagiário, jurídico ou não. Demais categorias = 1.'],
  ['premissa_categoria_cargo', 'regra_fixa', 'premissa', 'Áreas jurídicas: Reestruturação, Trabalhista, Cível, Contratos, Recuperação de Crédito, Tributário e Distressed Deals. Ordem: 1 sócio; 2 estagiário jurídico; 3 estagiário não jurídico vira apoio; 4 advogado, coordenador, gerente ou supervisor em área jurídica; 5 qualquer cargo fora da área jurídica, inclusive Advogada Pleno Controller; 6 demais apoio. Sem revisão manual.'],
  ['premissa_forecast', 'estrutura_mantida', 'premissa', 'Caixa. Realizado jan–ago mais run-rate estrutural vezes 4. Sem contratações, saídas ou reajustes além dos já observados. Reajuste detectado não entra no número.'],
  ['meses_run_rate', '3', 'confirmada', 'Jun, jul e ago/2026, camada estrutural, em caixa'],
  ['semivariavel_no_equilibrio', 'fixo', 'sugerida', 'A fórmula de equilíbrio não define o semivariável. Nesta baseline ele entra como fixo.'],
  ['faixa_aliquota_pp', '2', 'sugerida', 'Mês fora do padrão quando a alíquota efetiva se afasta mais de 2 pontos da mediana da série.'],
  ['nome_referencia', 'Referência 2026', 'confirmada', 'Não é orçamento aprovado. Referência montada em jul/2026 a partir do realizado até ago.'],
  ['tratamento_das', 'pagamento_menos_1', 'confirmada', 'DAS pago no mês M alocado à receita de M-1. ISS, DARF e ISSQN permanecem na competência do título.'],
]

export const DEPARTAMENTOS = [
  ['Insolvência', 'area_juridica', true, 'confirmada', 'Área de meta'],
  ['Trabalhista', 'area_juridica', true, 'confirmada', 'Área de meta'],
  ['Cível', 'area_juridica', true, 'confirmada', 'Área de meta'],
  ['Contratos', 'area_juridica', true, 'confirmada', 'Área de meta'],
  ['Recuperação de Crédito', 'area_juridica', true, 'confirmada', 'Área de meta'],
  ['Tributário', 'area_juridica', false, 'sugerida', 'Área jurídica que não está na lista de meta'],
  ['Facilities', 'indireto', false, 'confirmada', 'Centro de custo corporativo, não a área de Facilities'],
  ['Operações Legais', 'indireto', false, 'confirmada', 'Apoio'],
  ['Financeiro', 'indireto', false, 'confirmada', 'Apoio'],
  ['T.I.', 'indireto', false, 'confirmada', 'Apoio'],
  ['R.H.', 'indireto', false, 'confirmada', 'Apoio'],
  ['Marketing', 'indireto', false, 'confirmada', 'Apoio'],
  ['Comercial', 'indireto', false, 'confirmada', 'Apoio'],
  ['BP', 'indireto', false, 'sugerida', 'Sem definição explícita de tipo'],
  ['Distressed Deals', 'encerrado', false, 'confirmada', 'Área encerrada'],
  ['Conta Corrente Clientes', 'conta_de_cliente', false, 'confirmada', 'Fora do OPEX e da receita de reembolso'],
  ['Gustavo Bismarchi Motta', 'socio', false, 'confirmada', 'Departamento de sócio'],
  ['Ricardo Viscardi Pires', 'socio', false, 'confirmada', 'Departamento de sócio'],
  ['Cível | Insolvência', 'area_juridica', false, 'sugerida', 'Departamento misto; não é uma área de meta'],
]

export const PERIMETRO = [
  [10, 'departamento', 'Conta Corrente Clientes', null, null, 'fora', 'Reembolsáveis de clientes', 'confirmada', 'Qualquer conta PAGAR nesse departamento'],
  [20, 'prefixo', '2.6.04', null, null, 'fora', 'Repasses a clientes', 'confirmada', ''],
  [21, 'prefixo', '3.2.07', null, null, 'fora', 'Repasses a clientes', 'confirmada', ''],
  [30, 'prefixo', '8.1.03', null, null, 'fora', 'Sócios de capital', 'confirmada', 'Pró-labore'],
  [31, 'prefixo', '2.4.', null, null, 'fora', 'Sócios de capital', 'confirmada', 'Contas nominais de sócios'],
  [32, 'prefixo', '7.1.', null, null, 'fora', 'Sócios de capital', 'confirmada', 'Distribuição de lucros e dividendos'],
  [33, 'conta_e_tipo_departamento', '8.3.03', null, 'socio', 'fora', 'Sócios de capital', 'confirmada', 'IRRF lançado em departamento de sócio'],
  [34, 'conta_e_tipo_departamento', '5.14.03', null, 'socio', 'fora', 'Sócios de capital', 'confirmada', 'Anuidades e regularizações na OAB'],
  [40, 'conta_e_descricao', '5.14.03', 'DAS', null, 'fora', 'Deduções / tributos sobre faturamento', 'confirmada', 'Palavra DAS na descrição'],
  [41, 'prefixo', '2.2.06', null, null, 'fora', 'Deduções / tributos sobre faturamento', 'confirmada', 'Tributos, DARF, DAS e ISSQN'],
  [42, 'prefixo', '3.3.01', null, null, 'fora', 'Deduções / tributos sobre faturamento', 'confirmada', 'ISS'],
  [43, 'prefixo', '3.4.', null, null, 'fora', 'Deduções / tributos sobre faturamento', 'confirmada', 'Deduções da receita'],
  [50, 'conta_e_descricao', '5.14.03', 'PARCELAMENTO', null, 'fora', 'Passivo tributário', 'confirmada', 'Simples e PGFN'],
  [60, 'prefixo', '10.1.', null, null, 'fora', 'CAPEX', 'confirmada', 'Fora em todas as visões, inclusive por departamento'],
  [61, 'prefixo', '2.2.13', null, null, 'fora', 'CAPEX', 'confirmada', 'Bens móveis'],
  [70, 'prefixo', '5.18.03', null, null, 'fora', 'Não operacional', 'confirmada', 'Multas e juros'],
  [71, 'prefixo', '2.2.09.002', null, null, 'fora', 'Não operacional', 'confirmada', 'Transferência'],
  [72, 'prefixo', '2.2.09.003', null, null, 'fora', 'Não operacional', 'confirmada', 'Aplicação'],
  [73, 'prefixo', '1.1.', null, null, 'fora', 'Não operacional', 'confirmada', 'Empréstimos, aplicações e devoluções'],
  [80, 'prefixo', '5.16.09', null, null, 'fora', 'Permuta', 'confirmada', 'Sem desembolso operacional'],
]

export const CLASSIFICACAO = [
  ['8.1.01', 'Pessoas', 'Associados', 'fixa', 'contratual'],
  ['8.1.02', 'Pessoas', 'CLT', 'fixa', 'contratual'],
  ['8.2.', 'Pessoas', 'Remuneração variável', 'variável', 'interna'],
  ['5.21.05', 'Pessoas', 'Remuneração variável', 'variável', 'interna'],
  ['8.3.', 'Pessoas', 'Encargos', 'fixa', 'legal'],
  ['2.3.05', 'Pessoas', 'Encargos', 'fixa', 'legal'],
  ['8.4.', 'Pessoas', 'Benefícios', 'fixa', 'contratual'],
  ['5.4.03', 'Pessoas', 'Benefícios', 'fixa', 'contratual'],
  ['2.3.04', 'Pessoas', 'Benefícios', 'fixa', 'contratual'],
  ['8.7.', 'Pessoas', 'Desligamentos', 'variável', 'legal'],
  ['8.5.', 'Pessoas', 'Desenvolvimento e cultura', 'variável', 'interna'],
  ['8.8.', 'Pessoas', 'Desenvolvimento e cultura', 'variável', 'interna'],
  ['8.6.', 'Pessoas', 'Desenvolvimento e cultura', 'variável', 'interna'],
  ['5.5.03', 'Pessoas', 'Desenvolvimento e cultura', 'fixa', 'legal'],
  ['2.3.06', 'Pessoas', 'Outros de pessoal', 'variável', 'interna'],
  ['4.1.01', 'Comissões e parcerias', 'Comissões', 'variável', 'contratual'],
  ['4.1.02', 'Comissões e parcerias', 'Comissões', 'variável', 'interna'],
  ['2.3.07', 'Comissões e parcerias', 'Comissões', 'variável', 'interna'],
  ['5.8.19', 'Serviços profissionais', 'Honorários contábeis', 'fixa', 'contratual'],
  ['5.8.13', 'Serviços profissionais', 'Certificado digital', 'variável', 'contratual'],
  ['5.8.16', 'Serviços profissionais', 'Correspondentes', 'variável', 'contratual'],
  ['5.8.20', 'Serviços profissionais', 'Consultoria', 'semivariável', 'contratual'],
  ['9.1.', 'Tecnologia', 'Sistemas', 'fixa', 'contratual'],
  ['5.20.', 'Tecnologia', 'Sistemas de área', 'fixa', 'contratual'],
  ['2.2.05', 'Tecnologia', 'Software', 'fixa', 'contratual'],
  ['2.5.02', 'Tecnologia', 'Informática', 'fixa', 'contratual'],
  ['5.8.02', 'Tecnologia', 'Serviços de informática', 'fixa', 'contratual'],
  ['5.9.04', 'Tecnologia', 'Manutenção de informática', 'semivariável', 'contratual'],
  ['5.10.03', 'Tecnologia', 'Material de informática', 'semivariável', 'interna'],
  ['5.12.03', 'Tecnologia', 'Internet', 'fixa', 'contratual'],
  ['5.12.04', 'Tecnologia', 'Telefonia fixa', 'fixa', 'contratual'],
  ['5.12.07', 'Tecnologia', 'Telefonia móvel', 'fixa', 'contratual'],
  ['5.13.', 'Ocupação e facilities', 'Aluguel', 'fixa', 'contratual'],
  ['5.12.01', 'Ocupação e facilities', 'Água e esgoto', 'fixa', 'contratual'],
  ['5.12.02', 'Ocupação e facilities', 'Energia', 'fixa', 'contratual'],
  ['5.12.06', 'Ocupação e facilities', 'Alarme', 'fixa', 'contratual'],
  ['5.9.01', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'interna'],
  ['5.9.02', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'interna'],
  ['5.9.03', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'contratual'],
  ['5.9.05', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'contratual'],
  ['5.9.06', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'interna'],
  ['5.9.07', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'contratual'],
  ['5.9.08', 'Ocupação e facilities', 'Manutenção', 'semivariável', 'contratual'],
  ['5.11.', 'Ocupação e facilities', 'Copa', 'semivariável', 'interna'],
  ['5.8.24', 'Ocupação e facilities', 'Limpeza', 'fixa', 'contratual'],
  ['5.8.31', 'Ocupação e facilities', 'Limpeza', 'variável', 'contratual'],
  ['5.10.01', 'Ocupação e facilities', 'Higiene', 'semivariável', 'interna'],
  ['5.10.04', 'Ocupação e facilities', 'Decoração', 'variável', 'interna'],
  ['5.14.05', 'Ocupação e facilities', 'Seguros', 'fixa', 'contratual'],
  ['5.15.', 'Marketing', 'Marketing', 'variável', 'interna'],
  ['2.2.12', 'Marketing', 'Brindes', 'variável', 'interna'],
  ['2.5.03', 'Marketing', 'Eventos', 'variável', 'interna'],
  ['5.6.02', 'Despesas processuais', 'Custas', 'variável', 'legal'],
  ['2.6.01.005', 'Despesas processuais', 'Correios jurídicos', 'variável', 'legal'],
  ['2.6.01', 'Despesas processuais', 'Custas', 'variável', 'legal'],
  ['2.6.03', 'Despesas processuais', 'Diligência', 'variável', 'legal'],
  ['2.5.01', 'Despesas processuais', 'Despesas jurídicas', 'variável', 'legal'],
  ['5.16.06', 'Despesas processuais', 'Reembolsáveis do escritório', 'variável', 'legal'],
  ['5.16.07', 'Despesas processuais', 'Guias', 'variável', 'legal'],
  ['5.10.02', 'Administrativo e financeiro', 'Material de escritório', 'semivariável', 'interna'],
  ['2.2.11', 'Administrativo e financeiro', 'Material de escritório', 'semivariável', 'interna'],
  ['5.8.03', 'Administrativo e financeiro', 'Motoboy', 'variável', 'contratual'],
  ['5.8.05', 'Administrativo e financeiro', 'Correios', 'variável', 'contratual'],
  ['5.8.07', 'Administrativo e financeiro', 'Gráfica', 'variável', 'contratual'],
  ['5.18.01', 'Administrativo e financeiro', 'Custos bancários e de cobrança', 'semivariável', 'contratual'],
  ['5.18.02', 'Administrativo e financeiro', 'Custos bancários e de cobrança', 'semivariável', 'legal'],
  ['5.18.04', 'Administrativo e financeiro', 'Custos bancários e de cobrança', 'semivariável', 'contratual'],
  ['5.18.05', 'Administrativo e financeiro', 'Custos bancários e de cobrança', 'semivariável', 'contratual'],
  ['2.2.09.001', 'Administrativo e financeiro', 'Tarifas', 'semivariável', 'contratual'],
  ['5.14.03', 'Administrativo e financeiro', 'Impostos e taxas remanescentes', 'variável', 'legal'],
  ['5.16.02', 'Administrativo e financeiro', 'Publicações', 'variável', 'interna'],
  ['5.16.04', 'Administrativo e financeiro', 'Outras despesas de operação', 'semivariável', 'interna'],
  ['2.2.03', 'Administrativo e financeiro', 'Serviços da sede', 'semivariável', 'contratual'],
  ['5.16.03', 'Administrativo e financeiro', 'Cartão de crédito', 'semivariável', 'interna'],
  ['2.2.08', 'Administrativo e financeiro', 'Cartão de crédito', 'semivariável', 'interna'],
  ['5.7.', 'Viagens', 'Viagens', 'variável', 'interna'],
]

export const FORNECEDORES = [
  ['FRANCISCO DE ASSIS BARBOSA CAMPOS ZANIN', 'Comissões e parcerias', 'Parceria por contrato', 'variável', 'contratual', 'confirmada', 'Mesmo quando lançado em 5.8.20'],
  ['ANTUNES GALVAO', 'Consultorias estratégicas', 'Financeira', 'fixa', 'contratual', 'confirmada', 'Contrato até 12/2026'],
  ['JSN SERVICOS ADMINISTRATIVOS', 'Consultorias estratégicas', 'Financeira', 'fixa', 'contratual', 'confirmada', 'Encerrada em 05/2026'],
  ['MAIS HUMANIDADE', 'Consultorias estratégicas', 'Pessoas', 'fixa', 'contratual', 'confirmada', 'Prazo indeterminado'],
  ['CARLOS ZAMBONI', 'Consultorias estratégicas', 'Estratégica', 'fixa', 'contratual', 'confirmada', 'Prazo indeterminado'],
]

export const CONSULTORIAS = [
  ['Antunes Galvao Consultoria Em Gestao Empresarial', 'Financeira', '2026-12-01', 'Contrato até 12/2026. Início na tabela é o primeiro mês observado, não a data do contrato.'],
  ['Jsn Servicos Administrativos Eireli Me', 'Financeira', '2026-05-01', 'Encerrada em 05/2026.'],
  ['Mais Humanidade Ltda', 'Pessoas', null, 'Prazo indeterminado.'],
  ['Carlos Zamboni Neto', 'Estratégica', null, 'Prazo indeterminado.'],
]

export const CAMADAS = [
  ['conta', '5.15.05', 'discricionario', 'confirmada', 'Patrocínios, decisão caso a caso'],
  ['prefixo', '8.7.', 'nao_recorrente', 'confirmada', 'Desligamentos'],
  ['ajuste', 'bonus_jan_fev_2026', 'nao_recorrente', 'confirmada', 'Bônus pago fora da competência'],
]

export const GRUPOS_PAINEL_FORA = [
  'DISTRIBUICAO DE LUCROS',
  'SOCIOS',
  'OUTRAS RECEITAS OPERACIONAIS',
  'SAIDAS - EMPRESTIMOS APL. E DEVOLUCOES',
  'INVESTIMENTOS',
  'DEDUCOES DA RECEITA',
]

export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9./|& -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function departamentoDe(nome) {
  const alvo = String(nome ?? '').trim()
  return DEPARTAMENTOS.find((d) => d[0] === alvo) ?? null
}

export function aplicarPerimetro(row) {
  const conta = String(row.conta_numero ?? '').trim()
  const dep = departamentoDe(row.departamento)
  const tipoDep = dep ? dep[1] : 'nao_classificado'
  const desc = norm(row.descricao)
  for (const regra of PERIMETRO) {
    const [, tipo, chave, descricao, tipoDepartamento] = regra
    if (tipo === 'departamento' && String(row.departamento ?? '').trim() === chave) return montar(regra)
    if (tipo === 'prefixo' && conta.startsWith(chave)) return montar(regra)
    if (tipo === 'conta_e_tipo_departamento' && conta.startsWith(chave) && tipoDep === tipoDepartamento) return montar(regra)
    if (tipo === 'conta_e_descricao' && conta.startsWith(chave) && descricaoCasa(desc, descricao)) return montar(regra)
  }
  if (/\bDISTR/.test(desc) && desc.includes('LUCRO')) {
    return {
      efeito: 'fora',
      linha: 'Sócios de capital',
      status: 'sugerida',
      nota: 'Descrição indica distribuição de lucros fora da conta 7.1',
    }
  }
  return { efeito: 'dentro', linha: '', status: 'confirmada', nota: '' }
}

function montar(regra) {
  return { efeito: regra[5], linha: regra[6], status: regra[7], nota: regra[8] }
}

function descricaoCasa(desc, termo) {
  if (termo === 'DAS') return /(^|[^A-Z])DAS([^A-Z]|$)/.test(desc)
  return desc.includes(termo)
}

const CLASSIFICACAO_ORDENADA = [...CLASSIFICACAO].sort((a, b) => b[0].length - a[0].length)

export function classificarConta(conta) {
  const c = String(conta ?? '')
  const regra = CLASSIFICACAO_ORDENADA.find((r) => c.startsWith(r[0]))
  if (!regra) {
    return {
      grupo: 'Outros',
      subgrupo: 'Sem regra',
      natureza: 'semivariável',
      controlabilidade: 'interna',
      status: 'sugerida',
      nota: 'Conta sem regra na classificação',
    }
  }
  return {
    grupo: regra[1],
    subgrupo: regra[2],
    natureza: regra[3],
    controlabilidade: regra[4],
    status: 'sugerida',
    nota: regra[0] === '9.1.' ? '9.1.x inteiro, inclusive Marketing e comercial' : '',
  }
}

export function overrideFornecedor(fornecedor) {
  const f = norm(fornecedor)
  if (!f || f === '—') return null
  const regra = FORNECEDORES.find((r) => f.includes(r[0]))
  if (!regra) return null
  return {
    grupo: regra[1],
    subgrupo: regra[2],
    natureza: regra[3],
    controlabilidade: regra[4],
    status: regra[5],
    nota: regra[6],
  }
}

export function reclassificarDescricao(conta, descricao, classe) {
  const c = String(conta ?? '')
  const d = norm(descricao)
  if (c.startsWith('2.5.03')) {
    if (/\b(ANIVERS|FESTA|BOLO|PRESENTE|PASCOA|JUNINA|CAMISETA|CORRIDA|PERSONAL|CAFE COM CULTURA|CHA DE BEBE|CONFRATERN|OVOS)\b/.test(d)) {
      return { ...classe, grupo: 'Pessoas', subgrupo: 'Desenvolvimento e cultura', natureza: 'variável', controlabilidade: 'interna', nota: 'Evento interno pela descrição', flag: 'evento_interno' }
    }
    if (/\b(INVESTMENT|TURNAROUND|FEIRA|CONGRESSO|PATROC)\b/.test(d)) {
      return { ...classe, grupo: 'Marketing', subgrupo: 'Eventos externos', nota: 'Evento externo pela descrição', flag: 'evento_externo' }
    }
    if (d.includes('LIMPEZA')) {
      return { ...classe, grupo: 'Ocupação e facilities', subgrupo: 'Limpeza', nota: 'Reclassificado pela descrição', flag: 'reclassificado_descricao' }
    }
    return { ...classe, flag: 'duvida_evento', nota: 'Evento sem critério claro; permanece em Marketing' }
  }
  if (c.startsWith('5.16.03') || c.startsWith('2.2.08')) {
    if (/\b(MICROSOFT|GOOGLE|ADOBE|SOFTWARE|HOSTINGER|AWS|OPENAI|CHATGPT)\b/.test(d)) {
      return { ...classe, grupo: 'Tecnologia', subgrupo: 'Software no cartão', nota: 'Reclassificado pela descrição', flag: 'reclassificado_descricao' }
    }
    if (/\b(UBER|99APP|POSTO|COMBUST|LATAM|AIRBNB|HOTEL|PASSAGEM)\b/.test(d)) {
      return { ...classe, grupo: 'Viagens', subgrupo: 'Deslocamento no cartão', nota: 'Reclassificado pela descrição', flag: 'reclassificado_descricao' }
    }
    if (/\b(IFOOD|RESTAURANTE|PADARIA)\b/.test(d)) {
      return { ...classe, grupo: 'Ocupação e facilities', subgrupo: 'Copa', nota: 'Reclassificado pela descrição', flag: 'reclassificado_descricao' }
    }
    return { ...classe, flag: 'natureza_nao_identificada', nota: 'Cartão sem descrição suficiente' }
  }
  return classe
}

export function areaEhJuridica(area) {
  const a = norm(area)
  if (a.includes('DISTRESS')) return true
  return ['REESTRUTURACAO', 'TRABALHISTA', 'CIVEL', 'CONTRATOS', 'RECUPERACAO', 'TRIBUTARIO'].some((x) => a.includes(x))
}

export function categoriaCargo(cargo, area) {
  const c = norm(cargo)
  const juridica = areaEhJuridica(area)
  const estagiario = c.includes('ESTAGI')
  if (c === 'SOCIO' || c === 'SOCIO DE AREA') {
    return { categoria: 'socio', peso: 1, regra: '1. Cargo Sócio ou Sócio de Área' }
  }
  if (estagiario && juridica) {
    return { categoria: 'estagiario', peso: 0.75, regra: '2. Estagiário em área jurídica' }
  }
  if (estagiario) {
    return { categoria: 'apoio', peso: 0.75, regra: '3. Estagiário fora de área jurídica' }
  }
  if (c.includes('CONTROLLER')) {
    return { categoria: 'apoio', peso: 1, regra: '5. Advogada Pleno Controller, apoio mesmo em área jurídica' }
  }
  if (juridica && (c.includes('ADVOGAD') || c.includes('COORDENADOR') || c.includes('GERENTE') || c.includes('SUPERVISOR'))) {
    return { categoria: 'advogado', peso: 1, regra: '4. Advogado, coordenador, gerente ou supervisor em área jurídica' }
  }
  if (!juridica) {
    return { categoria: 'apoio', peso: 1, regra: '5. Cargo em área não jurídica' }
  }
  return { categoria: 'apoio', peso: 1, regra: '6. Demais cargos' }
}

export function areaParaDepartamento(area) {
  const a = norm(area)
  if (a.includes('REESTRUTURACAO') || a.includes('INSOLVENCIA')) return 'Insolvência'
  if (a.includes('TRABALHISTA')) return 'Trabalhista'
  if (a.includes('CIVEL')) return 'Cível'
  if (a.includes('CONTRAT')) return 'Contratos'
  if (a.includes('RECUPERACAO') || a.includes('CREDITO')) return 'Recuperação de Crédito'
  if (a.includes('TRIBUT')) return 'Tributário'
  if (a.includes('OPERACOES LEGAIS')) return 'Operações Legais'
  if (a.includes('FINANCEIR')) return 'Financeiro'
  if (a === 'T.I.' || a === 'TI' || a.includes('TECNOLOGIA')) return 'T.I.'
  if (a.includes('MARKETING')) return 'Marketing'
  if (a.includes('COMERCIAL')) return 'Comercial'
  if (a === 'RH' || a.includes('R.H')) return 'R.H.'
  if (a.includes('SOCIO')) return 'Sócios'
  if (a.includes('DISTRESS')) return 'Distressed Deals'
  return area || '(sem área)'
}

export const CONTAS_TEXTO_OMITIDO = ['8.1.', '8.2.', '8.3.', '8.4.', '8.7.', '2.3.04', '2.3.06', '2.4.', '5.4.03', '5.21.05', '7.1.']

export function omitirTextoPessoa(conta) {
  return CONTAS_TEXTO_OMITIDO.some((p) => String(conta ?? '').startsWith(p))
}
