import { useMemo, useState } from 'react';
import { GridAssignment } from '../../types/gridAssignment';
import { BUS_OPTIONS } from './mapConstants';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAssignments } from '../../api/gridMap';
import { useKwData } from '../../hooks/useKwData';
import { useScenarios } from '../../hooks/useGridData';
import { useMe } from '../../api/auth';

const fmtKw = (v: number | null) =>
  v == null ? '—' : `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })} kW`;

const busOf = (m: GridAssignment) => m.substation_meter ?? 'Null';

interface ReassignPanelProps {
  meters: GridAssignment[];
  scenario: string;
  onClose: () => void;
  onReassign: (newBus: string) => void;
}

export default function ReassignPanel({
  meters,
  scenario,
  onClose,
  onReassign,
}: ReassignPanelProps) {
  const meter = meters[0];
  const many = meters.length > 1;
  const [selected, setSelected] = useState<string>(busOf(meter));
  const unchanged = meters.every((m) => busOf(m) === selected);
  const queryClient = useQueryClient();
  const { data: kwData = [], isLoading: kwLoading } = useKwData();
  const current = useScenarios().data?.find((o) => o.key === scenario);
  const editable = current?.editable ?? false;
  const inactive = useMe().data?.user?.inactive ?? false;

  // PV has no precomputed 10am–2pm average (only demand's avg_kw_10_to_2 exists),
  // so derive it from the meters' time series over the same 10:00–14:00 window,
  // summed across the meters.
  const avgPv10to2 = useMemo(() => {
    const names = new Set(meters.map((m) => m.meter_name));
    const inWindow = kwData.filter((d) => {
      if (!names.has(d.meter_name)) return false;
      const hour = parseInt((d.datetime_str.split(' ')[1] ?? '').slice(0, 2), 10);
      return hour >= 10 && hour < 14;
    });
    if (inWindow.length === 0) return null;
    const steps = new Set(inWindow.map((d) => d.datetime_str)).size;
    return inWindow.reduce((s, d) => s + (d.pv_production_kw || 0), 0) / steps;
  }, [kwData, meters]);
  const avgDemand = meters.some((m) => m.avg_kw_10_to_2 != null)
    ? meters.reduce((s, m) => s + (m.avg_kw_10_to_2 ?? 0), 0)
    : null;
  const total = many ? 'Total ' : '';

  const mutation = useMutation({
    mutationFn: (bus: string) =>
      updateAssignments(meters.map((m) => m.meter_name), scenario, bus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grid-assignments'] });
      onReassign(selected);
    },
  });

  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 1000,
    },
    drawer: {
      backgroundColor: '#fff',
      width: '350px',
      height: '100%',
      padding: '24px',
      boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between',
    },
    header: {
      borderBottom: '1px solid #e0e0e0',
      marginBottom: '16px',
      paddingBottom: '16px',
    },
    title: {
      fontSize: '18px',
      fontWeight: 'bold',
      margin: '0 0 8px 0',
    },
    field: {
      marginBottom: '16px',
    },
    label: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#666',
      textTransform: 'uppercase' as const,
      marginBottom: '4px',
      display: 'block',
    },
    value: {
      fontSize: '14px',
      margin: '4px 0',
    },
    select: {
      width: '100%',
      padding: '8px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontFamily: 'inherit',
    },
    footer: {
      display: 'flex',
      gap: '8px',
      borderTop: '1px solid #e0e0e0',
      paddingTop: '16px',
    },
    button: {
      flex: 1,
      padding: '10px',
      fontSize: '14px',
      fontWeight: '600',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    primaryBtn: {
      backgroundColor: '#1565C0',
      color: '#fff',
    },
    secondaryBtn: {
      backgroundColor: '#f0f0f0',
      color: '#333',
    },
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div>
          {many ? (
            <div style={styles.header}>
              <h2 style={styles.title}>{meters.length} meters</h2>
              <span style={styles.label}>Meter · current substation meter</span>
              <div style={{ maxHeight: '30vh', overflowY: 'auto' }}>
                {meters.map((m) => (
                  <div key={m.meter_name} style={styles.value}>
                    {m.meter_name} · {busOf(m)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={styles.header}>
                <h2 style={styles.title}>{meter.meter_name}</h2>
                <div style={styles.field}>
                  <span style={styles.label}>Circuit</span>
                  <div style={styles.value}>{meter.circuit}</div>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Current Substation Meter</label>
                <div style={styles.value}>{busOf(meter)}</div>
              </div>
            </>
          )}

          <div style={styles.field}>
            <label style={styles.label}>{total}Avg Demand (10am–2pm)</label>
            <div style={styles.value}>{fmtKw(avgDemand)}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{total}Avg PV Production (10am–2pm)</label>
            <div style={styles.value}>{kwLoading ? 'Loading…' : fmtKw(avgPv10to2)}</div>
          </div>

          <div style={styles.field}>
            <label htmlFor="bus-select" style={styles.label}>
              New Substation Meter
            </label>
            <select
              id="bus-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={styles.select}
            >
              {BUS_OPTIONS.map((bus) => (
                <option key={bus} value={bus}>
                  {bus}
                </option>
              ))}
            </select>
          </div>
        </div>

        {current && !editable && (
          <p style={styles.value}>
            {inactive
              ? 'Your account is view-only.'
              : current.group === 'Base'
              ? 'Only admins can change base assignments. Use "Make my own copy" to edit your own version.'
              : 'Only the owner can change this assignment.'}
          </p>
        )}
        {mutation.isError && <p style={{ ...styles.value, color: '#c62828' }}>Save failed: {mutation.error.message}</p>}
        <div style={styles.footer}>
          <button
            onClick={() => mutation.mutate(selected)}
            disabled={mutation.isPending || !editable || unchanged}
            style={{
              ...styles.button,
              ...styles.primaryBtn,
              opacity: mutation.isPending || !editable || unchanged ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            style={{ ...styles.button, ...styles.secondaryBtn }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
