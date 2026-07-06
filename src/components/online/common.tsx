// Shared bits for the online screens: the sign-in gate, remembered display
// name, and error-message cleanup for Convex mutation failures.

import { useState, type ReactNode } from 'react';
import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';

const NAME_KEY = 'droneDerby.name';

export function useSavedName(): [string, (n: string) => void] {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  return [
    name,
    (n: string) => {
      setName(n);
      localStorage.setItem(NAME_KEY, n);
    },
  ];
}

/** Server errors arrive as "[Request ID …] Server Error Uncaught Error: <msg> at …". */
export function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw.match(/Uncaught Error: (.+?)(?:\s+at\s|$)/s);
  return m ? m[1].trim() : raw;
}

export function CenterNote({ children }: { children: ReactNode }) {
  return (
    <div className="screen center-screen">
      <p className="subtitle">{children}</p>
    </div>
  );
}

/**
 * Renders children only when signed in; otherwise a guest sign-in card.
 * Magic link + Google get added here (and in convex/auth.ts) once their
 * credentials are configured — nothing downstream cares which provider
 * produced the userId.
 */
export function SignInGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <CenterNote>Connecting…</CenterNote>;
  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="screen center-screen">
      <h1 className="title">Drone Derby</h1>
      <p className="subtitle">Program your robot. Survive the factory. Beat your friends.</p>
      <button
        className="primary big"
        disabled={busy}
        data-testid="guest-signin"
        onClick={() => {
          setBusy(true);
          setError(null);
          signIn('anonymous').catch((e: unknown) => {
            setError(errorMessage(e));
            setBusy(false);
          });
        }}
      >
        Play as guest
      </button>
      <p className="setup-hint">
        Guest games live on this device. Email &amp; Google sign-in are coming soon.
      </p>
      {error && <p className="error-note">{error}</p>}
    </div>
  );
}
