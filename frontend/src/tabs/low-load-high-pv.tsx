import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useKwData } from '../hooks/useKwData';
import { GridAssignment } from '../types/gridAssignment';

interface Props {
  data: GridAssignment[];
  assignment: string;
  assignments: string[];
  onAssignmentChange: (v: string) => void;
}

export default function LowLoadHighPv({ data, assignment, assignments, onAssignmentChange }: Props) {
  const { data: kwData = [], isLoading } = useKwData();

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

      <div style={styles.grid}>
        {substations.map((sub) => {
          const times = Object.keys(substationSeries[sub]).sort();
          const demands = times.map((t) => substationSeries[sub][t].demand);
          const pvs = times.map((t) => substationSeries[sub][t].pv);

          return (
            <Plot
              key={sub}
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
                  yaxis: 'y2',
                  showlegend: false,
                },
              ]}
              layout={{
                title: { text: `Circuit ${sub}`, font: { size: 14 } },
                xaxis: { title: 'Time' },
                yaxis: { title: 'Demand KW', rangemode: 'tozero' },
                yaxis2: { title: 'PV Production kW', overlaying: 'y', side: 'right', rangemode: 'tozero' },
                autosize: true,
                margin: { t: 40, r: 60, b: 50, l: 60 },
                hovermode: 'x unified',
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '300px' }}
            />
          );
        })}
      </div>

    </div>
  );
}