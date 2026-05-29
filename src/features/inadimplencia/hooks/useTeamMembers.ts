import { useQuery } from '@tanstack/react-query'
import { teamMembersService, filterActiveTeamMembers } from '@/lib/teamMembersService'

export function useTeamMembers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['team_members'],
    queryFn: () => teamMembersService.list(),
  })
  const allMembers = data ?? []
  return {
    teamMembers: filterActiveTeamMembers(allMembers),
    allTeamMembers: allMembers,
    loading: isLoading,
    error,
  }
}
