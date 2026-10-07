import { useQuery } from '@tanstack/react-query'
import { fetchTimesheetVisao } from '../services/timesheetService'

export function useTimesheetVisao(
  ano: number,
  areas: string[] | null,
  meses: number[] | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['timesheet', 'visao', ano, areas, meses],
    queryFn: () => fetchTimesheetVisao(ano, areas, meses),
    enabled,
    staleTime: 60_000,
  })
}
