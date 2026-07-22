let tables = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    tables = req.body.tables || [];
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, tables });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
