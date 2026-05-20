
import GridMap from '../components/map/GridMap';
import { GridAssignment } from '../types/gridAssignment';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAssignment } from '../api/gridMap';
import { BUS_COLORS, BUS_OPTIONS } from '../components/map/mapConstants';

interface GridMapAssignmentProps {
  data: GridAssignment[];
  scenario: string;
  onScenarioChange: (scenario: string) => void;
  scenarios: string[];
}

export default function GridMapAssignment({
  data,
  scenario,
  onScenarioChange,
  scenarios,
}: GridMapAssignmentProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (vars: { meterName: string; newBus: string }) =>
      updateAssignment(vars.meterName, scenario, vars.newBus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grid-assignments'] });
    },
  });

  const styles = {
    container: {
      display: 'flex',
      width: '100%',
      height: '100%',
    },
    sidebar: {
      width: '250px',
      padding: '20px',
      backgroundColor: '#f9f9f9',
      borderRight: '1px solid #ddd',
      overflowY: 'auto' as const,
    },
    sidebarTitle: {
      fontSize: '14px',
      fontWeight: '600',
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
    mapContainer: {
      flex: 1,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={{ marginBottom: '20px' }}>
          <label style={styles.sidebarTitle}>Scenario</label>
          <select
            value={scenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            style={styles.select}
          >
            {scenarios.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={styles.sidebarTitle}>Bus Assignment</div>
          {BUS_OPTIONS.map((bus) => (
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
            </div>
          ))}
        </div>
      </div>
      <div style={styles.mapContainer}>
        <GridMap
          data={data}
          scenario={scenario}
          onReassign={(meterName, newBus) => {
            mutation.mutate({ meterName, newBus });
          }}
        />
      </div>
    </div>
  );
}
