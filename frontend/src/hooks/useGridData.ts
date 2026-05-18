import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGridAssignments, fetchScenarios } from '../api/gridMap';

export function useScenarios() {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: fetchScenarios,
    staleTime: 60_000,
  });
}

export function useGridData(scenario: string) {
  return useQuery({
    queryKey: ['grid-assignments', scenario],
    queryFn: () => fetchGridAssignments(scenario),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}

export { useQueryClient };
