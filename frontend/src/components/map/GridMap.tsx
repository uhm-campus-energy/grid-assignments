import { useState } from 'react';
import Plot from 'react-plotly.js';
import { PlotMouseEvent } from 'plotly.js';
import { GridAssignment } from '../../types/gridAssignment';
import { BUS_COLORS, BUS_OPTIONS } from './mapConstants';
import ReassignPanel from './ReassignPanel';

const IMG_X0 = 0, IMG_X1 = 15;
const IMG_Y0 = 0, IMG_Y1 = 15;

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
  xRange = [IMG_X0, IMG_X1],
  yRange = [IMG_Y0, IMG_Y1],
  onReassign,
}: GridMapProps) {
  const [selectedMeter, setSelectedMeter] = useState<GridAssignment | null>(null);

  const traces = BUS_OPTIONS.map((bus) => {
    const subset = data.filter((d) => (d.substation_meter ?? 'Null') === bus);
    const baseSize = 12;
    const sizes = sizeBy
      ? subset.map((d) => {
          const val = d[sizeBy as keyof GridAssignment];
          return typeof val === 'number' ? Math.max(8, Math.min(22, val / 5)) : baseSize;
        })
      : subset.map(() => baseSize);

    return {
      type: 'scatter' as const,
      mode: (showLabels ? 'text+markers' : 'markers') as 'text+markers' | 'markers',
      name: bus,
      x: subset.map((d) => d.x_geo),
      y: subset.map((d) => d.y_geo),
      marker: {
        color: BUS_COLORS[bus],
        size: sizes,
        opacity: 1,
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
    xaxis: {
      range: xRange,
      showgrid: false,
      showticklabels: false,
      showline: false,
      zeroline: false,
    },
    yaxis: {
      range: yRange,
      showgrid: false,
      showticklabels: false,
      showline: false,
      zeroline: false,
    },
    hovermode: 'closest' as const,
    dragmode: false as const,
    showlegend: false,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    images: [
      {
        source: '/grid_map.png',
        xref: 'x' as const,
        yref: 'y' as const,
        x: IMG_X0,
        y: IMG_Y1,
        sizex: IMG_X1 - IMG_X0,
        sizey: IMG_Y1 - IMG_Y0,
        xanchor: 'left' as const,
        yanchor: 'top' as const,
        sizing: 'stretch' as const,
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
        config={{ displayModeBar: false, scrollZoom: false, responsive: true }}
        useResizeHandler={true}
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
