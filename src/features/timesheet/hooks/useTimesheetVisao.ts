import { useQuery } from '@tanstack/react-query'
import { fetchTimesheetVisao } from '../services/timesheetService'

export function useTimesheetVisao(
  ano: number,
  areas: string[] | null,
  meses: number[] | null,
  colaborador: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['timesheet', 'visao', ano, areas, meses, colaborador],
    queryFn: () => fetchTimesheetVisao(ano, areas, meses, colaborador),
    enabled,
    staleTime: 60_000,
  })
}
