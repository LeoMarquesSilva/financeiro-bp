const MESES_LABEL = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, 'março': 3,
  abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7,
  ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10,
  nov: 11, novembro: 11, dez: 12, dezembro: 12,
}

function parseValorMonetario(val) {
  if (val == null || val === '') return 0
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  const s = String(val).trim()
  if (!s) return 0
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : parsed
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function resolveMes(value) {
  if (typeof value === 'number' && value >= 1 && value <= 12) return Math.trunc(value)
  const s = normalizeHeader(value)
  if (!s) return null
  const n = Number(s)
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n
  return MESES_LABEL[s] ?? null
}

function findColumnIndex(headers, aliases) {
  return headers.findIndex((h) => aliases.some((a) => h === a || h.includes(a)))
}

function parseOrcamentoRows(rows, defaultAno) {
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const h = normalizeHeader(cell)
      return h.includes('grupo') || h.includes('plano') || h === 'mes' || h === 'jan'
    }),
  )
  const headerIndex = headerRowIndex >= 0 ? headerRowIndex : 0
  const headers = (rows[headerIndex] ?? []).map(normalizeHeader)
  const linhas = []

  const wideMonthCols = headers
    .map((h, idx) => ({ idx, mes: MESES_LABEL[h] ?? null }))
    .filter((c) => c.mes != null)

  if (wideMonthCols.length >= 3) {
    const idxGrupo = findColumnIndex(headers, ['grupo macro', 'grupo_conta', 'grupo'])
    const idxPlano = findColumnIndex(headers, ['plano minimo', 'plano mínimo', 'plano_contas', 'plano'])
    const idxConta = findColumnIndex(headers, ['no conta', 'nº conta', 'conta_numero'])
    const idxTitulo = findColumnIndex(headers, ['titulo', 'título', 'titulo_ref', 'referencia'])
    const idxDesc = findColumnIndex(headers, ['descricao', 'descrição'])

    for (let r = headerIndex + 1; r < rows.length; r++) {
      const row = rows[r] ?? []
      const grupo = String(row[idxGrupo >= 0 ? idxGrupo : 0] ?? '').trim()
      const plano = String(row[idxPlano >= 0 ? idxPlano : 1] ?? '').trim()
      if (!grupo && !plano) continue
      for (const col of wideMonthCols) {
        const valor = parseValorMonetario(row[col.idx])
        if (valor <= 0) continue
        linhas.push({
          mes: col.mes,
          grupo_conta: grupo || 'Sem grupo',
          plano_contas: plano || 'Sem plano',
          conta_numero: idxConta >= 0 ? String(row[idxConta] ?? '').trim() : '',
          titulo_ref: idxTitulo >= 0 ? String(row[idxTitulo] ?? '').trim() : '—',
          descricao: idxDesc >= 0 ? String(row[idxDesc] ?? '').trim() : '',
          valor,
        })
      }
    }
  } else {
    const idxMes = findColumnIndex(headers, ['mes', 'mês'])
    const idxGrupo = findColumnIndex(headers, ['grupo macro', 'grupo_conta', 'grupo'])
    const idxPlano = findColumnIndex(headers, ['plano minimo', 'plano mínimo', 'plano_contas', 'plano'])
    const idxConta = findColumnIndex(headers, ['no conta', 'nº conta', 'conta_numero'])
    const idxTitulo = findColumnIndex(headers, ['titulo', 'título', 'titulo_ref'])
    const idxDesc = findColumnIndex(headers, ['descricao', 'descrição'])
    const idxValor = findColumnIndex(headers, ['valor', 'previsto', 'orcamento', 'orçamento'])

    for (let r = headerIndex + 1; r < rows.length; r++) {
      const row = rows[r] ?? []
      const mes = resolveMes(idxMes >= 0 ? row[idxMes] : null)
      const valor = parseValorMonetario(idxValor >= 0 ? row[idxValor] : null)
      const grupo = String(row[idxGrupo >= 0 ? idxGrupo : 0] ?? '').trim()
      const plano = String(row[idxPlano >= 0 ? idxPlano : 1] ?? '').trim()
      if (!mes || valor <= 0 || (!grupo && !plano)) continue
      linhas.push({
        mes,
        grupo_conta: grupo || 'Sem grupo',
        plano_contas: plano || 'Sem plano',
        conta_numero: idxConta >= 0 ? String(row[idxConta] ?? '').trim() : '',
        titulo_ref: idxTitulo >= 0 ? String(row[idxTitulo] ?? '').trim() : '—',
        descricao: idxDesc >= 0 ? String(row[idxDesc] ?? '').trim() : '',
        valor,
      })
    }
  }

  const totaisPorMes = {}
  let totalGeral = 0
  for (const l of linhas) {
    totaisPorMes[l.mes] = (totaisPorMes[l.mes] ?? 0) + l.valor
    totalGeral += l.valor
  }

  return { linhas, totaisPorMes, totalGeral: Math.round(totalGeral * 100) / 100 }
}

function replicateLinhasMeses(linhas, meses) {
  const out = []
  for (let mes = 1; mes <= meses; mes++) {
    for (const l of linhas) {
      out.push({ ...l, mes })
    }
  }
  const totaisPorMes = {}
  let totalGeral = 0
  for (const l of out) {
    totaisPorMes[l.mes] = (totaisPorMes[l.mes] ?? 0) + l.valor
    totalGeral += l.valor
  }
  return { linhas: out, totaisPorMes, totalGeral: Math.round(totalGeral * 100) / 100 }
}

/** Parser para export SIOE (aba Detalhado do drill-down OPEX). */
function parseOrcamentoExportDetalhado(rows, defaultAno, replicarMeses = 12) {
  const header = (rows[0] ?? []).map((h) => normalizeHeader(h))
  const col = (keys) => header.findIndex((h) => keys.some((k) => h.includes(k)))
  const iGrupo = col(['grupo macro', 'grupo'])
  const iPlano = col(['plano m'])
  const iConta = col(['conta'])
  const iTitulo = col(['nº título', 'no titulo', 'nro'])
  const iCiItem = col(['ci item'])
  const iDesc = col(['descri'])
  const iForn = col(['fornecedor'])
  const iDept = col(['departamento', 'depto'])
  const iPrev = col(['previsto'])

  const base = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const grupo = String(row[iGrupo] ?? '').trim()
    if (!grupo || grupo.toUpperCase() === 'TOTAL') continue
    const valor = parseValorMonetario(row[iPrev])
    if (valor <= 0) continue
    const ciItem = String(row[iCiItem] ?? '').trim()
    const nroTitulo = String(row[iTitulo] ?? '').trim()
    const desc = String(row[iDesc] ?? '').trim()
    const forn = String(row[iForn] ?? '').trim()
    base.push({
      mes: 1,
      grupo_conta: grupo,
      plano_contas: String(row[iPlano] ?? '').trim() || 'Sem plano',
      conta_numero: String(row[iConta] ?? '').trim(),
      titulo_ref: nroTitulo && nroTitulo !== '—' ? nroTitulo : ciItem ? `CI ${ciItem}` : desc || '—',
      descricao: [desc && desc !== 'Sem descrição' ? desc : '', forn && forn !== '—' ? forn : '']
        .filter(Boolean)
        .join(' · '),
      departamento: iDept >= 0 ? String(row[iDept] ?? '').trim() : '',
      valor,
    })
  }

  if (replicarMeses > 1) {
    return replicateLinhasMeses(base.map(({ mes: _m, ...rest }) => rest), replicarMeses)
  }

  const totaisPorMes = {}
  let totalGeral = 0
  for (const l of base) {
    totaisPorMes[l.mes] = (totaisPorMes[l.mes] ?? 0) + l.valor
    totalGeral += l.valor
  }
  return { linhas: base, totaisPorMes, totalGeral: Math.round(totalGeral * 100) / 100 }
}

module.exports = { parseOrcamentoRows, parseOrcamentoExportDetalhado, replicateLinhasMeses, parseValorMonetario }
