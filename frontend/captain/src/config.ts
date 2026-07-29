/**
 * Returns ONLY the root origin (protocol + host + port) of the backend server.
 * 
 * Uses the URL constructor to completely strip any path component such as
 * /captain/, /captain//captain, etc. — regardless of what gets saved in
 * localStorage. This prevents the double-path bug where API calls become
 * http://host:3101/captain/tables instead of http://host:3101/tables.
 */
export const getBackendURL = (): string => {
  const port = window.location.port;

  // If served directly by Express backend (e.g. port 3100 or 3101),
  // window.location.origin is ALREADY the correct backend URL!
  // Do not allow stale/poisoned localStorage values like 127.0.0.1 to override it.
  if (port !== '5173' && port !== '5175' && typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  const saved = localStorage.getItem('backend_url');
  let url = window.location.origin;

  if (port === '5173' || port === '5175') {
    if (!saved || saved.includes('localhost:5173') || saved.includes('127.0.0.1:5173')) {
      url = `http://${window.location.hostname}:3101`;
    }
  } else if (saved) {
    try {
      url = new URL(saved).origin;
    } catch {
      url = saved.split('/').slice(0, 3).join('/');
    }
  }

  console.log(`[CaptainConfig] Backend URL: ${url} (port: ${port})`);
  return url;
};

export const API_BASE = getBackendURL();
