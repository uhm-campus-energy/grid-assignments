import { useMemo, useState } from 'react';
import { GridAssignment } from '../types/gridAssignment';
import AssignmentSelect, { AssignmentOptions } from '../components/AssignmentSelect';
import { BUS_COLORS, BUS_OPTIONS } from '../components/map/mapConstants';
import { useGridData, useScenarios } from '../hooks/useGridData';
import { useKwData } from '../hooks/useKwData';
import { busOf, peakSurplus, sumByBus } from '../utils/busTotals';

interface Props {
  data: GridAssignment[];
  scenario: string;
  onScenarioChange: (v: string) => void;
}

const fmtSigned = (v: number | null) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')} kW`;

const styles = {
  container: { display: 'flex', width: '100%', height: '100%' },
  sidebar: {
    width: 'clamp(150px, 20vw, 320px)',
    flexShrink: 0,
    padding: 'clamp(10px, 1.5vw, 20px)',
    backgroundColor: '#f9f9f9',
    borderLeft: '1px solid #ddd',
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
  main: { flex: 1, padding: '20px', overflow: 'auto' },
  heading: {
    fontSize: '14px',
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    color: '#666',
    margin: '0 0 8px',
  },
  table: { borderCollapse: 'collapse' as const, fontSize: '14px', marginBottom: '28px' },
  th: {
    textAlign: 'left' as const,
    padding: '8px 16px 8px 8px',
    borderBottom: '2px solid #ddd',
    color: '#666',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
  },
  td: { padding: '6px 16px 6px 8px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' as const },
  note: { fontSize: '14px', color: '#666' },
};

function Bus({ bus }: { bus: string | undefined }) {
  if (bus == null) return <span style={{ color: '#999' }}>not in it</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: BUS_COLORS[bus] ?? BUS_COLORS.Null,
          border: '1px solid rgba(0,0,0,0.15)',
        }}
      />
      {bus}
    </span>
  );
}

// Two assignments side by side: the meters whose bus differs, and what that
// does to each bus's meter count and peak PV − demand.
export default function Compare({ data, scenario, onScenarioChange }: Props) {
  const { data: options = [] } = useScenarios();
  const [picked, setPicked] = useState('');
  // Until one is picked (or if it's gone), compare with the first other one.
  const other = options.some((o) => o.key === picked)
    ? picked
    : options.find((o) => o.key !== scenario)?.key ?? '';
  const { data: otherData = [], isLoading } = useGridData(other);
  const { data: kwData = [] } = useKwData();
  const labelOf = (key: string) => options.find((o) => o.key === key)?.label ?? key;

  const { diffs, buses } = useMemo(() => {
    const busA: Record<string, string> = {};
    const busB: Record<string, string> = {};
    data.forEach((d) => { busA[d.meter_name] = busOf(d); });
    otherData.forEach((d) => { busB[d.meter_name] = busOf(d); });
    const circuit: Record<string, string> = {};
    [...data, ...otherData].forEach((d) => { circuit[d.meter_name] = d.circuit; });

    const names = [...new Set([...Object.keys(busA), ...Object.keys(busB)])].sort();
    const diffs = names
      .filter((n) => busA[n] !== busB[n])
      .map((n) => ({ name: n, circuit: circuit[n], a: busA[n], b: busB[n] }));

    const sumA = sumByBus(kwData, busA);
    const sumB = sumByBus(kwData, busB);
    const peak = (sums: typeof sumA, bus: string) =>
      bus !== 'Null' && sums[bus] ? peakSurplus(sums[bus]) : null;
    const count = (m: Record<string, string>, bus: string) => Object.values(m).filter((b) => b === bus).length;
    const buses = BUS_OPTIONS.filter((bus) => count(busA, bus) + count(busB, bus) > 0).map((bus) => ({
      bus,
      countA: count(busA, bus),
      countB: count(busB, bus),
      peakA: peak(sumA, bus),
      peakB: peak(sumB, bus),
    }));
    return { diffs, buses };
  }, [data, otherData, kwData]);

  const nameA = labelOf(scenario);
  const nameB = labelOf(other);

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={{ marginBottom: '20px' }}>
          <div style={styles.sidebarTitle}>Assignment</div>
          <AssignmentSelect value={scenario} onChange={onScenarioChange} />
        </div>
        <div>
          <label htmlFor="compare-with" style={{ ...styles.sidebarTitle, display: 'block' }}>Compare with</label>
          <select
            id="compare-with"
            value={other}
            onChange={(e) => setPicked(e.target.value)}
            style={styles.select}
            title={nameB}
          >
            <AssignmentOptions options={options} />
          </select>
        </div>
      </div>

      <div style={styles.main}>
        {isLoading || !other ? (
          <div style={styles.note}>Loading…</div>
        ) : (
          <>
            <h2 style={styles.heading}>Buses</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Bus</th>
                  <th style={styles.th}>Meters</th>
                  <th style={styles.th}>Peak PV − demand</th>
                </tr>
                <tr>
                  <th style={styles.th} />
                  <th style={{ ...styles.th, textTransform: 'none' }}>{nameA} → {nameB}</th>
                  <th style={{ ...styles.th, textTransform: 'none' }}>{nameA} → {nameB}</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b.bus}>
                    <td style={styles.td}><Bus bus={b.bus} /></td>
                    <td style={styles.td}>
                      {b.countA} → {b.countB}
                    </td>
                    <td style={{ ...styles.td, fontWeight: (b.peakB ?? 0) > 0 ? 600 : 'normal' }}>
                      {fmtSigned(b.peakA)} → {fmtSigned(b.peakB)}
                      {(b.peakB ?? 0) > 0 && (b.peakA ?? 0) <= 0 && ' · now exports'}
                      {(b.peakB ?? 0) <= 0 && (b.peakA ?? 0) > 0 && ' · no longer exports'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={styles.heading}>Meters on a different bus ({diffs.length})</h2>
            {other === scenario ? (
              <div style={styles.note}>Pick a different assignment to compare with.</div>
            ) : diffs.length === 0 ? (
              <div style={styles.note}>Both assignments put every meter on the same bus.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Meter</th>
                    <th style={styles.th}>Circuit</th>
                    <th style={{ ...styles.th, textTransform: 'none' }}>{nameA}</th>
                    <th style={{ ...styles.th, textTransform: 'none' }}>{nameB}</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map((d) => (
                    <tr key={d.name}>
                      <td style={styles.td}>{d.name}</td>
                      <td style={styles.td}>{d.circuit}</td>
                      <td style={styles.td}><Bus bus={d.a} /></td>
                      <td style={styles.td}><Bus bus={d.b} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
