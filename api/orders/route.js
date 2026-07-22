// ─── In-Memory Orders Store ──────────────────────────────────
let orders = [];
let nextOrderId = 1;

const VALID_STATUSES = ['NEW', 'PRINTED', 'COMPLETED'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const table_number = searchParams.get('table_number');

  let filtered = orders;

  if (status) {
    const upper = status.toUpperCase();
    if (!VALID_STATUSES.includes(upper)) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }
    filtered = orders.filter(o => o.status === upper);
  } else if (table_number) {
    filtered = orders.filter(o => o.table_number === String(table_number) && o.status !== 'COMPLETED');
  }

  // Most recent first
  filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return Response.json(
    { success: true, count: filtered.length, orders: filtered },
    { headers: corsHeaders }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { table_number, items, notes } = body;

    if (!table_number && table_number !== 0) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'table_number is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'items must be a non-empty array' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || typeof item.name !== 'string') {
        return Response.json(
          { error: 'VALIDATION_ERROR', message: `items[${i}].name is required` },
          { status: 400, headers: corsHeaders }
        );
      }
      if (item.quantity == null || typeof item.quantity !== 'number' || item.quantity < 1) {
        return Response.json(
          { error: 'VALIDATION_ERROR', message: `items[${i}].quantity must be a positive number` },
          { status: 400, headers: corsHeaders }
        );
      }
      if (item.price == null || typeof item.price !== 'number' || item.price < 0) {
        return Response.json(
          { error: 'VALIDATION_ERROR', message: `items[${i}].price must be non-negative` },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    const order = {
      id: nextOrderId++,
      table_number: String(table_number),
      items,
      notes: notes || '',
      status: 'NEW',
      created_at: new Date().toISOString(),
    };

    orders.push(order);

    return Response.json(
      { success: true, order },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: 'SERVER_ERROR', message: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'id is required in body' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const order = orders.find(o => o.id === Number(id));
    if (!order) {
      return Response.json(
        { error: 'NOT_FOUND', message: `Order #${id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    order.status = status.toUpperCase();

    return Response.json(
      { success: true, order },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: 'SERVER_ERROR', message: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));

    if (!id) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'id query param required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) {
      return Response.json(
        { error: 'NOT_FOUND', message: `Order #${id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    orders.splice(idx, 1);

    return Response.json(
      { success: true, message: `Order #${id} deleted` },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: 'SERVER_ERROR', message: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
