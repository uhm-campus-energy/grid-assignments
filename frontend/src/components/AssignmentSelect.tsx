import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useScenarios } from '../hooks/useGridData';
import { createMyAssignment, deleteBaseAssignment, deleteMyAssignment } from '../api/gridMap';
import { useMe } from '../api/auth';
import { ScenarioOption } from '../types/gridAssignment';

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

// Base deletes warn about the personal copies made from it (admins see them all).
function deleteMessage(current: ScenarioOption, options: ScenarioOption[]) {
  if (current.group !== 'Base') return `Delete "${current.label}"?`;
  const owners = [...new Set(options.filter((o) => o.base === current.key).map((o) => o.owner))];
  const question = `Delete base assignment "${current.key}" for everyone?`;
  if (owners.length === 0) return question;
  return `${owners.join(', ')} ${owners.length === 1 ? 'has a copy' : 'have copies'} of this assignment. ` +
    `Their copies will be kept.\n\n${question}`;
}

// The assignment dropdown shared by both tabs: base assignments, the user's
// own copies, and (for admins) everyone else's. Creates and deletes copies;
// admins can also delete base assignments.
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
  const canDeleteBase = current?.group === 'Base' && current.editable &&
    options.filter((o) => o.group === 'Base').length > 1;

  // The selected assignment can disappear (deleted, or the hardcoded default
  // is gone); fall back to the first one rather than showing nothing.
  useEffect(() => {
    if (options.length > 0 && !current) onChange(options[0].key);
  }, [options, current, onChange]);

  const create = useMutation({
    mutationFn: () => createMyAssignment(newName ?? '', value),
    onSuccess: async ({ key }) => {
      await queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setNewName(null);
      onChange(key);
    },
  });

  const remove = useMutation({
    mutationFn: () => (current?.group === 'Base' ? deleteBaseAssignment(value) : deleteMyAssignment(value)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      onChange(options.find((o) => o.key !== value)?.key ?? '');
    },
  });

  const deleteButton = current && (
    <button
      style={styles.button}
      disabled={remove.isPending}
      onClick={() => window.confirm(deleteMessage(current, options)) && remove.mutate()}
    >
      Delete
    </button>
  );

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
          {canDeleteBase && deleteButton}
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
      {current?.group === 'Mine' && !inactive && <div style={styles.row}>{deleteButton}</div>}
      {create.isError && <div style={styles.error}>{errorText(create.error)}</div>}
      {remove.isError && <div style={styles.error}>{errorText(remove.error)}</div>}
    </div>
  );
}
