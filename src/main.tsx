import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AutoRecoveryErrorBoundary } from './components/common/AutoRecoveryErrorBoundary';
import './index.css';

if (typeof window !== 'undefined') {
  const recoverUnhandledFailure = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason || 'Error de ejecución no controlado');
    if (/websocket|resizeobserver loop/i.test(message)) return;
    try {
      const attempts = Number(sessionStorage.getItem('syd_global_recovery_attempts') || '0');
      if (attempts >= 2) return;
      sessionStorage.setItem('syd_global_recovery_attempts', String(attempts + 1));
    } catch (_) {}
    const desktop = window.sydDesktop;
    if (desktop?.recoverFromError) {
      desktop.recoverFromError({ message }).catch(() => window.location.reload());
    }
  };

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    if (msg.includes('WebSocket') || msg.includes('websocket')) {
      event.preventDefault();
      return;
    }
    recoverUnhandledFailure(event?.reason);
  });
  window.addEventListener('error', (event) => recoverUnhandledFailure(event.error || event.message));
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AutoRecoveryErrorBoundary>
        <App />
      </AutoRecoveryErrorBoundary>
    </React.StrictMode>
  );
}
