const fs = require('fs');

const filePath = 'c:\\Users\\mrrak\\Desktop\\restaurant-pos\\src\\App.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add handleUpdateDeviceStatus and handleDeleteDevice
const handlers = `
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

// Inject handlers before the return statement of MainApp (search for a unique marker near the end)
content = content.replace('return (', handlers + '\n  return (');

// 2. Update GlobalSettingsView call
const oldSettingsCall = `<GlobalSettingsView 
              settings={settings} 
              onSaveSettings={setSettings} 
              onClearHistory={handleClearHistory}
              onFullReset={handleFullReset}
            />`;

const newSettingsCall = `<GlobalSettingsView 
              settings={settings} 
              onSaveSettings={setSettings} 
              onClearHistory={handleClearHistory}
              onFullReset={handleFullReset}
              devices={devices}
              onUpdateDeviceStatus={handleUpdateDeviceStatus}
              onDeleteDevice={handleDeleteDevice}
            />`;

content = content.replace(oldSettingsCall, newSettingsCall);

fs.writeFileSync(filePath, content, 'utf8');
console.log('App.jsx Final Enhancements Complete');
