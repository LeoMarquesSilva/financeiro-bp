/**
 * Inspeciona um arquivo TimeSheet .xlsx: cabeçalhos e primeiras linhas da coluna de horas.
 * Uso: node scripts/inspect-timesheet-xlsx.cjs "adriana timesheet.xlsx"
 */
const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2] || path.join(__dirname, '..', 'adriana timesheet.xlsx');

let workbook;
try {
  workbook = XLSX.readFile(filePath, { cellDates: true, raw: false });
} catch (e) {
  console.error('Erro ao abrir:', e.message);
  process.exit(1);
}

const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

const headerRow = data[0];
console.log('=== Cabeçalhos (raw) ===');
headerRow.forEach((h, i) => {
  const raw = typeof h === 'string' ? JSON.stringify(h) : (h && h.toString ? h.toString() : String(h));
  console.log(`  [${i}] ${raw}`);
});

console.log('\n=== Cabeçalhos (normalizado, sem HTML) ===');
const normalized = headerRow.map((h) =>
  (h != null ? String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() : '')
);
normalized.forEach((n, i) => console.log(`  [${i}] ${JSON.stringify(n)}`));

const totalHorasIdx = normalized.findIndex((n) => n.includes('total') && n.includes('horas'));
const totalDecimalIdx = normalized.findIndex((n) => n.includes('total') && n.includes('horas') && n.includes('decimal'));
console.log('\n=== Índice coluna Total Horas (HH:MM) ===', totalHorasIdx);
console.log('=== Índice coluna Total Horas EM DECIMAL ===', totalDecimalIdx);

console.log('\n=== Primeiras 15 linhas - col 18 (Total Horas) + col 19 (em decimal) + Data + Cliente ===');
const colHoras = totalHorasIdx >= 0 ? totalHorasIdx : 0;
const colDecimal = totalDecimalIdx >= 0 ? totalDecimalIdx : 19;
const colData = headerRow.findIndex((h) => h && String(h).toLowerCase().includes('data'));
const colCliente = normalized.findIndex((n) => n === 'cliente' || n.includes('cliente'));
for (let i = 1; i < Math.min(16, data.length); i++) {
  const row = data[i];
  const horas = colHoras >= 0 ? row[colHoras] : '-';
  const decimal = colDecimal >= 0 ? row[colDecimal] : '-';
  const decimalType = decimal !== undefined && decimal !== '' ? typeof row[colDecimal] : '-';
  const dataVal = colData >= 0 ? row[colData] : '-';
  const cliente = colCliente >= 0 ? (row[colCliente] != null ? String(row[colCliente]).slice(0, 40) : '') : '-';
  console.log(`  Linha ${i}: HH:MM=${JSON.stringify(horas)} | decimal=${JSON.stringify(decimal)} (${decimalType}) | data=${JSON.stringify(dataVal)} | cliente=${cliente}`);
}

console.log('\n=== Célula col 18 (Total Horas) - primeira com valor ===');
for (let i = 1; i < data.length; i++) {
  const v = data[i][colHoras];
  if (v !== undefined && v !== null && v !== '') {
    const cellRef = XLSX.utils.encode_cell({ r: i, c: colHoras });
    const cell = sheet[cellRef];
    console.log('  Valor:', v, '| tipo JS:', typeof v);
    if (cell) console.log('  Cell .t:', cell.t, '| .v:', cell.v, '| .w:', cell.w);
    break;
  }
}
console.log('\n=== Célula col 19 (Total de Horas em decimal) - primeira com valor ===');
for (let i = 1; i < data.length; i++) {
  const v = data[i][colDecimal];
  if (v !== undefined && v !== null && v !== '') {
    const cellRef = XLSX.utils.encode_cell({ r: i, c: colDecimal });
    const cell = sheet[cellRef];
    console.log('  Valor:', v, '| tipo JS:', typeof v);
    if (cell) console.log('  Cell .t:', cell.t, '| .v:', cell.v, '| .w:', cell.w);
    break;
  }
}
