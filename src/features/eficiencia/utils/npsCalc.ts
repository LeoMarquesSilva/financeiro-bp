/** NPS clássico do OrqestrAI (Meus Clientes) — % promotores − % detratores. */

export type NpsCampaignStatus = 'draft' | 'active' | 'closed'

export type NpsCampaignRef = {
  id: string
  name: string
  status: NpsCampaignStatus
  startsAt: string | null
}

export type NpsScoreSummary = {
  total: number
  promoters: number
  passives: number
  detractors: number
  /** −100 a 100. null se não houver respostas. */
  nps: number | null
}

export type NpsDimensionAverages = {
  recommend: number | null
  availability: number | null
  communication: number | null
  innovation: number | null
  technical: number | null
}

export type NpsKpi = NpsScoreSummary & {
  campaignId: string | null
  campaignName: string | null
  campaignStatus: NpsCampaignStatus | null
  dimensions: NpsDimensionAverages
  unavailable?: boolean
}

export const EMPTY_NPS_KPI: NpsKpi = {
  total: 0,
  promoters: 0,
  passives: 0,
  detractors: 0,
  nps: null,
  campaignId: null,
  campaignName: null,
  campaignStatus: null,
  dimensions: {
    recommend: null,
    availability: null,
    communication: null,
    innovation: null,
    technical: null,
  },
}

export function classifyNpsScore(score: number): 'promoter' | 'passive' | 'detractor' {
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'passive'
  return 'detractor'
}

export function computeNpsSummary(recommendScores: number[]): NpsScoreSummary {
  const total = recommendScores.length
  if (total === 0) {
    return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: null }
  }

  let promoters = 0
  let passives = 0
  let detractors = 0
  for (const score of recommendScores) {
    const bucket = classifyNpsScore(score)
    if (bucket === 'promoter') promoters += 1
    else if (bucket === 'passive') passives += 1
    else detractors += 1
  }

  return {
    total,
    promoters,
    passives,
    detractors,
    nps: Math.round(((promoters - detractors) / total) * 100),
  }
}

export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null
  const sum = scores.reduce((acc, n) => acc + n, 0)
  return Math.round((sum / scores.length) * 10) / 10
}

export function computeDimensionAverages(
  responses: Array<{
    scoreRecommend: number
    scoreAvailability: number
    scoreCommunication: number
    scoreInnovation: number
    scoreTechnical: number
  }>,
): NpsDimensionAverages {
  return {
    recommend: averageScore(responses.map((r) => r.scoreRecommend)),
    availability: averageScore(responses.map((r) => r.scoreAvailability)),
    communication: averageScore(responses.map((r) => r.scoreCommunication)),
    innovation: averageScore(responses.map((r) => r.scoreInnovation)),
    technical: averageScore(responses.map((r) => r.scoreTechnical)),
  }
}

/** Campanha do ano — avaliação única, sem série mensal. */
export function pickNpsCampaignForYear<T extends NpsCampaignRef>(
  campaigns: T[],
  ano: number,
): T | null {
  const yearStr = String(ano)
  const matching = campaigns.filter((campaign) => {
    if (campaign.name.includes(yearStr)) return true
    if (!campaign.startsAt) return false
    const year = new Date(campaign.startsAt).getUTCFullYear()
    return year === ano
  })
  return matching.find((c) => c.status === 'active') ?? matching[0] ?? null
}

export function npsZona(nps: number | null): string | null {
  if (nps == null) return null
  if (nps >= 75) return 'Zona de Excelência'
  if (nps >= 50) return 'Zona de Qualidade'
  if (nps >= 0) return 'Zona de Aperfeiçoamento'
  return 'Zona Crítica'
}
