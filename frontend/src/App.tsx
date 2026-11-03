import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe, logout, User } from './api/auth';
import LoginScreen from './components/LoginScreen';
import { useGridData, useScenarios } from './hooks/useGridData';
import GridMapAssignment from './tabs/grid-map-assignment';
import LowLoadHighPv from './tabs/low-load-high-pv';
import Compare from './tabs/compare';
import Users from './tabs/users';
import AboutData from './tabs/about-data';

// `slug` is the tab's name in the URL (?tab=pv).
const TABS = [
  { slug: 'map', name: 'Grid Map Assignment' },
  { slug: 'pv', name: 'Low Load, High PV' },
  { slug: 'compare', name: 'Compare' },
  { slug: 'about', name: 'About the Data' },
  { slug: 'users', name: 'Users', admin: true },
];

export default function App() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>
        Loading...
      </div>
    );
  }
  if (!me?.user) return <LoginScreen clientId={me?.google_client_id ?? null} />;
  return <SignedInApp user={me.user} />;
}

function SignedInApp({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const tabs = TABS.filter((t) => !t.admin || user.role === 'admin');
  // Tab and assignment start from the URL (?tab=pv&scenario=2026_04_11) and
  // are written back to it, so a refresh or a shared link opens the same view.
  const [activeTab, setActiveTab] = useState(() => {
    const slug = new URLSearchParams(window.location.search).get('tab');
    return tabs.find((t) => t.slug === slug)?.slug ?? 'map';
  });
  const [scenario, setScenario] = useState(
    () => new URLSearchParams(window.location.search).get('scenario') ?? ''
  );
  const { data: options } = useScenarios();

  // No assignment in the URL, or it's gone (deleted, or not this user's to
  // see): fall back to the first one.
  useEffect(() => {
    if (options?.length && !options.some((o) => o.key === scenario)) setScenario(options[0].key);
  }, [options, scenario]);

  useEffect(() => {
    const params = new URLSearchParams({ tab: activeTab });
    if (scenario) params.set('scenario', scenario);
    window.history.replaceState(null, '', `?${params}`);
  }, [activeTab, scenario]);

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
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 16px',
      backgroundColor: '#1565C0',
      color: '#fff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    title: {
      margin: 0,
      fontSize: '22px',
      fontWeight: 'bold' as const,
    },
    tabBar: {
      display: 'flex',
      overflowX: 'auto' as const,
      borderBottom: '1px solid #ddd',
      backgroundColor: '#fafafa',
    },
    tab: {
      padding: '8px 16px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      fontSize: '16px',
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
    if (activeTab === 'about') return <AboutData />;
    if (activeTab === 'users') {
      return (
        <Users
          onView={(key) => {
            setScenario(key);
            setActiveTab('map');
          }}
        />
      );
    }
    if (dataLoading || !scenario) {
      return <div style={styles.loading}>Loading...</div>;
    }

    switch (activeTab) {
      case 'map':
        return (
          <GridMapAssignment
            data={gridData}
            scenario={scenario}
            onScenarioChange={setScenario}
          />
        );
      case 'pv':
        return (
          <LowLoadHighPv
            data={gridData}
            assignment={scenario}
            onAssignmentChange={setScenario}
          />
        );
      case 'compare':
        return <Compare data={gridData} scenario={scenario} onScenarioChange={setScenario} />;
      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Grid Assignments</h1>
        <div>
          {user.email}{' '}
          <button onClick={() => logout().then(() => queryClient.resetQueries())}>Sign out</button>
        </div>
      </div>

      <div style={styles.tabBar}>
        {tabs.map(({ slug, name }) => (
          <button
            key={slug}
            onClick={() => setActiveTab(slug)}
            style={{
              ...styles.tab,
              ...(activeTab === slug ? styles.activeTab : styles.inactiveTab),
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
