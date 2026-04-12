let orders = [];

export default function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST: New order from Captain App
  if (req.method === 'POST') {
    const { table_number, items, notes } = req.body;
    
    const order = {
      id: Math.floor(Math.random() * 100000),
      table_number,
      items,
      notes: notes || '',
      status: 'NEW',
      timestamp: new Date().toISOString()
    };

    orders.push(order);
    return res.status(201).json({ success: true, order });
  }

  // PUT: Update status (e.g., mark as PRINTED)
  if (req.method === 'PUT') {
    const { id } = req.query; // Expecting /api/orders?id=123
    const { status } = req.body;
    
    const index = orders.findIndex(o => String(o.id) === String(id));
    if (index !== -1) {
      orders[index].status = status;
      return res.status(200).json({ success: true, order: orders[index] });
    }
    
    // Fallback for different URL patterns
    const pathId = req.url.split('/').filter(Boolean).slice(-2, -1)[0];
    const index2 = orders.findIndex(o => String(o.id) === String(id || pathId));
    if (index2 !== -1) {
       orders[index2].status = status;
       return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Order not found' });
  }

  // GET: Fetch new orders
  if (req.method === 'GET') {
    const { status } = req.query;
    let filtered = orders;
    if (status) {
      filtered = orders.filter(o => o.status === status);
    }
    return res.status(200).json({ success: true, orders: filtered });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
