// ─── In-Memory Tables Store ──────────────────────────────────
// Persists across warm invocations, resets on cold start.
// For production persistence, connect to a database.

let tables = [];
let nextTableId = 1;

const VALID_STATUSES = ['AVAILABLE', 'OCCUPIED'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  return Response.json(
    { success: true, count: tables.length, tables },
    { headers: corsHeaders }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { table_number, status } = body;

    if (!table_number && table_number !== 0) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'table_number is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check duplicate
    if (tables.find(t => t.table_number === String(table_number))) {
      return Response.json(
        { error: 'DUPLICATE', message: `Table "${table_number}" already exists` },
        { status: 409, headers: corsHeaders }
      );
    }

    const validStatus = status && VALID_STATUSES.includes(status.toUpperCase())
      ? status.toUpperCase()
      : 'AVAILABLE';

    const table = {
      id: nextTableId++,
      table_number: String(table_number),
      status: validStatus,
      created_at: new Date().toISOString(),
    };

    tables.push(table);

    return Response.json(
      { success: true, table },
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
    const { id, table_number, status } = body;

    if (!id) {
      return Response.json(
        { error: 'VALIDATION_ERROR', message: 'id is required in body' },
        { status: 400, headers: corsHeaders }
      );
    }

    const table = tables.find(t => t.id === Number(id));
    if (!table) {
      return Response.json(
        { error: 'NOT_FOUND', message: `Table #${id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    if (table_number !== undefined) table.table_number = String(table_number);
    if (status && VALID_STATUSES.includes(status.toUpperCase())) {
      table.status = status.toUpperCase();
    }

    return Response.json(
      { success: true, table },
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
        { error: 'VALIDATION_ERROR', message: 'id query param is required (e.g. ?id=1)' },
        { status: 400, headers: corsHeaders }
      );
    }

    const idx = tables.findIndex(t => t.id === id);
    if (idx === -1) {
      return Response.json(
        { error: 'NOT_FOUND', message: `Table #${id} not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    const deleted = tables.splice(idx, 1)[0];

    return Response.json(
      { success: true, message: `Table "${deleted.table_number}" deleted` },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: 'SERVER_ERROR', message: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
