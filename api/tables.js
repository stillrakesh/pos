// In-Memory Tables Store (resets on cold start)
let tables = [
  { id: 1, table_number: '1', status: 'AVAILABLE', capacity: 2 },
  { id: 2, table_number: '2', status: 'OCCUPIED', capacity: 4 },
  { id: 3, table_number: '3', status: 'AVAILABLE', capacity: 4 },
  { id: 4, table_number: '4', status: 'OCCUPIED', capacity: 6 },
  { id: 5, table_number: '5', status: 'AVAILABLE', capacity: 2 },
  { id: 6, table_number: '6', status: 'AVAILABLE', capacity: 4 }
];
let nextTableId = 7;

export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, count: tables.length, tables });
  }

  if (req.method === 'POST') {
    const { table_number, status } = req.body;
    if (!table_number) return res.status(400).json({ error: 'table_number required' });
    
    const table = {
      id: nextTableId++,
      table_number: String(table_number),
      status: status || 'AVAILABLE',
      capacity: req.body.capacity || 4
    };
    tables.push(table);
    return res.status(201).json({ success: true, table });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
