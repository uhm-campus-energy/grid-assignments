import { useState } from 'react';
import { useScenarios, useGridData } from './hooks/useGridData';
import GridMapAssignment from './tabs/grid-map-assignment';
import LowLoadHighPv from './tabs/low-load-high-pv';

const TAB_NAMES = ['Grid Map Assignment', 'Low Load, High PV'];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [scenario, setScenario] = useState('2026_04_11');

  const { data: scenarios = [] } = useScenarios();
  const { data: gridData = [], isLoading: dataLoading } = useGridData(scenario);

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#fff',
    },
    header: {
      padding: '16px',
      backgroundColor: '#1565C0',
      color: '#fff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    title: {
      margin: 0,
      fontSize: '36px',
      fontWeight: 'bold',
    },
    tabBar: {
      display: 'flex',
      overflowX: 'auto' as const,
      borderBottom: '1px solid #ddd',
      backgroundColor: '#fafafa',
    },
    tab: {
      padding: '12px 16px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      fontSize: '24px',
      whiteSpace: 'nowrap' as const,
      fontFamily: 'inherit',
    },
    activeTab: {
      color: '#1565C0',
      fontWeight: '600' as const,
    },
    inactiveTab: {
      color: '#666',
      fontWeight: 'normal' as const,
    },
    content: {
      flex: 1,
      overflow: 'hidden',
    },
    loading: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      color: '#999',
    },
  };

  const renderTab = () => {
    if (dataLoading) {
      return <div style={styles.loading}>Loading...</div>;
    }

    switch (activeTab) {
      case 0:
        return (
          <GridMapAssignment
            data={gridData}
            scenario={scenario}
            onScenarioChange={setScenario}
            scenarios={scenarios}
          />
        );
      case 1:
        return (
          <LowLoadHighPv
            data={gridData}
            assignment={scenario}
            assignments={scenarios}
            onAssignmentChange={setScenario}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Grid Assignments</h1>
      </div>

      <div style={styles.tabBar}>
        {TAB_NAMES.map((name, idx) => (
          <button
            key={idx}
            onClick={() => setActiveTab(idx)}
            style={{
              ...styles.tab,
              ...(activeTab === idx ? styles.activeTab : styles.inactiveTab),
            }}
          >
            {name}
          </button>
        ))}
      </div>

      <div style={styles.content}>{renderTab()}</div>
    </div>
  );
}