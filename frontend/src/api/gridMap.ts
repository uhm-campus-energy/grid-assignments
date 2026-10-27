import api from './client';
import { GridAssignment, ScenarioOption } from '../types/gridAssignment';

export async function fetchScenarios(): Promise<ScenarioOption[]> {
  const response = await api.get('/scenarios');
  return response.data;
}

export async function fetchGridAssignments(scenario: string): Promise<GridAssignment[]> {
  const response = await api.get('/grid-assignments', {
    params: { scenario },
  });
  return response.data;
}

// Moves every meter in meterNames to the same bus; all or nothing.
export async function updateAssignments(
  meterNames: string[],
  scenario: string,
  substationMeter: string
): Promise<unknown> {
  const response = await api.put('/assignments', {
    meter_names: meterNames,
    scenario,
    substation_meter: substationMeter,
  });
  return response.data;
}

export async function createMyAssignment(name: string, base: string): Promise<{ key: string }> {
  const response = await api.post('/my-assignments', { name, base });
  return response.data;
}

// Admins only: deletes a base assignment for everyone.
export async function deleteBaseAssignment(name: string): Promise<unknown> {
  const response = await api.delete(`/assignments/${encodeURIComponent(name)}`);
  return response.data;
}

export async function deleteMyAssignment(key: string): Promise<unknown> {
  const response = await api.delete(`/my-assignments/${key}`);
  return response.data;
}
