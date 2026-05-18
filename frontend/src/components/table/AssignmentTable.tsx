import { useState } from 'react';
import { GridAssignment } from '../../types/gridAssignment';

interface AssignmentTableProps {
  data: GridAssignment[];
}

export default function AssignmentTable({ data }: AssignmentTableProps) {
  const [sortBy, setSortBy] = useState<string>('meter_name');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortBy as keyof GridAssignment] ?? '';
    const bVal = b[sortBy as keyof GridAssignment] ?? '';
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: string) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(true);
    }
  };

  const styles = {
    container: {
      width: '100%',
      height: '100%',
      overflow: 'auto' as const,
      padding: '16px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      borderSpacing: 0,
    },
    th: {
      padding: '12px',
      textAlign: 'left' as const,
      fontWeight: '600',
      backgroundColor: '#f5f5f5',
      borderBottom: '2px solid #ddd',
      cursor: 'pointer',
      userSelect: 'none' as const,
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #eee',
      fontSize: '14px',
    },
  };

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['meter_name', 'node', 'circuit', 'substation_meter', 'avg_kw_10_to_2'].map((key) => (
              <th
                key={key}
                onClick={() => toggleSort(key)}
                style={{
                  ...styles.th,
                  backgroundColor: sortBy === key ? '#ececec' : '#f5f5f5',
                }}
              >
                {key.replace(/_/g, ' ')} {sortBy === key && (sortAsc ? '↑' : '↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.meter_name}>
              <td style={styles.td}>{row.meter_name}</td>
              <td style={styles.td}>{row.node}</td>
              <td style={styles.td}>{row.circuit}</td>
              <td style={styles.td}>{row.substation_meter ?? 'Null'}</td>
              <td style={styles.td}>{row.avg_kw_10_to_2 ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
