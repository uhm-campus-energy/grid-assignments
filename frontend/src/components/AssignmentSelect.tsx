import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useScenarios } from '../hooks/useGridData';
import { createMyAssignment, deleteMyAssignment } from '../api/gridMap';
import { useMe } from '../api/auth';

const GROUPS = ['Base', 'Mine', 'Others'] as const;

const errorText = (e: unknown) =>
  isAxiosError(e) ? e.response?.data?.detail ?? e.message : String(e);

const styles = {
  select: {
    width: '100%',
    padding: '8px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontFamily: 'inherit',
  },
  row: { display: 'flex', gap: '6px', marginTop: '8px' },
  // A <select> can't scroll its own text, so long names are repeated here
  // (scrolling via the .scroll-x class in index.html).
  fullName: { marginTop: '6px', fontSize: '13px', color: '#555' },
  button: { padding: '6px 10px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: '#c62828', fontSize: '13px', marginTop: '6px' },
};

// The assignment dropdown shared by both tabs: base assignments, the user's
// own copies, and (for admins) everyone else's. Also creates and deletes copies.
export default function AssignmentSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: options = [] } = useScenarios();
  const [newName, setNewName] = useState<string | null>(null);
  const current = options.find((o) => o.key === value);
  const inactive = useMe().data?.user?.inactive ?? false;

  const create = useMutation({
    mutationFn: () => createMyAssignment(newName ?? '', value),
    onSuccess: async ({ key }) => {
      await queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setNewName(null);
      onChange(key);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteMyAssignment(value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      onChange(options[0]?.key ?? '');
    },
  });

  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.select}
        title={current?.label}
      >
        {GROUPS.map((group) => {
          const items = options.filter((o) => o.group === group);
          return (
            items.length > 0 && (
              <optgroup key={group} label={group}>
                {items.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            )
          );
        })}
      </select>
      {current && current.group !== 'Base' && <div className="scroll-x" style={styles.fullName}>{current.label}</div>}

      {current?.group === 'Base' && newName === null && !inactive && (
        <div style={styles.row}>
          <button style={styles.button} onClick={() => setNewName('')}>
            Make my own copy
          </button>
        </div>
      )}
      {newName !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <input
            autoFocus
            placeholder={`Name (copy of ${value})`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
            style={{ ...styles.select, marginTop: '8px' }}
          />
          <div style={styles.row}>
            <button
              type="submit"
              style={{ ...styles.button, flex: 1 }}
              disabled={create.isPending || !newName.trim()}
            >
              Create
            </button>
            <button type="button" style={{ ...styles.button, flex: 1 }} onClick={() => setNewName(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {current?.group === 'Mine' && !inactive && (
        <div style={styles.row}>
          <button
            style={styles.button}
            disabled={remove.isPending}
            onClick={() => window.confirm(`Delete "${current.label}"?`) && remove.mutate()}
          >
            Delete
          </button>
        </div>
      )}
      {create.isError && <div style={styles.error}>{errorText(create.error)}</div>}
      {remove.isError && <div style={styles.error}>{errorText(remove.error)}</div>}
    </div>
  );
}
