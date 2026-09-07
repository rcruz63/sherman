import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-register service worker and force update when new build is available
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('🔄 Nueva versión disponible, actualizando PWA...');
    window.location.reload();
  },
  onOfflineReady() {
    console.log('⚡ Sherman Solitario listo para jugar sin conexión.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
