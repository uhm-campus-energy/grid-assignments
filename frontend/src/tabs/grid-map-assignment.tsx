import { useMemo, useState } from 'react';
import GridMap from '../components/map/GridMap';
import { GridAssignment } from '../types/gridAssignment';
import { BUS_COLORS, PV_EXCEEDS_COLOR, PV_EXCEEDS_INNER_COLOR } from '../components/map/mapConstants';
import AssignmentSelect from '../components/AssignmentSelect';
import { useKwData } from '../hooks/useKwData';
import { busOf, peakSurplus, sumByBus } from '../utils/busTotals';

interface GridMapAssignmentProps {
  data: GridAssignment[];
  scenario: string;
  onScenarioChange: (scenario: string) => void;
}

export default function GridMapAssignment({
  data,
  scenario,
  onScenarioChange,
}: GridMapAssignmentProps) {
  const { data: kwData = [] } = useKwData();
  // Meter search: the text typed, and the meter it last matched. A new object
  // per match so picking the same meter again reopens its panel.
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ name: string } | null>(null);

  // An exact name (typed, or picked from the suggestions) opens that meter;
  // Enter opens the first meter whose name contains the text.
  const search = (text: string, enter = false) => {
    const q = text.trim().toLowerCase();
    const match = data.find((d) => d.meter_name.toLowerCase() === q) ??
      (enter && q ? data.find((d) => d.meter_name.toLowerCase().includes(q)) : undefined);
    if (match) {
      setQuery(match.meter_name);
      setFound({ name: match.meter_name });
    } else if (!q) {
      setFound(null);
    }
  };

  // Per bus: how many meters, and whether the bus total has PV above demand
  // at any step (null while the time series loads, or for Null).
  const buses = useMemo(() => {
    const busByMeter: Record<string, string> = {};
    data.forEach((d) => { busByMeter[d.meter_name] = busOf(d); });
    const totals = sumByBus(kwData, busByMeter);
    return [...new Set(data.map(busOf))].sort().map((bus) => {
      const peak = bus !== 'Null' && totals[bus] ? peakSurplus(totals[bus]) : null;
      return { bus, count: data.filter((d) => busOf(d) === bus).length, exports: peak == null ? null : peak > 0 };
    });
  }, [data, kwData]);

  const styles = {
    container: {
      display: 'flex',
      width: '100%',
      height: '100%',
    },
    sidebar: {
      // Scales with the window: 20% of its width, kept between 150px and 320px.
      width: 'clamp(150px, 20vw, 320px)',
      flexShrink: 0,
      padding: 'clamp(10px, 1.5vw, 20px)',
      backgroundColor: '#f9f9f9',
      borderLeft: '1px solid #ddd',
      overflowY: 'auto' as const,
    },
    sidebarTitle: {
      fontSize: '14px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      color: '#666',
      marginBottom: '12px',
    },
    input: {
      width: '100%',
      boxSizing: 'border-box' as const,
      padding: '8px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontFamily: 'inherit',
    },
    mapContainer: {
      flex: 1,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={{ marginBottom: '20px' }}>
          <label style={styles.sidebarTitle}>Assignment</label>
          <AssignmentSelect value={scenario} onChange={onScenarioChange} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="meter-search" style={styles.sidebarTitle}>Find meter</label>
          <input
            id="meter-search"
            // Not type="search": that clears on Esc, which here closes the panel.
            type="text"
            list="meter-names"
            placeholder="Meter name"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && search(query, true)}
            style={styles.input}
          />
          <datalist id="meter-names">
            {data.map((d) => <option key={d.meter_name} value={d.meter_name} />)}
          </datalist>
          {found && data.find((d) => d.meter_name === found.name)?.x_geo == null && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#888' }}>Not on the map (no position in the data).</div>
          )}
        </div>

        <div>
          <div style={styles.sidebarTitle}>Substation Meter</div>
          {buses.map(({ bus, count, exports }) => (
            <div key={bus} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: BUS_COLORS[bus],
                  marginRight: 8,
                  flexShrink: 0,
                  border: '1.5px solid rgba(0,0,0,0.15)',
                }}
              />
              <span style={{ fontSize: 13, color: '#333' }}>{bus}</span>
              <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>({count})</span>
              {exports != null && (
                <span
                  title={exports ? 'Bus total PV exceeds demand at some time' : 'Bus total PV stays below demand'}
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 8,
                    whiteSpace: 'nowrap',
                    ...(exports
                      ? { backgroundColor: PV_EXCEEDS_COLOR, color: '#000' }
                      : { backgroundColor: '#E8F5E9', color: '#2E7D32' }),
                  }}
                >
                  {exports ? 'PV > demand' : 'OK'}
                </span>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `2px solid ${PV_EXCEEDS_COLOR}`,
                boxShadow: `inset 0 0 0 2px ${PV_EXCEEDS_INNER_COLOR}`,
                marginRight: 8,
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: 13, color: '#333' }}>PV exceeds demand</span>
          </div>
        </div>

        <p style={{ marginTop: '20px', fontSize: 13, color: '#666', lineHeight: 1.4 }}>
          Click a meter to reassign it, or drag a box to select several.
        </p>
      </div>
      <div style={styles.mapContainer}>
        <GridMap data={data} scenario={scenario} found={found} />
      </div>
    </div>
  );
}
