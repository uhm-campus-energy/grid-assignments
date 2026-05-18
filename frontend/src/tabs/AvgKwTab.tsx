
import Plot from 'react-plotly.js';
import { GridAssignment } from '../types/gridAssignment';

interface AvgKwTabProps {
  data: GridAssignment[];
}

export default function AvgKwTab({ data }: AvgKwTabProps) {
  const sorted = [...data]
    .filter((d) => d.avg_kw_10_to_2 !== null)
    .sort((a, b) => (b.avg_kw_10_to_2 ?? 0) - (a.avg_kw_10_to_2 ?? 0));

  const trace = {
    type: 'bar' as const,
    x: sorted.map((d) => d.meter_name),
    y: sorted.map((d) => d.avg_kw_10_to_2),
    marker: { color: '#4CAF50' },
    hovertemplate: '<b>%{x}</b><br>Avg kW: %{y}<extra></extra>',
  };

  return (
    <Plot
      data={[trace]}
      layout={{
        title: "Average kW New Year's Day 10am-2pm",
        xaxis: { title: 'Meter' },
        yaxis: { title: 'Average kW' },
        hovermode: 'x',
        autosize: true,
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
