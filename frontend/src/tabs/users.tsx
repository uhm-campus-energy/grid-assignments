import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ManagedUser, deleteUser, fetchUsers, setInactive } from '../api/users';

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');

const errorText = (e: unknown) =>
  isAxiosError(e) ? e.response?.data?.detail ?? e.message : String(e);

const styles = {
  container: { padding: '20px', overflow: 'auto', height: '100%' },
  table: { borderCollapse: 'collapse' as const, width: '100%', fontSize: '14px' },
  th: {
    textAlign: 'left' as const,
    padding: '8px',
    borderBottom: '2px solid #ddd',
    color: '#666',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
  },
  td: { padding: '8px', borderBottom: '1px solid #eee', verticalAlign: 'top' as const },
  button: { padding: '4px 8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', marginRight: '6px' },
  link: {
    display: 'block',
    padding: 0,
    border: 'none',
    background: 'none',
    color: '#1565C0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    textAlign: 'left' as const,
  },
  error: { color: '#c62828', marginBottom: '12px' },
};

// Host-only: everyone who has signed in, their personal assignments, and
// active/inactive (view-only) and delete controls.
export default function Users({ onView }: { onView: (key: string) => void }) {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, error } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['scenarios'] });
  };
  const toggle = useMutation({
    mutationFn: (u: ManagedUser) => setInactive(u.id, !u.inactive),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (u: ManagedUser) => deleteUser(u.id),
    onSuccess: refresh,
  });

  if (isLoading) return <div style={styles.container}>Loading…</div>;

  const actionError = toggle.error ?? remove.error;
  return (
    <div style={styles.container}>
      {error && <div style={styles.error}>{errorText(error)}</div>}
      {actionError && <div style={styles.error}>{errorText(actionError)}</div>}
      <table style={styles.table}>
        <thead>
          <tr>
            {['Email', 'Name', 'Role', 'Status', 'Joined', 'Last sign-in', 'Assignments', ''].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ opacity: u.inactive ? 0.6 : 1 }}>
              <td style={styles.td}>{u.email}</td>
              <td style={styles.td}>{u.name ?? '—'}</td>
              <td style={styles.td}>{u.role}</td>
              <td style={styles.td}>{u.inactive ? 'Inactive (view-only)' : 'Active'}</td>
              <td style={styles.td}>{fmtDate(u.created_at)}</td>
              <td style={styles.td}>{fmtDate(u.last_login)}</td>
              <td style={styles.td}>
                {u.assignments.length === 0
                  ? '—'
                  : u.assignments.map((a) => (
                      <button key={a.key} style={styles.link} onClick={() => onView(a.key)}>
                        View “{a.name}” <span style={{ color: '#999' }}>(from {a.base})</span>
                      </button>
                    ))}
              </td>
              <td style={styles.td}>
                {u.protected ? (
                  <span style={{ color: '#999' }}>In HOST_EMAILS</span>
                ) : (
                  <>
                    <button style={styles.button} disabled={toggle.isPending} onClick={() => toggle.mutate(u)}>
                      {u.inactive ? 'Make active' : 'Make inactive'}
                    </button>
                    <button
                      style={styles.button}
                      disabled={remove.isPending}
                      onClick={() =>
                        window.confirm(
                          `Delete ${u.email} and their ${u.assignments.length} assignment(s)? ` +
                            'They can sign in again as a new, active user; use Make inactive to keep them view-only.',
                        ) && remove.mutate(u)
                      }
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
