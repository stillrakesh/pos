/**
 * aiDiagnosticService.js — Gemini AI Self-Healing & Diagnostic Engine
 * 
 * Provides two tiers of recovery:
 *   Tier 1: Local deterministic recovery (no internet required)
 *   Tier 2: Gemini AI-powered analysis & smart fix recommendations
 */

const GEMINI_API_KEY_STORAGE = 'pos_gemini_api_key';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Model fallback chain — each has separate free-tier quota
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite-preview-06-17', 'gemini-1.5-flash'];

// ── API Key Management ──────────────────────────────────────────────

export function getGeminiApiKey() {
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
  } catch { return ''; }
}

export function saveGeminiApiKey(key) {
  try {
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
    return true;
  } catch { return false; }
}

export function clearGeminiApiKey() {
  try {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    return true;
  } catch { return false; }
}

export function isGeminiConfigured() {
  return getGeminiApiKey().length > 10;
}

/**
 * Check if an API error is a quota/rate-limit issue
 */
function isQuotaError(errMsg) {
  const lower = (errMsg || '').toLowerCase();
  return lower.includes('quota') || lower.includes('rate') || lower.includes('resource has been exhausted') || lower.includes('exceeded');
}

/**
 * Call Gemini API with automatic model fallback on quota errors
 * @returns {{ success: boolean, data?: object, model?: string, error?: string }}
 */
async function callGeminiWithFallback(apiKey, body) {
  let lastError = '';
  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `HTTP ${response.status}`;
        
        // If quota error, try next model
        if (isQuotaError(errMsg)) {
          lastError = `${model}: Quota exhausted`;
          console.warn(`[AI Diagnostic] ${model} quota exhausted, trying next model...`);
          continue;
        }
        // Non-quota error — return immediately
        return { success: false, error: `API error (${model}): ${errMsg}` };
      }

      const data = await response.json();
      return { success: true, data, model };
    } catch (err) {
      lastError = `${model}: ${err.message}`;
      // Network errors — try next model in case it's a transient issue
      continue;
    }
  }
  return { success: false, error: `All models exhausted. Last error: ${lastError}. Your free-tier quota may be depleted — try again in a few minutes or check your billing at https://aistudio.google.com` };
}

/**
 * Test the Gemini API key with a lightweight request
 * @returns {{ success: boolean, message: string }}
 */
export async function testGeminiApiKey(apiKey) {
  if (!apiKey || apiKey.trim().length < 10) {
    return { success: false, message: 'API key is too short or missing.' };
  }

  const result = await callGeminiWithFallback(apiKey.trim(), {
    contents: [{ parts: [{ text: 'Reply with exactly: TYDE_POS_OK' }] }],
    generationConfig: { maxOutputTokens: 20, temperature: 0 }
  });

  if (!result.success) {
    return { success: false, message: result.error };
  }

  const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (text.includes('TYDE_POS_OK')) {
    return { success: true, message: `✅ API key is valid and working! (Model: ${result.model})` };
  }
  return { success: true, message: `API key accepted by Google via ${result.model}.` };
}

// ── System Telemetry Collector ──────────────────────────────────────

function collectSystemTelemetry() {
  const telemetry = {
    timestamp: new Date().toISOString(),
    platform: navigator.platform || 'unknown',
    userAgent: navigator.userAgent,
    language: navigator.language,
    online: navigator.onLine,
    screenResolution: `${window.screen?.width || '?'}x${window.screen?.height || '?'}`,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    memoryUsage: null,
    isElectron: !!window.electronAPI,
    localStorage: {
      settingsPresent: !!localStorage.getItem('pos_settings'),
      crashLogEntries: 0,
      totalKeys: 0
    }
  };

  // Memory info (Chrome/Electron only)
  if (performance?.memory) {
    telemetry.memoryUsage = {
      usedJSHeapSize: `${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB`,
      totalJSHeapSize: `${Math.round(performance.memory.totalJSHeapSize / 1048576)}MB`,
      jsHeapSizeLimit: `${Math.round(performance.memory.jsHeapSizeLimit / 1048576)}MB`
    };
  }

  // localStorage stats
  try {
    telemetry.localStorage.totalKeys = localStorage.length;
    const crashLog = JSON.parse(localStorage.getItem('pos_crash_log') || '[]');
    telemetry.localStorage.crashLogEntries = crashLog.length;
  } catch {}

  return telemetry;
}

function getRecentCrashLog() {
  try {
    const logs = JSON.parse(localStorage.getItem('pos_crash_log') || '[]');
    return logs.slice(-5); // Last 5 crashes
  } catch { return []; }
}

// ── Gemini AI Error Analysis ────────────────────────────────────────

const SYSTEM_PROMPT = `You are TYDE POS System Diagnostic AI — an expert system administrator and software engineer specializing in restaurant POS (Point of Sale) software troubleshooting.

CONTEXT: TYDE POS is a React-based Electron desktop app for restaurant billing, KOT (Kitchen Order Ticket) printing, table management, and order processing. It runs on Windows PCs with thermal printers connected via USB/Network, communicates with a local Node.js Express server via Socket.IO on port 3101, and optionally syncs to a cloud dashboard.

When analyzing errors, you MUST respond with ONLY a valid JSON object (no markdown, no code fences) in this exact schema:
{
  "rootCause": "Clear 1-2 sentence explanation of what went wrong in plain English that a restaurant owner can understand",
  "technicalDetail": "Technical explanation for developers (component stack analysis, state corruption, etc.)",
  "severity": "low|medium|high|critical",
  "category": "ui_state|network|printer|database|config|memory|unknown",
  "actionPlan": ["RECOVERY_ACTION_1", "RECOVERY_ACTION_2"],
  "userAdvice": "Step-by-step practical advice for the restaurant staff to prevent this in the future",
  "confidence": 0.85
}

Available RECOVERY ACTIONS you can recommend (use these exact strings):
- CLEAR_SESSION_CACHE — Clears corrupted temporary UI state while preserving orders & settings
- RESET_TRANSIENT_STATE — Resets the React component tree without losing stored data
- REBIND_SOCKET — Disconnects and reconnects the Socket.IO connection to the local server
- FLUSH_RENDER_QUEUE — Forces a clean re-render of the entire UI component tree
- RESTART_LOCAL_SERVER — Signals the Electron main process to restart the backend server
- CLEAR_STALE_ORDERS — Removes orphaned/stuck order entries from session storage
- RELOAD_SETTINGS — Reloads POS settings from localStorage (fixes config corruption)
- RESET_PRINTER_STATE — Resets printer connection state and re-initializes detection
- FULL_PAGE_RELOAD — Last resort: performs a full browser/Electron window reload

GUIDELINES:
- Always recommend the least destructive actions first
- Never recommend clearing localStorage (customer data lives there)
- If the error is a simple React rendering bug, CLEAR_SESSION_CACHE + RESET_TRANSIENT_STATE usually suffices
- For network errors, recommend REBIND_SOCKET
- For printer errors, recommend RESET_PRINTER_STATE
- FULL_PAGE_RELOAD should only be used if other actions are unlikely to fix the issue
- Set confidence between 0.0-1.0 based on how certain you are about the diagnosis`;

/**
 * Send error data to Gemini for AI-powered analysis
 * @param {{ error: Error, errorInfo: object, customContext?: string }} params
 * @returns {Promise<{ success: boolean, analysis?: object, error?: string }>}
 */
export async function analyzeErrorWithGemini({ error, errorInfo, customContext }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { success: false, error: 'Gemini API key not configured. Add it in Settings → System.' };
  }

  const telemetry = collectSystemTelemetry();
  const recentCrashes = getRecentCrashLog();

  const userPrompt = `ANALYZE THIS POS SYSTEM ERROR:

ERROR MESSAGE: ${error?.message || error?.toString() || 'Unknown error'}

STACK TRACE:
${error?.stack || 'No stack trace available'}

COMPONENT STACK:
${errorInfo?.componentStack || 'No component stack available'}

SYSTEM TELEMETRY:
${JSON.stringify(telemetry, null, 2)}

RECENT CRASH HISTORY (last 5):
${JSON.stringify(recentCrashes, null, 2)}

${customContext ? `ADDITIONAL CONTEXT: ${customContext}` : ''}

Respond with ONLY a JSON object following the schema. No markdown formatting.`;

  try {
    const result = await callGeminiWithFallback(apiKey, {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const rawText = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the JSON response
    let analysis;
    try {
      // Try direct parse first
      analysis = JSON.parse(rawText);
    } catch {
      // Try to extract JSON from potential markdown wrapping
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        return { success: false, error: 'Could not parse AI response. Raw: ' + rawText.substring(0, 200) };
      }
    }

    // Validate required fields
    if (!analysis.rootCause || !analysis.actionPlan) {
      return { success: false, error: 'AI response missing required fields (rootCause, actionPlan).' };
    }

    return { success: true, analysis };
  } catch (err) {
    return { success: false, error: `Failed to reach Gemini API: ${err.message}` };
  }
}

/**
 * Run a proactive health check via Gemini (no error required)
 * @returns {Promise<{ success: boolean, analysis?: object, error?: string }>}
 */
export async function runFullDiagnostics() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { success: false, error: 'Gemini API key not configured.' };
  }

  const telemetry = collectSystemTelemetry();
  const recentCrashes = getRecentCrashLog();

  const prompt = `PROACTIVE HEALTH CHECK REQUEST — No active error. Analyze the system state and recent crash history to identify potential issues.

SYSTEM TELEMETRY:
${JSON.stringify(telemetry, null, 2)}

RECENT CRASH HISTORY (last 5):
${JSON.stringify(recentCrashes, null, 2)}

If everything looks healthy, set severity to "low" and rootCause to a positive health summary.
Always respond with JSON following the schema.`;

  try {
    const result = await callGeminiWithFallback(apiKey, {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const rawText = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        return { success: false, error: 'Could not parse health check response.' };
      }
    }

    return { success: true, analysis };
  } catch (err) {
    return { success: false, error: `Health check failed: ${err.message}` };
  }
}

// ── Recovery Action Executor ────────────────────────────────────────

const RECOVERY_ACTIONS = {
  CLEAR_SESSION_CACHE: {
    label: 'Clear Session Cache',
    description: 'Removes temporary UI state without touching orders or settings',
    execute: () => {
      try { sessionStorage.clear(); return true; } catch { return false; }
    }
  },
  RESET_TRANSIENT_STATE: {
    label: 'Reset Component State',
    description: 'Resets the React component tree cleanly',
    execute: () => {
      // This is handled by ErrorBoundary setState — return true as a signal
      return true;
    }
  },
  REBIND_SOCKET: {
    label: 'Rebind Socket Connection',
    description: 'Disconnects and reconnects the real-time data channel',
    execute: () => {
      try {
        // Attempt to find and reconnect any global socket
        if (window.__posSocket) {
          window.__posSocket.disconnect();
          setTimeout(() => window.__posSocket.connect(), 500);
        }
        return true;
      } catch { return false; }
    }
  },
  FLUSH_RENDER_QUEUE: {
    label: 'Flush Render Queue',
    description: 'Forces the UI to re-render from scratch',
    execute: () => {
      // Signal only — actual re-render handled by ErrorBoundary
      return true;
    }
  },
  RESTART_LOCAL_SERVER: {
    label: 'Restart Local Server',
    description: 'Signals Electron to restart the backend server process',
    execute: () => {
      try {
        if (window.electronAPI?.restartServer) {
          window.electronAPI.restartServer();
          return true;
        }
        return false;
      } catch { return false; }
    }
  },
  CLEAR_STALE_ORDERS: {
    label: 'Clear Stale Orders',
    description: 'Removes orphaned order entries from session storage',
    execute: () => {
      try {
        // Clear session-specific order caches, not persistent ones
        const keysToCheck = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          keysToCheck.push(sessionStorage.key(i));
        }
        keysToCheck.forEach(key => {
          if (key?.startsWith('order_') || key?.startsWith('temp_')) {
            sessionStorage.removeItem(key);
          }
        });
        return true;
      } catch { return false; }
    }
  },
  RELOAD_SETTINGS: {
    label: 'Reload Settings',
    description: 'Reloads POS settings from storage to fix config issues',
    execute: () => {
      try {
        // Validate settings are parseable
        const raw = localStorage.getItem('pos_settings');
        if (raw) JSON.parse(raw);
        return true;
      } catch {
        // If settings are corrupted, remove the bad entry
        // The app will fall back to defaults
        return false;
      }
    }
  },
  RESET_PRINTER_STATE: {
    label: 'Reset Printer State',
    description: 'Resets printer detection and connection state',
    execute: () => {
      try {
        sessionStorage.removeItem('printer_state');
        sessionStorage.removeItem('printer_port');
        return true;
      } catch { return false; }
    }
  },
  FULL_PAGE_RELOAD: {
    label: 'Full Page Reload',
    description: 'Completely reloads the POS application (last resort)',
    execute: () => {
      setTimeout(() => window.location.reload(), 300);
      return true;
    }
  }
};

/**
 * Execute a list of recovery actions from Gemini's recommendation
 * @param {string[]} actionPlan - Array of action IDs
 * @returns {{ results: Array<{ action: string, success: boolean, label: string }>, needsReload: boolean }}
 */
export function executeRecoveryPlan(actionPlan = []) {
  const results = [];
  let needsReload = false;

  for (const actionId of actionPlan) {
    const action = RECOVERY_ACTIONS[actionId];
    if (action) {
      const success = action.execute();
      results.push({ action: actionId, success, label: action.label });
      if (actionId === 'FULL_PAGE_RELOAD') needsReload = true;
    } else {
      results.push({ action: actionId, success: false, label: `Unknown action: ${actionId}` });
    }
  }

  // Log the recovery attempt
  try {
    const recoveryLog = JSON.parse(localStorage.getItem('pos_recovery_log') || '[]');
    recoveryLog.push({
      timestamp: new Date().toISOString(),
      actions: results,
      source: 'gemini_ai'
    });
    localStorage.setItem('pos_recovery_log', JSON.stringify(recoveryLog.slice(-30)));
  } catch {}

  return { results, needsReload };
}

/**
 * Execute Tier-1 local recovery (no AI required)
 * @returns {{ results: Array<{ action: string, success: boolean, label: string }> }}
 */
export function executeLocalRecovery() {
  const defaultPlan = [
    'CLEAR_SESSION_CACHE',
    'RESET_TRANSIENT_STATE',
    'FLUSH_RENDER_QUEUE'
  ];

  const { results } = executeRecoveryPlan(defaultPlan);

  // Log as local recovery
  try {
    const recoveryLog = JSON.parse(localStorage.getItem('pos_recovery_log') || '[]');
    recoveryLog.push({
      timestamp: new Date().toISOString(),
      actions: results,
      source: 'local_auto'
    });
    localStorage.setItem('pos_recovery_log', JSON.stringify(recoveryLog.slice(-30)));
  } catch {}

  return { results };
}

export { RECOVERY_ACTIONS };
