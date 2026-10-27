export const BUS_COLORS: Record<string, string> = {
  MA: '#00BCD4',
  MB: '#4CAF50',
  // Brown-orange: dark so the yellow PV-exceeds ring stands out, and well
  // apart from LB's bright red.
  LA: '#8B4513',
  LB: '#D50000',
  LC: '#9C27B0',
  Null: '#9E9E9E',
};

// Rings drawn around meters whose PV exceeds their demand at any time step:
// a black ring on the dot's edge with a yellow ring just outside it.
export const PV_EXCEEDS_COLOR = '#FFD600';
export const PV_EXCEEDS_INNER_COLOR = '#000';

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
