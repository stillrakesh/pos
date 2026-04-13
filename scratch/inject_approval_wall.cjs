const fs = require('fs');

const filePath = 'c:\\Users\\mrrak\\Desktop\\restaurant-pos\\src\\App.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const marker = `  if (!isDbLoaded) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #a3112a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ marginTop: '20px', fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>Tyde Cafe POS</h2>
        <p style={{ fontSize: '13px', color: '#64748b' }}>Waking up the station...</p>
      </div>
    );
  }`;

const injection = `
  // --- DEVICE APPROVAL WALL ---
  if (deviceStatus === 'PENDING' || deviceStatus === 'BLOCKED') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', textAlign: 'center', padding: '40px' }}>
        <div style={{ width: '100px', height: '100px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
          <Smartphone size={40} color={deviceStatus === 'BLOCKED' ? '#ef4444' : '#f59e0b'} />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '950', marginBottom: '12px' }}>
          {deviceStatus === 'BLOCKED' ? 'Terminal Blocked' : 'Waiting for Approval'}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '300px', lineHeight: 1.6 }}>
          {deviceStatus === 'BLOCKED' 
            ? 'This terminal has been blocked by the Administrator.' 
            : \`Please approve this terminal on the Main POS. Device ID: \${deviceId}\`}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ marginTop: '32px', padding: '12px 24px', borderRadius: '12px', background: 'white', color: '#0f172a', fontWeight: '900', border: 'none', cursor: 'pointer' }}
        >
          Retry Connection
        </button>
      </div>
    );
  }
`;

content = content.replace(marker, marker + injection);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Approval Wall Injected');
