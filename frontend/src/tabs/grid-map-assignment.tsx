
import GridMap from '../components/map/GridMap';
import { GridAssignment } from '../types/gridAssignment';
import { BUS_COLORS } from '../components/map/mapConstants';
import AssignmentSelect from '../components/AssignmentSelect';

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

        <div>
          <div style={styles.sidebarTitle}>Substation Meter</div>
          {[...new Set(data.map((d) => d.substation_meter ?? 'Null'))].sort().map((bus) => (
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
        <GridMap data={data} scenario={scenario} />
      </div>
    </div>
  );
}
