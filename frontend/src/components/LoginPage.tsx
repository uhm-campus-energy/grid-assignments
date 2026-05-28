import { useState, FormEvent } from 'react';
import api from '../api/client';
import { setToken } from '../auth';

interface Props {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/login', { username, password });
      setToken(res.data.token);
      onSuccess();
    } catch {
      setError('Invalid username or password');
    } finally {
      setBusy(false);
    }
  };

  const styles = {
    page: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#f4f6f8',
      fontFamily: 'inherit',
    },
    card: {
      width: '320px',
      padding: '32px',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    },
    title: { margin: '0 0 24px', fontSize: '24px', color: '#1565C0', fontWeight: 'bold' as const },
    label: { display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px' },
    input: {
      width: '100%',
      padding: '10px',
      marginBottom: '16px',
      fontSize: '14px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      boxSizing: 'border-box' as const,
      fontFamily: 'inherit',
    },
    button: {
      width: '100%',
      padding: '11px',
      fontSize: '15px',
      color: '#fff',
      backgroundColor: '#1565C0',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    error: { color: '#c62828', fontSize: '13px', marginBottom: '12px' },
  };

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Grid Assignments</h1>
        {error && <div style={styles.error} data-testid="login-error">{error}</div>}
        <label style={styles.label} htmlFor="username">Username</label>
        <input
          id="username"
          data-testid="login-username"
          style={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <label style={styles.label} htmlFor="password">Password</label>
        <input
          id="password"
          data-testid="login-password"
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button style={styles.button} type="submit" data-testid="login-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
