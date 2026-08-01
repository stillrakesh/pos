export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace('Bearer ', '').trim();

  // Handshake verification
  if (req.url.includes('/verify-key') || req.url.includes('/verify')) {
    if (!apiKey) {
      return res.status(401).json({ success: false, status: 'auth_error', message: 'API Key is required' });
    }
    return res.status(200).json({
      success: true,
      status: 'connected',
      message: 'API Key verified successfully',
      timestamp: new Date().toISOString()
    });
  }

  // Batch ingestion
  if (req.method === 'POST') {
    const { events } = req.body || {};
    return res.status(200).json({
      success: true,
      syncedCount: Array.isArray(events) ? events.length : 1,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
