const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'CDI_20260211.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== Abas da planilha ===');
console.log(workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log('\n=== Aba:', sheetName, '===');
  console.log('Total de linhas:', data.length);
  if (data.length > 0) {
    console.log('Cabeçalho (linha 1):', JSON.stringify(data[0], null, 2));
    if (data.length > 1) {
      console.log('Amostra linha 2:', JSON.stringify(data[1], null, 2));
      if (data.length > 2) console.log('Amostra linha 3:', JSON.stringify(data[2], null, 2));
    }
  }
}
