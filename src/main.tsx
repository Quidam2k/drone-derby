import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { App } from './App';
import { convex } from './services/convex';
import { listenForSwMessages } from './services/push';
import { installGlobalTelemetry, logFlowEvent } from './services/telemetry';
import { installScreenBeacon } from './services/screenBeacon';
import { installAudio } from './services/audio';
import { installUpdatePrompt } from './services/swUpdate';
import './index.css';

installGlobalTelemetry();
installAudio();
listenForSwMessages();
void installUpdatePrompt();
window.addEventListener('appinstalled', () => logFlowEvent('pwa-installed'));

/**
 * The denominator. Every other count in the digest is a rate over this, and
 * without it "12 games started" cannot be told apart from a great day and a
 * terrible one. Fired at module scope rather than from an effect on purpose:
 * StrictMode double-invokes effects in dev, which would report twice as many
 * sessions as exist — a plausible number, and wrong.
 */
logFlowEvent('app-open', {
  standalone:
    typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches,
  hasBackend: !!convex,
});
installScreenBeacon();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {convex ? (
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
);
