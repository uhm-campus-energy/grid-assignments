import { useQuery } from '@tanstack/react-query';
import { fetchKwData } from '../api/kwData';

export function useKwData(loadScenario?: string, pvScenario?: string) {
  return useQuery({
    queryKey: ['kw-data', loadScenario, pvScenario],
    queryFn: () => fetchKwData(loadScenario, pvScenario),
    staleTime: Infinity,
  });
}
