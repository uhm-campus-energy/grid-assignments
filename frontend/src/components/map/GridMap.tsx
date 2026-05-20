import { useState } from 'react';
import Plot from 'react-plotly.js';
import { PlotMouseEvent } from 'plotly.js';
import { GridAssignment } from '../../types/gridAssignment';
import { BUS_COLORS, BUS_OPTIONS } from './mapConstants';
import ReassignPanel from './ReassignPanel';

interface GridMapProps {
  data: GridAssignment[];
  scenario: string;
  showLabels?: boolean;
  sizeBy?: string;
  xRange?: [number, number];
  yRange?: [number, number];
  onReassign: (meterName: string, newBus: string) => void;
}

export default function GridMap({
  data,
  scenario,
  showLabels = false,
  sizeBy,
  xRange = [0, 15],
  yRange = [0, 15],
  onReassign,
}: GridMapProps) {
  const [selectedMeter, setSelectedMeter] = useState<GridAssignment | null>(null);

  const traces = BUS_OPTIONS.map((bus) => {
    const subset = data.filter((d) => (d.substation_meter ?? 'Null') === bus);
    const baseSize = 11;
    const sizes = sizeBy
      ? subset.map((d) => {
          const val = d[sizeBy as keyof GridAssignment];
          return typeof val === 'number' ? Math.max(8, Math.min(25, val / 5)) : baseSize;
        })
      : subset.map(() => baseSize);

    return {
      type: 'scatter' as const,
      mode: (showLabels ? 'text+markers' : 'markers') as 'text+markers' | 'markers',
      name: bus,
      x: subset.map((d) => d.node_x),
      y: subset.map((d) => d.node_y),
      marker: {
        color: BUS_COLORS[bus],
        size: sizes,
        line: { color: 'white', width: 1.5 },
      },
      text: showLabels ? subset.map((d) => d.node) : undefined,
      textposition: (showLabels ? 'top center' : undefined) as 'top center' | undefined,
      textfont: { size: 9, color: '#000' },
      customdata: subset.map((d) => [d.meter_name, d.substation_meter, d.circuit]),
      hovertemplate: '<b>%{customdata[0]}</b><br>Bus: ' + bus + '<br>Circuit: %{customdata[2]}<extra></extra>',
    };
  });

  const layout = {
    title: 'Grid Map Assignment',
    xaxis: { range: xRange, showgrid: true },
    yaxis: { range: yRange, showgrid: true },
    hovermode: 'closest' as const,
    images: [
      {
        source: '/grid_map.png',
        xref: 'x' as const,
        yref: 'y' as const,
        x: xRange[0],
        y: yRange[1],
        sizex: xRange[1] - xRange[0],
        sizey: yRange[1] - yRange[0],
        xanchor: 'left' as const,
        yanchor: 'top' as const,
        sizing: 'contain' as const,
        layer: 'below' as const,
        opacity: 1.0,
      },
    ],
  };

  const handlePlotClick = (event: Readonly<PlotMouseEvent>) => {
    if (event.points && event.points.length > 0) {
      const point = event.points[0];
      const meterName = (point.customdata as unknown as string[])[0];
      const meter = data.find((d) => d.meter_name === meterName);
      if (meter) {
        setSelectedMeter(meter);
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Plot
        data={traces}
        layout={{
          ...layout,
          width: undefined,
          height: undefined,
          autosize: true,
        }}
        config={{ displayModeBar: false, scrollZoom: false }}
        onClick={handlePlotClick}
        style={{ width: '100%', height: '100%' }}
      />
      {selectedMeter && (
        <ReassignPanel
          meter={selectedMeter}
          scenario={scenario}
          onClose={() => setSelectedMeter(null)}
          onReassign={(newBus) => {
            onReassign(selectedMeter.meter_name, newBus);
            setSelectedMeter(null);
          }}
        />
      )}
    </div>
  );
}
