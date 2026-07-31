/**
 * Centralized Logger Service for Diagnostics & Troubleshooting.
 * Stores runtime logs, API network failures, and backend diagnostics.
 */

const MAX_LOGS = 200;
let logs = [];
let listeners = [];

export const logger = {
  getLogs() {
    return [...logs];
  },

  log(type, category, message, details = null) {
    const entry = {
      id: Date.now() + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toLocaleTimeString(),
      fullTime: new Date().toISOString(),
      type, // 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'
      category, // 'API' | 'KOT' | 'SERVER' | 'PRINTER' | 'SYSTEM'
      message,
      details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)) : null
    };

    logs.unshift(entry);
    if (logs.length > MAX_LOGS) logs.pop();

    console.log(`[${entry.type}][${entry.category}] ${entry.message}`, details || '');
    listeners.forEach(fn => fn(logs));
  },

  info(category, message, details) {
    this.log('INFO', category, message, details);
  },

  warn(category, message, details) {
    this.log('WARN', category, message, details);
  },

  error(category, message, details) {
    this.log('ERROR', category, message, details);
  },

  success(category, message, details) {
    this.log('SUCCESS', category, message, details);
  },

  subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  clear() {
    logs = [];
    listeners.forEach(fn => fn(logs));
  },

  exportAsText() {
    return logs.map(l => `[${l.fullTime}] [${l.type}] [${l.category}] ${l.message} ${l.details ? '\nDetails: ' + l.details : ''}`).join('\n\n');
  }
};

export default logger;
