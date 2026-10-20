export interface GridAssignment {
  meter_name: string;
  node: string;
  node_x: number;
  node_y: number;
  x_geo: number | null;
  y_geo: number | null;
  circuit: string;
  misc: string | null;
  avg_kw_10_to_2: number | null;
  substation_meter: string | null;
  scenario: string;
  notes: string | null;
  assignment: string | null;
}

// One entry in the assignment dropdown. `key` is the base assignment's name,
// or "p:<id>" for a personal copy.
export interface ScenarioOption {
  key: string;
  label: string;
  group: 'Base' | 'Mine' | 'Others';
  editable: boolean;
}

export type BusType = 'MA' | 'MB' | 'LA' | 'LB' | 'LC' | 'Null';
