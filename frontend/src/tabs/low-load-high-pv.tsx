import { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useKwData } from '../hooks/useKwData';
import { GridAssignment } from '../types/gridAssignment';

interface Props {
  data: GridAssignment[];
}

export default function LowLoadHighPv({ data }: Props) {
  const [assignmentFilter, setAssignmentFilter] = useState('(All)');
  const { data: kwData = [], isLoading } = useKwData();

  const assignments = useMemo(() => {
    const vals = [...new Set(data.map((d) => d.assignment ?? 'Null'))].sort();
    return ['(All)', ...vals];
  }, [data]);

  const filteredMeters = useMemo(() => {
    if (assignmentFilter === '(All)') return new Set(data.map((d) => d.meter_name));
    const target = assignmentFilter === 'Null' ? null : assignmentFilter;
    return new Set(data.filter((d) => (d.assignment ?? null) === target).map((d) => d.meter_name));
  }, [data, assignmentFilter]);

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
    panel: {
      width: '220px',
      flexShrink: 0,
      padding: '20px 16px',
      borderLeft: '1px solid #ddd',
      overflowY: 'auto' as const,
      fontSize: '13px',
    },
    panelTitle: { fontWeight: 600 as const, marginBottom: '8px', fontSize: '13px' },
    legendSwatch: {
      display: 'inline-block',
      width: 14,
      height: 14,
      marginRight: 8,
      verticalAlign: 'middle',
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

      <div style={styles.panel}>
        <div style={styles.panelTitle}>Assignment</div>
        {assignments.map((a) => (
          <label key={a} style={{ display: 'block', marginBottom: '6px', cursor: 'pointer' }}>
            <input
              type="radio"
              value={a}
              checked={assignmentFilter === a}
              onChange={() => setAssignmentFilter(a)}
              style={{ marginRight: '6px' }}
            />
            {a}
          </label>
        ))}

        <div style={{ ...styles.panelTitle, marginTop: '20px' }}>Measure Names</div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ ...styles.legendSwatch, backgroundColor: '#5B9BD5' }} />
          Demand KW
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ ...styles.legendSwatch, backgroundColor: '#ED7D31' }} />
          PV Production kW
        </div>

        <div style={styles.note}>
          The low load for buildings was taken from 1/1/26.<br />
          The PV was modelled after parking phase 2 on 5/14/22 - a maximum production day.
        </div>
      </div>
    </div>
  );
}