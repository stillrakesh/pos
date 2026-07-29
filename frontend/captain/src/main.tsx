import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Register Service Worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/captain/sw.js')
      .then(reg => console.log('[SW] Registered successfully:', reg.scope))
      .catch(err => console.error('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <App />
)
