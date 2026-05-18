import api from './client';
import { GridAssignment } from '../types/gridAssignment';

export async function fetchScenarios(): Promise<string[]> {
  const response = await api.get('/scenarios');
  return response.data;
}

export async function fetchGridAssignments(scenario: string): Promise<GridAssignment[]> {
  const response = await api.get('/grid-assignments', {
    params: { scenario },
  });
  return response.data;
}

export async function updateAssignment(
  meterName: string,
  scenario: string,
  substationMeter: string
): Promise<unknown> {
  const response = await api.put(`/assignments/${meterName}`, {
    scenario,
    substation_meter: substationMeter,
  });
  return response.data;
}
