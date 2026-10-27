
import GridMap from '../components/map/GridMap';
import { GridAssignment } from '../types/gridAssignment';
import { BUS_COLORS, PV_EXCEEDS_COLOR } from '../components/map/mapConstants';
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
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `2px solid ${PV_EXCEEDS_COLOR}`,
                marginRight: 8,
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: 13, color: '#333' }}>PV exceeds demand</span>
          </div>
        </div>
      </div>
      <div style={styles.mapContainer}>
        <GridMap data={data} scenario={scenario} />
      </div>
    </div>
  );
}
