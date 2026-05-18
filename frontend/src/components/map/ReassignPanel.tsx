import { useState } from 'react';
import { GridAssignment } from '../../types/gridAssignment';
import { BUS_OPTIONS } from './mapConstants';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAssignment } from '../../api/gridMap';

interface ReassignPanelProps {
  meter: GridAssignment;
  scenario: string;
  onClose: () => void;
  onReassign: (newBus: string) => void;
}

export default function ReassignPanel({
  meter,
  scenario,
  onClose,
  onReassign,
}: ReassignPanelProps) {
  const [selected, setSelected] = useState<string>(meter.substation_meter ?? 'Null');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (bus: string) =>
      updateAssignment(meter.meter_name, scenario, bus),
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
          <div style={styles.header}>
            <h2 style={styles.title}>{meter.meter_name}</h2>
            <div style={styles.field}>
              <span style={styles.label}>Circuit</span>
              <div style={styles.value}>{meter.circuit}</div>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Current Substation Meter</label>
            <div style={styles.value}>{meter.substation_meter ?? 'Null'}</div>
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

        <div style={styles.footer}>
          <button
            onClick={() => mutation.mutate(selected)}
            disabled={mutation.isPending}
            style={{
              ...styles.button,
              ...styles.primaryBtn,
              opacity: mutation.isPending ? 0.6 : 1,
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
