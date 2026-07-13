/**
 * Exporta relatório de faturamento (VIOS) para Excel.
 * Uso: node scripts/export-faturamento-mes.cjs [ano] [mes] [caminho-saida]
 * Ex.: node scripts/export-faturamento-mes.cjs 2026 6
 *
 * Colunas: Cliente (VIOS), Grupo, Empresa (cadastro), Área, Valor Faturado, Data Faturamento
 * Faturamento = itens com data_vencimento no mês (mesma regra da Receita/Inadimplência).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const ANO = parseInt(process.argv[2] || '2026', 10);
const MES = parseInt(process.argv[3] || '6', 10);
const OUT =
  process.argv[4] ||
  path.join(__dirname, '..', `relatorio-faturamento-${ANO}-${String(MES).padStart(2, '0')}.xlsx`);

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fimMes(ano, mes) {
  return new Date(ano, mes, 0);
}

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrencyBR(val) {
  return (Number(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchAllRows(supabase, inicio, fim) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const { data, error } = await supabase
      .from('receita_itens_inadimplencia_base')
      .select(
        'cliente, grupo_cliente, valor_item, data_vencimento, ci_titulo, ci_item, plano_contas, pessoa_id, categoria',
      )
      .gte('data_vencimento', inicio)
      .lte('data_vencimento', fim)
      .order('data_vencimento', { ascending: true })
      .order('cliente', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function fetchDepartamentoMap(supabase, ciItems) {
  const unique = [...new Set(ciItems.filter(Boolean))];
  const map = new Map();
  const chunk = 200;

  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('financeiro_parcelas_itens')
      .select('ci_item, departamento')
      .in('ci_item', slice);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) map.set(r.ci_item, r.departamento ?? '');
  }

  return map;
}

async function fetchPessoasMap(supabase, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  const chunk = 200;

  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('pessoas')
      .select('id, nome, grupo_cliente, cpf_cnpj')
      .in('id', slice);
    if (error) throw new Error(error.message);
    for (const p of data ?? []) map.set(p.id, p);
  }

  return map;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  }

  const supabase = createClient(url, key);
  const inicio = `${ANO}-${String(MES).padStart(2, '0')}-01`;
  const fimDate = fimMes(ANO, MES);
  const fim = `${ANO}-${String(MES).padStart(2, '0')}-${String(fimDate.getDate()).padStart(2, '0')}`;

  console.log(`[Export] Faturamento ${MESES[MES - 1]}/${ANO} (${inicio} a ${fim})`);

  const rows = await fetchAllRows(supabase, inicio, fim);
  console.log(`[Export] ${rows.length} linhas encontradas`);

  const pessoasMap = await fetchPessoasMap(
    supabase,
    rows.map((r) => r.pessoa_id),
  );
  const departamentoMap = await fetchDepartamentoMap(
    supabase,
    rows.map((r) => r.ci_item),
  );

  const excelRows = rows.map((r) => {
    const pessoa = r.pessoa_id ? pessoasMap.get(r.pessoa_id) : null;
    return {
      Cliente: r.cliente ?? '',
      Grupo: r.grupo_cliente ?? pessoa?.grupo_cliente ?? 'Sem grupo',
      Empresa: pessoa?.nome ?? r.cliente ?? '',
      Área: departamentoMap.get(r.ci_item) ?? '',
      'CNPJ/CPF': pessoa?.cpf_cnpj ?? '',
      'Valor Faturado (R$)': Number(r.valor_item) || 0,
      'Data Faturamento': formatDateBR(r.data_vencimento),
      Categoria: r.categoria ?? '',
      'Plano Contas': r.plano_contas ?? '',
      'CI Título': r.ci_titulo ?? '',
      'CI Item': r.ci_item ?? '',
    };
  });

  const total = excelRows.reduce((s, r) => s + r['Valor Faturado (R$)'], 0);

  excelRows.push({
    Cliente: 'TOTAL',
    Grupo: '',
    Empresa: '',
    Área: '',
    'CNPJ/CPF': '',
    'Valor Faturado (R$)': Math.round(total * 100) / 100,
    'Data Faturamento': '',
    Categoria: '',
    'Plano Contas': '',
    'CI Título': '',
    'CI Item': '',
  });

  const ws = XLSX.utils.json_to_sheet(excelRows);
  ws['!cols'] = [
    { wch: 45 }, { wch: 28 }, { wch: 45 }, { wch: 22 }, { wch: 20 }, { wch: 18 },
    { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 10 },
  ];

  const resumo = [
    { Campo: 'Período', Valor: `${MESES[MES - 1]}/${ANO}` },
    { Campo: 'Critério', Valor: 'Data de vencimento (faturamento VIOS)' },
    { Campo: 'Linhas', Valor: rows.length },
    { Campo: 'Total Faturado (R$)', Valor: formatCurrencyBR(total) },
    { Campo: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumo);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  XLSX.utils.book_append_sheet(wb, ws, 'Faturamento');

  XLSX.writeFile(wb, OUT);
  console.log(`[Export] Arquivo gerado: ${OUT}`);
  console.log(`[Export] Total faturado: R$ ${formatCurrencyBR(total)}`);
}

main().catch((err) => {
  console.error('[Export] Erro:', err.message);
  process.exit(1);
});
