/**
 * Verifica totais por classe (GRAU A/B/C) na planilha QUADRO RESUMO.
 * Compara com o valor esperado do usuário (ex.: Classe C = R$ 2.404.273,51).
 * Uso: node scripts/verify-cdi-xlsx.cjs [caminho/para/CDI_20260211.xlsx]
 */

const XLSX = require('xlsx');
const path = require('path');

const FILE = process.argv[2] || path.join(__dirname, '..', 'CDI_20260211.xlsx');

function mapClassificacao(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.toUpperCase().trim();
  if (s.includes('GRAU A') || s === 'A') return 'A';
  if (s.includes('GRAU B') || s === 'B') return 'B';
  if (s.includes('GRAU C') || s === 'C') return 'C';
  return null;
}

/** Parse robusto: número, string BR (1.234,56) ou EN (1234.56) */
function parseValor(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).trim();
  if (!s) return 0;
  // Formato BR: 2.404.273,51
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Formato EN ou só números
  return parseFloat(s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || parseFloat(s) || 0;
}

console.log('Lendo planilha:', FILE);
const workbook = XLSX.readFile(FILE, { cellFormula: true });
const sheet = workbook.Sheets['QUADRO RESUMO'];
if (!sheet) {
  console.error('Aba QUADRO RESUMO não encontrada.');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
const header = (data[0] || []).map((h) => (h || '').toString().trim());
const idxCliente = header.findIndex((h) => /cliente/i.test(h));
const idxClassif = header.findIndex((h) => /classifica/i.test(h));
const idxSaldo = header.findIndex((h) => /saldo em aberto/i.test(h));

if (idxSaldo < 0) {
  console.error('Coluna "SALDO EM ABERTO" não encontrada. Cabeçalho:', header);
  process.exit(1);
}

const totais = { A: 0, B: 0, C: 0 };
const porCliente = [];

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const cliente = row[idxCliente] ? String(row[idxCliente]).trim() : '';
  if (!cliente) continue;
  const classificacao = mapClassificacao(row[idxClassif]);
  const valorBruto = row[idxSaldo];
  const valor = parseValor(valorBruto);
  if (classificacao && classificacao in totais) {
    totais[classificacao] += valor;
    porCliente.push({ cliente, classificacao, valorBruto, valor });
  }
}

console.log('\n=== Totais por classe (QUADRO RESUMO) ===');
console.log('Classe A:', totais.A.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
console.log('Classe B:', totais.B.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
console.log('Classe C:', totais.C.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
console.log('Total geral:', (totais.A + totais.B + totais.C).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

const esperadoC = 2404273.51;
const diffC = Math.abs(totais.C - esperadoC);
if (diffC < 0.02) {
  console.log('\n✓ Classe C confere com R$ 2.404.273,51');
} else {
  console.log('\n⚠ Classe C obtida:', totais.C.toFixed(2), '| Esperado: 2.404.273,51 | Diferença:', diffC.toFixed(2));
}

console.log('\n--- Amostra (primeiros 5) ---');
porCliente.slice(0, 5).forEach((p) => {
  console.log(p.cliente, '|', p.classificacao, '| valor bruto:', p.valorBruto, '| parseado:', p.valor);
});
