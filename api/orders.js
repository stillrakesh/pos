let orders = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { table_number, items, notes } = req.body;
    
    if (!table_number || !items) {
      return res.status(400).json({ error: 'Missing requirements' });
    }

    const order = {
      id: Date.now(),
      table_number,
      items,
      notes: notes || '',
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };

    orders.push(order);
    console.log(`New Order placed for Table ${table_number}`);

    return res.status(201).json({ success: true, order });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, orders });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
