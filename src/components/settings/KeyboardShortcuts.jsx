import React, { useState, useEffect, useCallback } from 'react';
import { Keyboard, RotateCcw, AlertTriangle } from 'lucide-react';

const DEFAULT_SHORTCUTS = {
  save: 'F1',
  printBill: 'F2',
  kot: 'F3',
  kotPrint: 'F4',
  newPickup: 'F5',
  togglePayment: 'F6',
  clearSearch: 'Escape',
  backToFloor: 'F9',
};

const SHORTCUT_LABELS = {
  save: { label: 'Save Order', description: 'Save the current order without printing' },
  printBill: { label: 'Print Bill', description: 'Print the customer bill' },
  kot: { label: 'KOT (Kitchen Order)', description: 'Send order to kitchen display' },
  kotPrint: { label: 'KOT & Print', description: 'Send to kitchen and print bill' },
  newPickup: { label: 'New Pickup Order', description: 'Start a new takeaway/pickup order' },
  togglePayment: { label: 'Cycle Payment Method', description: 'Switch between Cash → Card → UPI' },
  clearSearch: { label: 'Clear Search / Cancel', description: 'Clear search box and reset focus' },
  backToFloor: { label: 'Back to Floor View', description: 'Return to table/floor layout' },
};

// Convert a KeyboardEvent key to a display-friendly label
const formatKeyLabel = (key) => {
  if (!key) return '—';
  const map = {
    'Escape': 'Esc',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    ' ': 'Space',
    'Backspace': '⌫',
    'Delete': 'Del',
    'Enter': 'Enter',
    'Tab': 'Tab',
  };
  return map[key] || key;
};

// Keys that should not be assignable
const BLOCKED_KEYS = ['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'];

const KeyboardShortcuts = ({ settings, onUpdate }) => {
  const shortcuts = settings.keyboardShortcuts || DEFAULT_SHORTCUTS;
  const [capturingAction, setCapturingAction] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const handleKeyCapture = useCallback((e) => {
    if (!capturingAction) return;
    
    e.preventDefault();
    e.stopPropagation();

    const key = e.key;
    
    // Skip modifier-only keys
    if (BLOCKED_KEYS.includes(key)) return;

    // Build the full key combo string
    let combo = '';
    if (e.ctrlKey && key !== 'Control') combo += 'Ctrl+';
    if (e.altKey && key !== 'Alt') combo += 'Alt+';
    if (e.shiftKey && key !== 'Shift') combo += 'Shift+';
    combo += key;

    // Check for duplicates
    const duplicate = Object.entries(shortcuts).find(
      ([action, k]) => k === combo && action !== capturingAction
    );

    if (duplicate) {
      setDuplicateWarning({
        key: combo,
        existingAction: SHORTCUT_LABELS[duplicate[0]]?.label || duplicate[0]
      });
      setTimeout(() => setDuplicateWarning(null), 3000);
      setCapturingAction(null);
      return;
    }

    // Update the shortcut
    const updated = { ...shortcuts, [capturingAction]: combo };
    onUpdate({ ...settings, keyboardShortcuts: updated });
    setCapturingAction(null);
  }, [capturingAction, shortcuts, settings, onUpdate]);

  useEffect(() => {
    if (capturingAction) {
      window.addEventListener('keydown', handleKeyCapture);
      return () => window.removeEventListener('keydown', handleKeyCapture);
    }
  }, [capturingAction, handleKeyCapture]);

  // Click outside to cancel capture
  useEffect(() => {
    if (capturingAction) {
      const cancel = () => setCapturingAction(null);
      const timer = setTimeout(() => {
        document.addEventListener('click', cancel, { once: true });
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', cancel);
      };
    }
  }, [capturingAction]);

  const handleResetDefaults = () => {
    onUpdate({ ...settings, keyboardShortcuts: { ...DEFAULT_SHORTCUTS } });
    setCapturingAction(null);
    setDuplicateWarning(null);
  };

  const handleClearKey = (action) => {
    const updated = { ...shortcuts, [action]: '' };
    onUpdate({ ...settings, keyboardShortcuts: updated });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', margin: 0 }}>
            <Keyboard size={20} color="var(--primary)" /> Keyboard Shortcuts
          </h3>
          <button
            onClick={handleResetDefaults}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', fontSize: '12px', fontWeight: '600',
              color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0',
              borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.target.style.background = '#e2e8f0'; }}
            onMouseLeave={e => { e.target.style.background = '#f1f5f9'; }}
          >
            <RotateCcw size={14} /> Reset Defaults
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
          Assign keyboard shortcuts to quickly perform actions while taking orders. 
          Click <strong>"Change"</strong> on any action below, then press your desired key.
          Function keys (F1–F12) work even while typing in the search bar.
        </p>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', background: '#fef3c7', border: '1px solid #fcd34d',
            borderRadius: '8px', fontSize: '13px', color: '#92400e',
            animation: 'fadeIn 0.2s ease'
          }}>
            <AlertTriangle size={16} />
            <span>
              <strong>{formatKeyLabel(duplicateWarning.key)}</strong> is already assigned to <strong>{duplicateWarning.existingAction}</strong>
            </span>
          </div>
        )}

        {/* Shortcuts List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {Object.entries(SHORTCUT_LABELS).map(([action, info]) => {
            const currentKey = shortcuts[action] || '';
            const isCapturing = capturingAction === action;

            return (
              <div
                key={action}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: '10px',
                  background: isCapturing ? '#eff6ff' : '#f8fafc',
                  border: isCapturing ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{info.label}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{info.description}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Key badge */}
                  <div style={{
                    minWidth: '60px', textAlign: 'center',
                    padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '700',
                    fontFamily: 'monospace', letterSpacing: '0.5px',
                    background: isCapturing ? '#dbeafe' : (currentKey ? '#1e293b' : '#e2e8f0'),
                    color: isCapturing ? '#2563eb' : (currentKey ? '#ffffff' : '#94a3b8'),
                    border: isCapturing ? '1px dashed #3b82f6' : '1px solid transparent',
                    animation: isCapturing ? 'pulse 1.5s infinite' : 'none',
                    transition: 'all 0.2s'
                  }}>
                    {isCapturing ? 'Press key...' : (currentKey ? formatKeyLabel(currentKey) : 'None')}
                  </div>

                  {/* Change button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCapturingAction(isCapturing ? null : action);
                      setDuplicateWarning(null);
                    }}
                    style={{
                      padding: '6px 12px', fontSize: '11px', fontWeight: '600',
                      borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                      background: isCapturing ? '#ef4444' : 'white',
                      color: isCapturing ? 'white' : '#334155',
                      border: isCapturing ? '1px solid #ef4444' : '1px solid #cbd5e1'
                    }}
                  >
                    {isCapturing ? 'Cancel' : 'Change'}
                  </button>

                  {/* Clear button */}
                  {currentKey && !isCapturing && (
                    <button
                      onClick={() => handleClearKey(action)}
                      style={{
                        padding: '6px 8px', fontSize: '11px', fontWeight: '500',
                        borderRadius: '6px', cursor: 'pointer',
                        background: 'transparent', color: '#94a3b8',
                        border: '1px solid #e2e8f0', transition: 'all 0.2s'
                      }}
                      title="Remove shortcut"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info footer */}
        <div style={{
          padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '10px', fontSize: '12px', color: '#166534', lineHeight: '1.6'
        }}>
          <strong>💡 Tips:</strong><br />
          • Function keys (F1–F12) are recommended — they work even while searching items<br />
          • Regular keys (letters, numbers) only trigger when the search bar is not focused<br />
          • Shortcuts are only active in the order-taking screen
        </div>
      </div>
    </div>
  );
};

export { DEFAULT_SHORTCUTS };
export default KeyboardShortcuts;
