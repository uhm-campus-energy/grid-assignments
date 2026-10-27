export const BUS_COLORS: Record<string, string> = {
  MA: '#00BCD4',
  MB: '#4CAF50',
  LA: '#FF9800',
  LB: '#F44336',
  LC: '#9C27B0',
  Null: '#9E9E9E',
};

// Ring drawn around meters whose PV exceeds their demand at any time step.
export const PV_EXCEEDS_COLOR = '#C62828';

export const BUS_OPTIONS =['MA', 'MB', 'LA', 'LB', 'LC', 'Null'];

// Substation positions on the map, from analysis.grid_map. MC is not one of
// our buses, so it is drawn grey.
export const SUBSTATIONS = [
  { name: 'MA', x: 8.6, y: 13.6 },
  { name: 'MB', x: 7.75, y: 13.6 },
  { name: 'MC', x: 1.4, y: 13.6 },
  { name: 'LA', x: 8.78, y: 1.35 },
  { name: 'LB', x: 7.88, y: 1.35 },
  { name: 'LC', x: 0.9, y: 1.35 },
];

export const IT_CENTER_X_RANGE = [1.5, 7];
export const IT_CENTER_Y_RANGE = [8, 12.5];
