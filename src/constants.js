// Dynamically determine the API port.
// When POS is loaded inside Electron (or accessed via browser), it is served
// by the Express backend itself. So window.location.port IS the backend port.
// The only exception is the Vite dev server (port 5175), which proxies to 3101.
const getApiPort = () => {
  const currentPort = window.location.port;
  // Vite dev server → backend is on 3101
  if (currentPort === '5175') return 3101;
  // Electron or direct browser access → use same port as page was served from
  if (currentPort) return Number(currentPort);
  // Fallback (e.g. file:// protocol or no port) → 3101 for dev
  return 3101;
};

const isLocalhost = window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1'
  || !window.location.hostname;

const apiPort = getApiPort();

export const BASE_URL = isLocalhost
  ? `http://127.0.0.1:${apiPort}`
  : `http://${window.location.hostname}:${apiPort}`;

export const CLOUD_URL = 'https://restaurant-cloud-backend.onrender.com';
