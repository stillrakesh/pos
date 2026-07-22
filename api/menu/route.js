// ─── In-Memory Menu Store ────────────────────────────────────
let menuItems = [];
let nextMenuId = 1;

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
  const showAll = searchParams.get('all') === 'true';

  const items = showAll
    ? menuItems
    : menuItems.filter(i => i.available);

  // Group by category for fast mobile rendering
  const grouped = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  return Response.json(
    {
      success: true,
      count: items.length,
      categories: Object.keys(grouped),
      menu: grouped,
    },
    { headers: corsHeaders }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, category, price, available } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'name is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (price == null || typeof price !== 'number' || price < 0) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'price must be a non-negative number' },
        { status: 400, headers: corsHeaders }
      );
    }

    const item = {
      id: nextMenuId++,
      name: name.trim(),
      category: category ? category.trim() : 'Uncategorised',
      price,
      available: available !== false,
      created_at: new Date().toISOString(),
    };

    menuItems.push(item);

    return Response.json(
      { success: true, item },
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
    const { id, name, category, price, available } = body;

    if (!id) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'id is required in body' },
        { status: 400, headers: corsHeaders }
      );
    }

    const item = menuItems.find(m => m.id === Number(id));
    if (!item) {
      return Response.json(
        { error: 'NOT_FOUND', message: `Menu item #${id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    if (name !== undefined) item.name = String(name).trim();
    if (category !== undefined) item.category = String(category).trim();
    if (price !== undefined && typeof price === 'number') item.price = price;
    if (available !== undefined) item.available = !!available;

    return Response.json(
      { success: true, item },
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
        { error: 'VALIDATION_ERROR', message: 'id query param required (e.g. ?id=1)' },
        { status: 400, headers: corsHeaders }
      );
    }

    const idx = menuItems.findIndex(m => m.id === id);
    if (idx === -1) {
      return Response.json(
        { error: 'NOT_FOUND', message: `Menu item #${id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    const deleted = menuItems.splice(idx, 1)[0];

    return Response.json(
      { success: true, message: `"${deleted.name}" deleted` },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: 'SERVER_ERROR', message: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
