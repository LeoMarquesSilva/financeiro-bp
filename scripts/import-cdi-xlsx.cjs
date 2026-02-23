/**
 * Importa dados da planilha CDI (controle de inadimplência) para o Supabase.
 * Uso: node scripts/import-cdi-xlsx.cjs [caminho/para/CDI_20260211.xlsx]
 *
 * Requer .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
 *
 * Mapeamento CDI_20260211.xlsx (QUADRO RESUMO):
 * - Coluna "Observações" / "Observações gerais" → observacoes_gerais
 * - Coluna "Plano de Ação" → ultima_providencia (Providência)
 * Providência e datas também podem vir da aba Planilha1 (preferência sobre Plano de Ação).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const FILE = process.argv[2] || path.join(__dirname, '..', 'CDI_20260211.xlsx');

/** Parse robusto do valor: número (ex.: resultado de fórmula), string BR (1.234,56) ou EN (1234.56) */
function parseValorMonetario(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).trim();
  if (!s) return 0;
  // Formato BR: 2.404.273,51
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // String com apenas números e vírgula/ponto: 2404273,51 ou 2404273.51
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  if (!Number.isNaN(parsed)) return parsed;
  return parseFloat(s) || 0;
}

// Classificação vem da planilha (definida na reunião, caso a caso, pelo histórico do cliente). Apenas normaliza texto → A/B/C.
function mapClassificacao(str) {
  if (!str || typeof str !== 'string') return 'A';
  const s = str.toUpperCase().trim();
  if (s.includes('GRAU A') || s === 'A') return 'A';
  if (s.includes('GRAU B') || s === 'B') return 'B';
  if (s.includes('GRAU C') || s === 'C') return 'C';
  return 'A';
}

// Converte data Excel (serial ou string DD/MM/YYYY) para YYYY-MM-DD
function toISODate(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    const m = val.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const m2 = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return val.trim();
  }
  return null;
}

// Dias em aberto a partir da data de vencimento
function calcularDiasEmAberto(dataVencimento) {
  if (!dataVencimento) return 0;
  const venci = new Date(dataVencimento);
  const hoje = new Date();
  venci.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoje.getTime() - venci.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function calcularClasse(diasEmAberto) {
  if (diasEmAberto <= 30) return 'A';
  if (diasEmAberto <= 60) return 'B';
  return 'C';
}

// Nomes da planilha (RESPONSÁVEL) → e-mail no Supabase (team_members)
const GESTOR_PLANILHA_TO_EMAIL = {
  GIAN: 'giancarlo@bpplaw.com.br',
  Giancarlo: 'giancarlo@bpplaw.com.br',
  LEONARDO: 'leonardo@bpplaw.com.br',
  Leonardo: 'leonardo@bpplaw.com.br',
  Gustavo: 'gustavo@bpplaw.com.br',
  Ricardo: 'ricardo@bpplaw.com.br',
  Gabriela: 'gabriela.consul@bpplaw.com.br',
  Daniel: 'daniel@bpplaw.com.br',
  Renato: 'renato@bpplaw.com.br',
  Michel: 'michel.malaquias@bpplaw.com.br',
  Emanueli: 'emanueli.lourenco@bpplaw.com.br',
  Ariany: 'ariany.bispo@bpplaw.com.br',
  Jorge: 'jorge@bpplaw.com.br',
  Ligia: 'ligia@bpplaw.com.br',
  Wagner: 'wagner.armani@bpplaw.com.br',
  Jansonn: 'jansonn@bpplaw.com.br',
  Henrique: 'henrique.nascimento@bpplaw.com.br',
  Felipe: 'felipe@bpplaw.com.br',
  'Lavínia': 'lavinia.ferraz@bpplaw.com.br',
  Lavinia: 'lavinia.ferraz@bpplaw.com.br',
  Francisco: 'francisco.zanin@bpplaw.com.br',
};

function mapResponsavelToEmail(responsavel) {
  if (!responsavel || typeof responsavel !== 'string') return null;
  const t = responsavel.trim();
  return GESTOR_PLANILHA_TO_EMAIL[t] || GESTOR_PLANILHA_TO_EMAIL[t.split(/\s+/)[0]] || null;
}

// Encontra a aba do cliente pelo nome (ex: "ABG CORPORATE" → aba "ABG")
function findClientSheet(workbook, clienteNome) {
  const name = (clienteNome || '').trim().toUpperCase();
  if (!name) return null;
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === 'QUADRO RESUMO' || sheetName === 'Planilha1') continue;
    const sheetNameUpper = sheetName.toUpperCase();
    if (name === sheetNameUpper || name.startsWith(sheetNameUpper + ' ') || sheetNameUpper.startsWith(name.split(' ')[0])) {
      return workbook.Sheets[sheetName];
    }
  }
  return null;
}

// Obtém a última data de vencimento com valor em aberto na aba do cliente
function getUltimaDataVencimentoAberto(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (data.length < 2) return null;
  const header = data[0].map((h) => (h || '').toString().toLowerCase());
  const idxVenc = header.findIndex((h) => h.includes('data vencimento') || h === 'data vencimento');
  const idxAberto = header.findIndex((h) => h.includes('valor em aberto') || h === 'valor em aberto');
  if (idxVenc < 0 || idxAberto < 0) return null;
  let ultima = null;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const venc = row[idxVenc];
    const aberto = row[idxAberto];
    const numAberto = typeof aberto === 'number' ? aberto : parseFloat(String(aberto).replace(/\./g, '').replace(',', '.')) || 0;
    if (numAberto > 0 && venc) {
      const iso = toISODate(venc);
      if (iso && (!ultima || iso > ultima)) ultima = iso;
    }
  }
  return ultima;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env');
    process.exit(1);
  }

  console.log('Lendo planilha:', FILE);
  const workbook = XLSX.readFile(FILE, { cellFormula: true });

  const supabase = createClient(url, key);

  // 1) QUADRO RESUMO
  const resumoSheet = workbook.Sheets['QUADRO RESUMO'];
  if (!resumoSheet) {
    console.error('Aba "QUADRO RESUMO" não encontrada.');
    process.exit(1);
  }
  const resumoData = XLSX.utils.sheet_to_json(resumoSheet, { header: 1, defval: '', raw: true });
  const headerResumo = (resumoData[0] || []).map((h) => (h || '').toString().trim());
  const idxCliente = headerResumo.findIndex((h) => /cliente/i.test(h));
  const idxClassif = headerResumo.findIndex((h) => /classifica/i.test(h));
  const idxValorMensal = headerResumo.findIndex((h) => /valor mensal/i.test(h));
  const idxSaldo = headerResumo.findIndex((h) => /saldo em aberto/i.test(h));
  // Observações gerais → observacoes_gerais; Plano de Ação → ultima_providencia (Providência)
  const idxObs = headerResumo.findIndex((h) => /observa/i.test(h));
  const idxPlano = headerResumo.findIndex((h) => /plano de a/i.test(h));
  const idxResp = headerResumo.findIndex((h) => /respons/i.test(h));

  if (idxCliente < 0 || idxSaldo < 0) {
    console.error('Colunas esperadas não encontradas no QUADRO RESUMO.');
    process.exit(1);
  }

  // 2) Planilha1: providência e follow-up por cliente
  let planilha1Rows = [];
  const planilha1 = workbook.Sheets['Planilha1'];
  if (planilha1) {
    const p1Data = XLSX.utils.sheet_to_json(planilha1, { header: 1, defval: '' });
    const p1Header = (p1Data[0] || []).map((h) => (h || '').toString().trim());
    const ipCliente = p1Header.findIndex((h) => /cliente/i.test(h));
    const ipProv = p1Header.findIndex((h) => /providencia|providência/i.test(h) || h === 'PROVIDENCIA G');
    const ipDataP = p1Header.findIndex((h) => /data p g|data p\.? ?g/i.test(h) || h === 'DATA P G');
    const ipFu = p1Header.findIndex((h) => /^fu$|follow/i.test(h));
    const ipDataUp = p1Header.findIndex((h) => /data up/i.test(h) || h === 'DATA UP');
    for (let i = 1; i < p1Data.length; i++) {
      const row = p1Data[i];
      planilha1Rows.push({
        cliente: row[ipCliente] ? String(row[ipCliente]).trim() : '',
        providencia: ipProv >= 0 ? (row[ipProv] || '') : '',
        dataProvidencia: ipDataP >= 0 ? toISODate(row[ipDataP]) : null,
        followUp: ipFu >= 0 ? (row[ipFu] || '') : '',
        dataFollowUp: ipDataUp >= 0 ? toISODate(row[ipDataUp]) : null,
      });
    }
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 1; i < resumoData.length; i++) {
    const row = resumoData[i];
    const razaoSocial = row[idxCliente] ? String(row[idxCliente]).trim() : '';
    if (!razaoSocial) continue;

    const saldoAberto = parseValorMonetario(row[idxSaldo]);
    const classificacao = mapClassificacao(row[idxClassif]);
    const responsavel = idxResp >= 0 ? (row[idxResp] || '').toString().trim() || null : null;
    // Observações gerais (coluna "Observações" / "Observações gerais") → observacoes_gerais
    const observacoesGerais = idxObs >= 0 ? (row[idxObs] || '').toString().trim() || null : null;
    // Plano de Ação → Providência (ultima_providencia)
    const planoAcao = idxPlano >= 0 ? (row[idxPlano] || '').toString().trim() || null : null;

    const clientSheet = findClientSheet(workbook, razaoSocial);
    const dataVencimento = clientSheet ? getUltimaDataVencimentoAberto(clientSheet) : null;
    const diasEmAberto = calcularDiasEmAberto(dataVencimento);
    // Usar sempre a classificação da planilha (GRAU A/B/C) para bater com os quadros/totais
    const statusClasse = classificacao;

    const p1 = planilha1Rows.find((r) => r.cliente && (razaoSocial.toUpperCase().startsWith(r.cliente.toUpperCase()) || r.cliente.toUpperCase().startsWith(razaoSocial.split(' ')[0])));
    // Providência: preferir Planilha1 (providencia) senão Plano de Ação do QUADRO RESUMO
    const ultimaProvidencia = (p1 && p1.providencia) ? p1.providencia : planoAcao;
    const dataProvidencia = p1 && p1.dataProvidencia ? p1.dataProvidencia : null;
    const followUp = p1 && p1.followUp ? p1.followUp : null;
    const dataFollowUp = p1 && p1.dataFollowUp ? p1.dataFollowUp : null;

    const gestorEmail = mapResponsavelToEmail(responsavel);
    const valorMensalRaw = idxValorMensal >= 0 ? row[idxValorMensal] : null;
    const valorMensal = valorMensalRaw != null && valorMensalRaw !== '' ? parseValorMonetario(valorMensalRaw) : null;

    // Vincular ao cliente da base do escritório (clientes_escritorio) por razão social
    let clienteEscritorioId = null;
    const { data: ceRow } = await supabase.from('clientes_escritorio').select('id').eq('razao_social', razaoSocial.trim()).limit(1).maybeSingle();
    if (ceRow && ceRow.id) clienteEscritorioId = ceRow.id;

    const payload = {
      razao_social: razaoSocial,
      status_classe: statusClasse,
      dias_em_aberto: diasEmAberto,
      valor_em_aberto: saldoAberto,
      valor_mensal: valorMensal === 0 ? null : valorMensal,
      data_vencimento: dataVencimento,
      gestor: gestorEmail || responsavel || null,
      observacoes_gerais: observacoesGerais || null,
      ultima_providencia: ultimaProvidencia || null,
      data_providencia: dataProvidencia || null,
      follow_up: followUp || null,
      data_follow_up: dataFollowUp || null,
      cliente_escritorio_id: clienteEscritorioId,
    };

    const { data: existing } = await supabase.from('clients_inadimplencia').select('id').eq('razao_social', razaoSocial).is('resolvido_at', null).limit(1).maybeSingle();

    if (existing && existing.id) {
      const { error } = await supabase.from('clients_inadimplencia').update(payload).eq('id', existing.id);
      if (error) {
        console.error('Erro ao atualizar', razaoSocial, error.message);
        errors++;
      } else {
        updated++;
        console.log('Atualizado:', razaoSocial);
      }
    } else {
      const { error } = await supabase.from('clients_inadimplencia').insert({ ...payload, resolvido_at: null });
      if (error) {
        console.error('Erro ao inserir', razaoSocial, error.message);
        errors++;
      } else {
        inserted++;
        console.log('Inserido:', razaoSocial);
      }
    }
  }

  console.log('\n--- Resumo ---');
  console.log('Inseridos:', inserted);
  console.log('Atualizados:', updated);
  console.log('Erros:', errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
