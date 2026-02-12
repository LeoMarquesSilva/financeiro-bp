import { useQuery } from '@tanstack/react-query'
import { teamMembersService } from '@/lib/teamMembersService'

export function useTeamMembers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['team_members'],
    queryFn: () => teamMembersService.list(),
  })
  return {
    teamMembers: data ?? [],
    loading: isLoading,
    error,
  }
}
