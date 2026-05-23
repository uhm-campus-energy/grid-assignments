import { useMemo, useRef, useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { useKwData } from '../hooks/useKwData';
import { GridAssignment } from '../types/gridAssignment';

interface Props {
  data: GridAssignment[];
  assignment: string;
  assignments: string[];
  onAssignmentChange: (v: string) => void;
}

// A point pinned by clicking a circuit chart; cleared by clicking it again.
type PinnedPoint = { x: string; demand: number; pv: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Format a raw "2026-1-1 11:45:00" datetime string as "Jan 1, 2026, 11:45"
// to match the unified-hover label. Parsed manually to avoid timezone shifts.
function formatPinnedDate(s: string): string {
  const [datePart, timePart = ''] = s.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh = '00', mm = '00'] = timePart.split(':');
  return `${MONTHS[(m || 1) - 1]} ${d}, ${y}, ${hh}:${mm}`;
}

const fmtKw = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 3 });

export default function LowLoadHighPv({ data, assignment, assignments, onAssignmentChange }: Props) {
  const { data: kwData = [], isLoading } = useKwData();
  const gridRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(300);

  // Pinned tooltip per circuit (keyed by substation). Reset when the
  // assignment changes, since the underlying time series changes too.
  const [pinned, setPinned] = useState<Record<string, PinnedPoint | null>>({});
  useEffect(() => { setPinned({}); }, [assignment]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const rows = Math.ceil(substations.length / 2) || 1;
      setChartHeight(Math.max(200, Math.floor(el.clientHeight / rows)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  // substations.length intentionally omitted — ref observation is enough
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredMeters = useMemo(() => {
    return new Set(data.filter((d) => d.assignment === assignment).map((d) => d.meter_name));
  }, [data, assignment]);

  const meterToSubstation = useMemo(() => {
    const map: Record<string, string> = {};
    data.forEach((d) => { map[d.meter_name] = d.substation_meter ?? 'Null'; });
    return map;
  }, [data]);

  const substations = useMemo(() => [...new Set(data.map((d) => d.substation_meter ?? 'Null'))].sort(), [data]);

  const substationSeries = useMemo(() => {
    const acc: Record<string, Record<string, { demand: number; pv: number }>> = {};
    substations.forEach((s) => { acc[s] = {}; });

    kwData.forEach((d) => {
      if (!filteredMeters.has(d.meter_name)) return;
      const sub = meterToSubstation[d.meter_name];
      if (!sub || !(sub in acc)) return;
      if (!acc[sub][d.datetime_str]) acc[sub][d.datetime_str] = { demand: 0, pv: 0 };
      acc[sub][d.datetime_str].demand += d.demand_kw;
      acc[sub][d.datetime_str].pv += d.pv_production_kw;
    });

    return acc;
  }, [kwData, filteredMeters, meterToSubstation, substations]);

  const styles = {
    container: { display: 'flex', height: '100%', overflow: 'hidden' },
    grid: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      overflowY: 'auto' as const,
      alignContent: 'start',
    },
    sidebar: {
      width: '250px',
      flexShrink: 0,
      padding: '20px',
      backgroundColor: '#f9f9f9',
      borderRight: '1px solid #ddd',
      overflowY: 'auto' as const,
    },
    sidebarTitle: {
      fontSize: '14px',
      fontWeight: '600' as const,
      textTransform: 'uppercase' as const,
      color: '#666',
      marginBottom: '12px',
    },
    select: {
      width: '100%',
      padding: '8px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontFamily: 'inherit',
    },
    legendSwatch: {
      display: 'inline-block',
      width: 14,
      height: 14,
      marginRight: 8,
      verticalAlign: 'middle' as const,
      flexShrink: 0,
    },
    note: { marginTop: '16px', fontSize: '12px', color: '#666', lineHeight: 1.5 },
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={{ marginBottom: '20px' }}>
          <div style={styles.sidebarTitle}>Assignments</div>
          <select
            value={assignment}
            onChange={(e) => onAssignmentChange(e.target.value)}
            style={styles.select}
          >
            {assignments.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div>
          <div style={styles.sidebarTitle}>Measure Names</div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ ...styles.legendSwatch, backgroundColor: '#5B9BD5', borderRadius: '50%', border: '1.5px solid rgba(0,0,0,0.15)' }} />
            <span style={{ fontSize: 13, color: '#333' }}>Demand KW</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ ...styles.legendSwatch, backgroundColor: '#ED7D31', borderRadius: '50%', border: '1.5px solid rgba(0,0,0,0.15)' }} />
            <span style={{ fontSize: 13, color: '#333' }}>PV Production kW</span>
          </div>
        </div>

        <div style={styles.note}>
          The low load for buildings was taken from 1/1/26.<br />
          The PV was modelled after parking phase 2 on 5/14/22 - a maximum production day.
        </div>
      </div>

      <div ref={gridRef} style={styles.grid}>
        {substations.map((sub) => {
          const times = Object.keys(substationSeries[sub]).sort();
          const demands = times.map((t) => substationSeries[sub][t].demand);
          const pvs = times.map((t) => substationSeries[sub][t].pv);

          const pin = pinned[sub] ?? null;
          const pinIdx = pin ? times.indexOf(pin.x) : -1;
          // Keep the pinned label inside the plot near the right edge.
          const pinOnRight = pinIdx > times.length * 0.6;

          return (
            <Plot
              key={sub}
              onClick={(ev) => {
                const pt = ev.points?.[0] as { pointNumber?: number; pointIndex?: number } | undefined;
                const idx = pt?.pointNumber ?? pt?.pointIndex;
                if (idx == null || idx < 0) return;
                const x = times[idx];
                setPinned((prev) => {
                  const cur = prev[sub];
                  // Click the same point again to dismiss; otherwise move the pin.
                  if (cur && cur.x === x) return { ...prev, [sub]: null };
                  return { ...prev, [sub]: { x, demand: demands[idx], pv: pvs[idx] } };
                });
              }}
              data={[
                {
                  type: 'scatter',
                  mode: 'lines',
                  fill: 'tozeroy',
                  x: times,
                  y: demands,
                  name: 'Demand KW',
                  line: { color: '#5B9BD5', width: 1 },
                  fillcolor: 'rgba(91,155,213,0.55)',
                  yaxis: 'y',
                  showlegend: false,
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  fill: 'tozeroy',
                  x: times,
                  y: pvs,
                  name: 'PV Production kW',
                  line: { color: '#ED7D31', width: 1 },
                  fillcolor: 'rgba(237,125,49,0.65)',
                  yaxis: 'y',
                  showlegend: false,
                },
              ]}
              layout={{
                title: { text: `Circuit ${sub}`, font: { size: 14 } },
                xaxis: { title: 'Time', fixedrange: true },
                // Both series share one fixed scale so PV (kW) reads correctly
                // below Demand (kW), and all circuits are directly comparable.
                yaxis: { title: 'kW', range: [0, 3000], fixedrange: true },
                dragmode: false,
                autosize: true,
                margin: { t: 40, r: 20, b: 50, l: 60 },
                hovermode: 'x unified',
                hoverlabel: { namelength: -1, font: { size: 13 } },
                shapes: pin ? [{
                  type: 'line',
                  x0: pin.x, x1: pin.x, xref: 'x',
                  y0: 0, y1: 1, yref: 'paper',
                  line: { color: '#888', width: 1, dash: 'dot' },
                }] : [],
                annotations: pin ? [{
                  x: pin.x, xref: 'x',
                  y: 1, yref: 'paper',
                  xanchor: pinOnRight ? 'right' : 'left',
                  yanchor: 'top',
                  text:
                    `${formatPinnedDate(pin.x)}<br>` +
                    `<span style="color:#5B9BD5">●</span> Demand KW : ${fmtKw(pin.demand)}<br>` +
                    `<span style="color:#ED7D31">●</span> PV Production kW : ${fmtKw(pin.pv)}`,
                  showarrow: false,
                  align: 'left',
                  bgcolor: 'rgba(255,255,255,0.95)',
                  bordercolor: '#999',
                  borderwidth: 1,
                  borderpad: 6,
                  font: { size: 12 },
                }] : [],
              }}
              config={{ displayModeBar: false, responsive: true }}
              useResizeHandler={true}
              style={{ width: '100%', height: `${chartHeight}px` }}
            />
          );
        })}
      </div>

    </div>
  );
}