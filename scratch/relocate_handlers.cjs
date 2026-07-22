const fs = require('fs');

const filePath = 'c:\\Users\\mrrak\\Desktop\\restaurant-pos\\src\\App.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Locate the misplaced handlers (around line 42)
const misplacedHandlersSnippet = `  const handleUpdateDeviceStatus = async (id, status) => {
    try {
      const { updateDeviceStatus } = await import('./utils/apiClient');
      const res = await updateDeviceStatus(id, status);
      if (res.success) {
        setDevices(prev => prev.map(d => d.id === id ? { ...d, status } : d));
      }
    } catch (err) {
      alert('Failed to update device status');
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Forget this device?')) return;
    try {
      const { deleteDevice } = await import('./utils/apiClient');
      const res = await deleteDevice(id);
      if (res.success) {
        setDevices(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      alert('Failed to delete device');
    }
  };`;

// Remove them from the beginning (lines 42+)
// We need to be careful with exact string. Let's just remove specific lines.
const lines = content.split('\n');
// Based on search, it's around 42.
// Let's actually find the start/end lines of that snippet.
let startIdx = -1;
let endIdx = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('const handleUpdateDeviceStatus = async')) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines[i].trim() === '};' && lines[i-1].includes('Failed to delete device')) {
    endIdx = i;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx + 1);
}

content = lines.join('\n');

// 2. Inject them INSIDE MainApp (after line 3010 or similar)
const injectMarker = 'const [isDbLoaded, setIsDbLoaded] = useState(false);';
const newHandlers = `
  const handleUpdateDeviceStatus = async (id, status) => {
    try {
      const { updateDeviceStatus } = await import('./utils/apiClient');
      const res = await updateDeviceStatus(id, status);
      if (res.success) {
        setDevices(prev => prev.map(d => d.id === id ? { ...d, status } : d));
      }
    } catch (err) {
      alert('Failed to update device status');
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Forget this device?')) return;
    try {
      const { deleteDevice } = await import('./utils/apiClient');
      const res = await deleteDevice(id);
      if (res.success) {
        setDevices(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      alert('Failed to delete device');
    }
  };
`;

content = content.replace(injectMarker, injectMarker + newHandlers);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Misplaced handlers moved to MainApp');
