import { useState } from 'react';
import Plot from 'react-plotly.js';
import { useKwData } from '../hooks/useKwData';

export default function LowLoadHighPvTab() {
  const [loadScenario, setLoadScenario] = useState('2026_04_23');
  const [pvScenario, setPvScenario] = useState('high');
  const { data = [], isLoading, error } = useKwData(loadScenario, pvScenario);

  if (isLoading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error loading data</div>;

  const trace = {
    type: 'scatter' as const,
    mode: 'markers' as const,
    x: data.map((d) => d.demand_kw),
    y: data.map((d) => d.pv_production_kw),
    marker: {
      size: 8,
      color: '#1565C0',
    },
    text: data.map((d) => d.meter_name),
    hovertemplate: '<b>%{text}</b><br>Demand: %{x} kW<br>PV: %{y} kW<extra></extra>',
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' as const }}>
      <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
        <label style={{ marginRight: '16px' }}>
          Load Scenario:
          <select
            value={loadScenario}
            onChange={(e) => setLoadScenario(e.target.value)}
            style={{ marginLeft: '8px', padding: '4px' }}
          >
            <option value="2026_04_23">2026_04_23</option>
            <option value="2026_04_11">2026_04_11</option>
          </select>
        </label>
        <label>
          PV Scenario:
          <select
            value={pvScenario}
            onChange={(e) => setPvScenario(e.target.value)}
            style={{ marginLeft: '8px', padding: '4px' }}
          >
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>
      <div style={{ flex: 1 }}>
        <Plot
          data={[trace]}
          layout={{
            title: 'Demand KW vs PV Production KW',
            xaxis: { title: 'Demand (kW)' },
            yaxis: { title: 'PV Production (kW)' },
            hovermode: 'closest',
            autosize: true,
          }}
          config={{ displayModeBar: false }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
