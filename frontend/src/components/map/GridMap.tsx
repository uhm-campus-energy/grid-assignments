import { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { PlotMouseEvent, PlotSelectionEvent } from 'plotly.js';
import { GridAssignment } from '../../types/gridAssignment';
import { BUS_COLORS, BUS_OPTIONS, PV_EXCEEDS_COLOR } from './mapConstants';
import { useKwData } from '../../hooks/useKwData';
import ReassignPanel from './ReassignPanel';

const IMG_X0 = 0, IMG_X1 = 15;
const IMG_Y0 = 0, IMG_Y1 = 15;

const fmtKw = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })} kW`;

interface GridMapProps {
  data: GridAssignment[];
  scenario: string;
  showLabels?: boolean;
  sizeBy?: string;
  xRange?: [number, number];
  yRange?: [number, number];
}

export default function GridMap({
  data,
  scenario,
  showLabels = false,
  sizeBy,
  xRange = [IMG_X0, IMG_X1],
  yRange = [IMG_Y0, IMG_Y1],
}: GridMapProps) {
  // Meters picked for a bulk reassign (box-drag adds, click toggles), and the
  // meters the reassign panel is open for.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelMeters, setPanelMeters] = useState<GridAssignment[] | null>(null);
  const { data: kwData = [] } = useKwData();

  // Average PV production per meter over the 10:00–14:00 window, to mirror the
  // demand's precomputed avg_kw_10_to_2 (PV has no equivalent precomputed field).
  // Also collects meters whose PV is above their demand at any 15-minute step.
  const { avgPvByMeter, pvExceeds } = useMemo(() => {
    const acc: Record<string, { sum: number; count: number }> = {};
    const exceeds = new Set<string>();
    kwData.forEach((d) => {
      if ((d.pv_production_kw || 0) > (d.demand_kw || 0)) exceeds.add(d.meter_name);
      const hour = parseInt((d.datetime_str.split(' ')[1] ?? '').slice(0, 2), 10);
      if (hour < 10 || hour >= 14) return;
      if (!acc[d.meter_name]) acc[d.meter_name] = { sum: 0, count: 0 };
      acc[d.meter_name].sum += d.pv_production_kw || 0;
      acc[d.meter_name].count += 1;
    });
    const map: Record<string, number> = {};
    Object.entries(acc).forEach(([m, { sum, count }]) => { map[m] = count ? sum / count : 0; });
    return { avgPvByMeter: map, pvExceeds: exceeds };
  }, [kwData]);

  const exceeding = data.filter((d) => pvExceeds.has(d.meter_name));
  const ringTrace = {
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: 'PV exceeds demand',
    x: exceeding.map((d) => d.x_geo),
    y: exceeding.map((d) => d.y_geo),
    // Same size as the meter dot so the ring sits on its edge, over the white outline.
    marker: { symbol: 'circle-open', size: 12, color: PV_EXCEEDS_COLOR, line: { width: 2 } },
    // Skip so hover and clicks fall through to the meter dot underneath.
    hoverinfo: 'skip' as const,
    unselected: { marker: { opacity: 1 } },
  };

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
      // Driven from state so the dimming survives re-renders; undefined = no selection.
      selectedpoints: selected.size
        ? subset.flatMap((d, i) => (selected.has(d.meter_name) ? [i] : []))
        : undefined,
      customdata: subset.map((d) => [
        d.meter_name,
        d.substation_meter,
        d.circuit,
        fmtKw(d.avg_kw_10_to_2),
        fmtKw(avgPvByMeter[d.meter_name]),
        pvExceeds.has(d.meter_name) ? '<br><b>PV exceeds demand at some time</b>' : '',
      ]),
      hovertemplate:
        '<b>%{customdata[0]}</b><br>' +
        'Substation Meter: ' + bus + '<br>' +
        'Circuit: %{customdata[2]}<br>' +
        'Avg Demand (10am–2pm): %{customdata[3]}<br>' +
        'Avg PV Production (10am–2pm): %{customdata[4]}' +
        '%{customdata[5]}' +
        '<extra></extra>',
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
    dragmode: 'select' as const,
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

  // Meter name of a clicked/selected point; undefined for the ring trace.
  const nameOf = (p: { customdata?: unknown }) => (p.customdata as string[] | undefined)?.[0];

  // No selection: a click opens the panel for that meter. With a selection, a
  // click adds or removes the meter instead.
  const handlePlotClick = (event: Readonly<PlotMouseEvent>) => {
    const name = event.points?.[0] && nameOf(event.points[0]);
    if (!name) return;
    if (selected.size === 0) {
      const meter = data.find((d) => d.meter_name === name);
      if (meter) setPanelMeters([meter]);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  };

  // Each box-drag adds to the selection; double-click (onDeselect) clears it.
  const handleSelected = (event?: Readonly<PlotSelectionEvent>) => {
    const names = (event?.points ?? []).map(nameOf).filter((n): n is string => !!n);
    if (names.length) setSelected((prev) => new Set([...prev, ...names]));
  };

  const barBtn = {
    padding: '4px 10px',
    fontSize: '13px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Plot
        data={[...traces, ringTrace]}
        layout={{
          ...layout,
          width: undefined,
          height: undefined,
          autosize: true,
        }}
        config={{ displayModeBar: false, scrollZoom: false, responsive: true }}
        useResizeHandler={true}
        onClick={handlePlotClick}
        onSelected={handleSelected}
        onDeselect={() => setSelected(new Set())}
        style={{ width: '100%', height: '100%' }}
      />
      {selected.size > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            fontSize: '13px',
            backgroundColor: 'rgba(255,255,255,0.92)',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        >
          <span>{selected.size} selected · click to add/remove</span>
          <button
            style={{ ...barBtn, backgroundColor: '#1565C0', color: '#fff', border: 'none' }}
            onClick={() => setPanelMeters(data.filter((d) => selected.has(d.meter_name)))}
          >
            Reassign…
          </button>
          <button style={barBtn} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}
      {panelMeters && (
        <ReassignPanel
          meters={panelMeters}
          scenario={scenario}
          onClose={() => setPanelMeters(null)}
          onReassign={() => {
            setPanelMeters(null);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
