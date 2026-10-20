import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { loginWithGoogle } from '../api/auth';

// Google Identity Services, loaded by the <script> tag in index.html.
declare const google: any;

export default function LoginScreen({ clientId }: { clientId: string | null }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const render = () => {
      google.accounts.id.initialize({
        client_id: clientId,
        hd: 'hawaii.edu',
        callback: async ({ credential }: { credential: string }) => {
          try {
            await loginWithGoogle(credential);
            queryClient.invalidateQueries();
          } catch (e) {
            setError(isAxiosError(e) ? e.response?.data?.detail ?? e.message : String(e));
          }
        },
      });
      google.accounts.id.renderButton(buttonRef.current, { size: 'large' });
    };
    // The script is async, so it may not have finished loading yet.
    if (typeof google !== 'undefined') render();
    else document.getElementById('gsi')?.addEventListener('load', render);
  }, [clientId, queryClient]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        height: '100vh',
      }}
    >
      <h1 style={{ color: '#1565C0' }}>Grid Assignments</h1>
      <p>Sign in with your UH (hawaii.edu) Google account.</p>
      {clientId ? <div ref={buttonRef} /> : <p>Sign-in is not configured (GOOGLE_CLIENT_ID is missing).</p>}
      {error && <p style={{ color: '#c62828' }}>{error}</p>}
    </div>
  );
}
