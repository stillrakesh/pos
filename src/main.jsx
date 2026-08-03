import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── Global Error Safety Net ──
// Catches async errors, timer errors, and event handler errors
// that escape React's Error Boundary
const crashLog = [];
const MAX_CRASH_LOG = 50;

window.onerror = (message, source, lineno, colno, error) => {
  const entry = {
    type: 'window.onerror',
    message: String(message),
    source: source || 'unknown',
    line: lineno,
    col: colno,
    stack: error?.stack || '',
    timestamp: new Date().toISOString()
  };
  crashLog.push(entry);
  if (crashLog.length > MAX_CRASH_LOG) crashLog.shift();
  console.error('🛡️ [GLOBAL ERROR CAUGHT]', message, '\nSource:', source, 'Line:', lineno);
  
  // Store in localStorage for diagnostics
  try {
    localStorage.setItem('pos_crash_log', JSON.stringify(crashLog.slice(-20)));
  } catch (e) {}
  
  // Return true to PREVENT the error from crashing the page
  return true;
};

window.onunhandledrejection = (event) => {
  const reason = event.reason;
  const entry = {
    type: 'unhandledrejection',
    message: String(reason?.message || reason),
    stack: reason?.stack || '',
    timestamp: new Date().toISOString()
  };
  crashLog.push(entry);
  if (crashLog.length > MAX_CRASH_LOG) crashLog.shift();
  console.warn('🛡️ [PROMISE ERROR CAUGHT]', reason);
  
  try {
    localStorage.setItem('pos_crash_log', JSON.stringify(crashLog.slice(-20)));
  } catch (e) {}
  
  // Prevent the rejection from propagating
  event.preventDefault();
};

// Make crash log accessible for diagnostics
window.__POS_CRASH_LOG = crashLog;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
