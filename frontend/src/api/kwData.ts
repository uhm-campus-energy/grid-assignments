import api from './client';
import { KwData } from '../types/kwData';

export async function fetchKwData(
  loadScenario?: string,
  pvScenario?: string
): Promise<KwData[]> {
  const response = await api.get('/kw-data', {
    params: {
      load_scenario: loadScenario,
      pv_scenario: pvScenario,
    },
  });
  return response.data;
}
