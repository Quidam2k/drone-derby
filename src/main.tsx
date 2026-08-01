import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { App } from './App';
import { convex } from './services/convex';
import { listenForSwMessages } from './services/push';
import { installGlobalTelemetry, logFlowEvent } from './services/telemetry';
import { installAudio } from './services/audio';
import './index.css';

installGlobalTelemetry();
installAudio();
listenForSwMessages();
window.addEventListener('appinstalled', () => logFlowEvent('pwa-installed'));

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
