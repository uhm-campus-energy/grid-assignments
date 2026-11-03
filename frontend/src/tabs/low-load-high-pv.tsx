import { useMemo, useRef, useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { useKwData } from '../hooks/useKwData';
import { GridAssignment } from '../types/gridAssignment';
import AssignmentSelect from '../components/AssignmentSelect';
import { PV_EXCEEDS_COLOR } from '../components/map/mapConstants';
import { busOf, exceedRuns, fmtTime, peakSurplus, sumByBus } from '../utils/busTotals';

interface Props {
  data: GridAssignment[];
  assignment: string;
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
const fmtKwShort = (v: number) => `${Math.round(v).toLocaleString('en-US')} kW`;

// Space under each chart for its "PV exceeds demand …" line.
const SUMMARY_HEIGHT = 24;

// The line under a circuit's chart: when PV is above demand, or how close it gets.
function summaryOf(series: Parameters<typeof exceedRuns>[0]): { text: string; exceeds: boolean } {
  const runs = exceedRuns(series);
  if (runs.length === 0) {
    const peak = peakSurplus(series);
    return {
      text: peak == null ? 'No data' : `PV stays below demand · closest ${fmtKwShort(-peak)} below`,
      exceeds: false,
    };
  }
  const spans = runs.map((r) => (r.start === r.end ? fmtTime(r.start) : `${fmtTime(r.start)}–${fmtTime(r.end)}`));
  const peak = Math.max(...runs.map((r) => r.peak));
  return { text: `PV exceeds demand ${spans.join(', ')} · peak +${fmtKwShort(peak)}`, exceeds: true };
}

export default function LowLoadHighPv({ data, assignment, onAssignmentChange }: Props) {
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
      setChartHeight(Math.max(200, Math.floor(el.clientHeight / rows) - SUMMARY_HEIGHT));
    });
    obs.observe(el);
    return () => obs.disconnect();
  // substations.length intentionally omitted — ref observation is enough
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const substations = useMemo(() => [...new Set(data.map(busOf))].sort(), [data]);

  const substationSeries = useMemo(() => {
    const busByMeter: Record<string, string> = {};
    data.filter((d) => d.assignment === assignment).forEach((d) => { busByMeter[d.meter_name] = busOf(d); });
    return sumByBus(kwData, busByMeter);
  }, [kwData, data, assignment]);

  // One shared y scale for every circuit, so they compare directly, sized to
  // the largest value on any of them (rounded up to the next 500 kW). It only
  // goes below 0 for real negatives, not night-time PV readings of −0.3 kW.
  const yRange = useMemo(() => {
    const values = Object.values(substationSeries).flatMap((s) => [...s.demand, ...s.pv]);
    if (values.length === 0) return [0, 1000];
    const roundUp = (v: number) => Math.ceil(v / 500) * 500;
    const max = Math.max(500, roundUp(Math.max(...values) * 1.05));
    const min = Math.min(...values);
    return [min < -0.05 * max ? -roundUp(-min) : 0, max];
  }, [substationSeries]);

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
      // Scales with the window: 20% of its width, kept between 150px and 320px.
      width: 'clamp(150px, 20vw, 320px)',
      flexShrink: 0,
      padding: 'clamp(10px, 1.5vw, 20px)',
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
          <div style={styles.sidebarTitle}>Assignment</div>
          <AssignmentSelect value={assignment} onChange={onAssignmentChange} />
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ ...styles.legendSwatch, backgroundColor: PV_EXCEEDS_COLOR, border: '1.5px solid rgba(0,0,0,0.15)' }} />
            <span style={{ fontSize: 13, color: '#333' }}>PV exceeds demand</span>
          </div>
        </div>
      </div>

      <div ref={gridRef} style={styles.grid}>
        {substations.map((sub) => {
          const series = substationSeries[sub] ?? { times: [], demand: [], pv: [] };
          const { times, demand: demands, pv: pvs } = series;
          const summary = summaryOf(series);

          const pin = pinned[sub] ?? null;
          const pinIdx = pin ? times.indexOf(pin.x) : -1;
          // Keep the pinned label inside the plot near the right edge.
          const pinOnRight = pinIdx > times.length * 0.6;

          return (
            <div key={sub}>
              <Plot
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
                  // Shade between demand and PV where PV is above it: an invisible
                  // line along demand, then one along max(PV, demand) filled down to it.
                  {
                    type: 'scatter',
                    mode: 'lines',
                    x: times,
                    y: demands,
                    line: { width: 0 },
                    hoverinfo: 'skip',
                    showlegend: false,
                  },
                  {
                    type: 'scatter',
                    mode: 'lines',
                    fill: 'tonexty',
                    x: times,
                    y: times.map((_, i) => Math.max(pvs[i], demands[i])),
                    line: { width: 0 },
                    fillcolor: PV_EXCEEDS_COLOR,
                    hoverinfo: 'skip',
                    showlegend: false,
                  },
                ]}
                layout={{
                  title: { text: `Circuit ${sub}`, font: { size: 14 } },
                  // Outside ticks push the "0" and "00:00" labels apart at the corner.
                  xaxis: { title: 'Time', fixedrange: true, ticks: 'outside', ticklen: 6 },
                  // Both series share one scale so PV (kW) reads correctly
                  // below Demand (kW), and all circuits are directly comparable.
                  yaxis: { title: 'kW', range: yRange, fixedrange: true, ticks: 'outside', ticklen: 6 },
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
              <div
                style={{
                  height: SUMMARY_HEIGHT,
                  padding: '0 20px 0 60px',
                  fontSize: 13,
                  color: summary.exceeds ? '#000' : '#666',
                  fontWeight: summary.exceeds ? 600 : 'normal',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={summary.text}
              >
                {summary.exceeds && (
                  <span style={{ ...styles.legendSwatch, width: 10, height: 10, backgroundColor: PV_EXCEEDS_COLOR }} />
                )}
                {summary.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
