import { useState } from 'react';
import Plot from 'react-plotly.js';
import { useKwData } from '../hooks/useKwData';

export default function PvTab() {
  const [scenario, setScenario] = useState('high');
  const { data = [], isLoading, error } = useKwData(undefined, scenario);

  if (isLoading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error loading data</div>;

  const sorted = [...data].sort((a, b) => b.pv_production_kw - a.pv_production_kw);

  const trace = {
    type: 'bar' as const,
    x: sorted.map((d) => d.meter_name),
    y: sorted.map((d) => d.pv_production_kw),
    marker: { color: '#FF9800' },
    hovertemplate: '<b>%{x}</b><br>PV: %{y} kW<extra></extra>',
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' as const }}>
      <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
        <label>
          PV Scenario:
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
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
            title: 'PV Production by Meter',
            xaxis: { title: 'Meter' },
            yaxis: { title: 'PV Production (kW)' },
            hovermode: 'x',
            autosize: true,
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
