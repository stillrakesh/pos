// ⚠️ STABLE CORE - DO NOT MODIFY WITHOUT BACKUP
import { Router } from 'express';
import { statements } from '../db.js'; // used for order CRUD + table status updates
import { normalizeTable } from '../utils/normalization.js';

const router = Router();

// Helper to normalize table names (e.g. 'Table A1' -> 'A1', 'a1' -> 'A1')
export function normalizeTableNumber(num) {
  if (!num) return '';
  let s = String(num).trim().toUpperCase();
  if (s.startsWith('TABLE ')) {
    s = s.substring(6).trim();
  }
  return s;
}

export function findTable(allTables, searchKey) {
  if (!allTables || !searchKey && searchKey !== 0) return null;
  const sStr = String(searchKey).trim().toUpperCase();
  const sNorm = normalizeTableNumber(searchKey);

  return (allTables || []).find(t => {
    const matchId = String(t.id).trim().toUpperCase();
    const matchNum = String(t.table_number || '').trim().toUpperCase();
    const matchNorm = normalizeTableNumber(t.table_number);

    return (
      matchId === sStr ||
      matchNum === sStr ||
      (sNorm && matchNorm === sNorm) ||
      (sNorm && matchId === sNorm) ||
      (sNorm && matchNum === sNorm)
    );
  }) || null;
}

// Helper to extract item quantity safely (POS cart uses `qty`, DB snapshots use `quantity`)
const getItemQty = (i) => {
  if (!i) return 0;
  if (i.qty !== undefined && i.qty !== null && !isNaN(Number(i.qty))) return Number(i.qty);
  if (i.quantity !== undefined && i.quantity !== null && !isNaN(Number(i.quantity))) return Number(i.quantity);
  return 1;
};

const getItemKey = (i) => String(i?.name || '').trim().toLowerCase();

// Helper to sync KDS tickets on order/KOT updates
export function syncKdsTicket(tableNumber, items, io, isNewKot = false) {
  try {
    const tableNumStr = normalizeTableNumber(tableNumber);
    if (!tableNumStr) return;

    if (!items || items.length === 0) {
      if (!isNewKot) {
        statements.clearTableKotTickets(tableNumStr);
        if (io) io.emit('kds_updated');
      }
      return;
    }

    // Normalize items to match KDS format (name, qty or quantity, status/itemStatus)
    const allMenu = statements.getAllMenu();
    const normalizedKdsItems = items.map(item => {
      const name = String(item.name || '').trim();
      const dbItem = allMenu.find(m => 
        m.name.toLowerCase().trim() === name.toLowerCase() ||
        name.toLowerCase().startsWith(m.name.toLowerCase().trim()) ||
        String(m.id) === String(item.id || item.item_id)
      );
      const catVal = item.category || dbItem?.category || 'General';
      const categoryStr = typeof catVal === 'object' ? (catVal?.name || 'General') : String(catVal);
      const targetQty = getItemQty(item);

      return {
        name: dbItem ? dbItem.name : name,
        quantity: targetQty,
        qty: targetQty,
        price: Number(item.price || dbItem?.price || 0),
        category: categoryStr,
        itemStatus: item.itemStatus || 'NEW',
        note: item.note || ''
      };
    }).filter(i => i.name && i.quantity > 0);

    if (normalizedKdsItems.length === 0) return;

    if (isNewKot) {
      // Force insert as a brand new KOT card in KDS
      statements.insertKotTicket(tableNumStr, normalizedKdsItems, 'NEW');
      if (io) io.emit('kds_updated');
      return;
    }

    // 1. Get current table session start time (created_at from tables table)
    let sessionStartTime = null;
    try {
      const allTables = statements.getAllTables();
      const tbl = allTables.find(t => normalizeTableNumber(t.table_number) === tableNumStr);
      if (tbl && tbl.created_at) {
        sessionStartTime = new Date(tbl.created_at).getTime();
      }
    } catch (e) {}

    // 2. Get active tickets for this table session (exclude served/cleared tickets from past sessions)
    const allTickets = statements.getAllKotTickets();
    const tableTickets = allTickets.filter(t => {
      if (normalizeTableNumber(t.table_number) !== tableNumStr) return false;
      if (t.status === 'SERVED') return false;
      if (sessionStartTime && new Date(t.created_at).getTime() < sessionStartTime - 60000) {
        return false;
      }
      return true;
    });

    // 3. Sum up total quantities seen by KDS for active tickets in current session
    const totalSeenMap = new Map();
    const unpreparedTickets = tableTickets;

    tableTickets.forEach(ticket => {
      const ticketItems = ticket.items || [];
      ticketItems.forEach(item => {
        const qty = getItemQty(item);
        const key = getItemKey(item);
        totalSeenMap.set(key, (totalSeenMap.get(key) || 0) + qty);
      });
    });

    // 3. Compare with incoming cart payload to find new items/quantities (deltas)
    const newKdsItems = [];
    normalizedKdsItems.forEach(newItem => {
      const key = getItemKey(newItem);
      const payloadQty = getItemQty(newItem);
      const seenQty = totalSeenMap.get(key) || 0;
      const deltaQty = payloadQty - seenQty;

      if (deltaQty > 0) {
        newKdsItems.push({
          ...newItem,
          quantity: deltaQty,
          qty: deltaQty,
          itemStatus: 'NEW'
        });
      }
    });

    // 4. Insert new delta items as a brand new KOT ticket in KDS
    if (newKdsItems.length > 0) {
      statements.insertKotTicket(tableNumStr, newKdsItems, 'NEW');
    }

    // 5. Handle reductions/deletions against active session tickets
    // Iterate over ALL item keys currently on KDS for this table to catch deleted items
    const allSeenKeys = Array.from(new Set([...totalSeenMap.keys()]));

    allSeenKeys.forEach(key => {
      const payloadItem = normalizedKdsItems.find(i => getItemKey(i) === key);
      const payloadQty = payloadItem ? getItemQty(payloadItem) : 0;
      const seenQty = totalSeenMap.get(key) || 0;
      let diff = seenQty - payloadQty;

      if (diff > 0) {
        for (const ticket of tableTickets) {
          if (diff <= 0) break;
          let changed = false;
          const updatedItems = (ticket.items || []).map(item => {
            if (getItemKey(item) === key && diff > 0) {
              const itemQty = getItemQty(item);
              if (itemQty <= diff) {
                diff -= itemQty;
                changed = true;
                return null; // Item removed from ticket
              } else {
                const newQty = itemQty - diff;
                diff = 0;
                changed = true;
                return { ...item, quantity: newQty, qty: newQty };
              }
            }
            return item;
          }).filter(Boolean);

          if (changed) {
            if (updatedItems.length === 0) {
              statements.updateKotTicketStatus(ticket.id, 'SERVED');
            } else {
              statements.updateKotTicketItems(ticket.id, updatedItems, ticket.status);
            }
          }
        }
      }
    });

    if (io) io.emit('kds_updated');
  } catch (err) {
    console.error('KDS sync helper failed in orders route:', err.message);
    if (io) io.emit('kds_updated');
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/orders — Create a new order from captain app
// ─────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  console.log('📦 [POST /api/orders] Incoming order payload:', JSON.stringify(req.body, null, 2));
  try {
    const { table_number, table_id, items, notes, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate, printKOT } = req.body;

    // Accept table_id OR table_number (Captain sends table_id)
    const resolvedTableNum = table_number || table_id;

    // --- Validation ---
    if (!resolvedTableNum && resolvedTableNum !== 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'table_number or table_id is required' 
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'items must be a non-empty array' 
      });
    }

    // --- Validation & Enrichment ---
    const allMenu = statements.getAllMenu();
    const normalizedItems = items.map(i => {
      const name = String(i.name || '').trim();
      // Lookup category from DB if missing
      const dbItem = allMenu.find(m => 
        m.name.toLowerCase().trim() === name.toLowerCase() || 
        String(m.id) === String(i.id || i.item_id)
      );
      
      return {
        name:     name,
        quantity: Number(i.quantity || i.qty || 1),
        price:    Number(i.price || dbItem?.price || 0),
        category: i.category || dbItem?.category || 'General',
        note:     i.note || ''
      };
    }).filter(i => i.name);

    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No valid items provided' });
    }

    // --- Resolve target table ---
    const allTables = statements.getAllTables();
    let targetTable = findTable(allTables, table_id) || findTable(allTables, table_number) || findTable(allTables, resolvedTableNum);

    const isVirtual = String(resolvedTableNum).toUpperCase().startsWith('TA-') || String(resolvedTableNum).toUpperCase().startsWith('DL-') || String(resolvedTableNum).toUpperCase().startsWith('DEL-') || String(resolvedTableNum).toUpperCase().startsWith('ONL-') || String(resolvedTableNum).toUpperCase().startsWith('TAK-');

    if (!targetTable && !isVirtual) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Table not found` });
    }

    const finalGstEnabled = gst_enabled !== undefined ? gst_enabled : (targetTable ? targetTable.gst_enabled : false);
    const finalGstRate = gst_rate !== undefined ? gst_rate : (targetTable ? targetTable.gst_rate : 5);
    const finalScEnabled = service_charge_enabled !== undefined ? service_charge_enabled : (targetTable ? targetTable.service_charge_enabled : false);
    const finalScRate = service_charge_rate !== undefined ? service_charge_rate : (targetTable ? targetTable.service_charge_rate : 5);

    let order = null;
    try {
      const existing = (() => {
        if (!targetTable) return [];
        try { return JSON.parse(targetTable.order_items || '[]'); } catch (e) { return []; }
      })();
      
      // Merge: same name → add quantity
      const mergedMap = new Map();
      existing.forEach(item => {
        const qty = Number(item.quantity || item.qty || 1);
        mergedMap.set(item.name, { ...item, quantity: qty, qty });
      });
      normalizedItems.forEach(item => {
        const addQty = Number(item.quantity || 1);
        if (mergedMap.has(item.name)) {
          const current = mergedMap.get(item.name);
          const newQty = current.quantity + addQty;
          mergedMap.set(item.name, { 
            ...current, 
            quantity: newQty, 
            qty: newQty,
            note: item.note || current.note || ''
          });
        } else {
          mergedMap.set(item.name, { ...item, quantity: addQty, qty: addQty });
        }
      });
      
      const mergedItems = Array.from(mergedMap.values());
      const currentStatus = targetTable ? String(targetTable.status || '').toUpperCase() : 'NEW';
      const occupiedStatuses = ['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'RUNNING', 'PRINTED'];
      const isAlreadyOccupied = occupiedStatuses.includes(currentStatus);
      const newCreatedAt = isAlreadyOccupied && targetTable && targetTable.created_at ? targetTable.created_at : new Date().toISOString();
      
      // --- Prevent duplicate orders: Find existing active order for this table ---
      const activeOrders = statements.getOrdersByTable({ table_number: String(resolvedTableNum) });
      let result;
      
      if (activeOrders.length > 0) {
        const existingOrder = activeOrders[0];
        statements.updateOrderCart({
          id: existingOrder.id,
          items: JSON.stringify(mergedItems),
          notes: notes || '',
          status: 'NEW',
          customer_name: req.body.customer_name || req.body.customerName || '',
          phone: req.body.phone || req.body.customerPhone || req.body.customer_phone || '',
          gst_enabled: gst_enabled,
          gst_rate: gst_rate,
          service_charge_enabled: service_charge_enabled,
          service_charge_rate: service_charge_rate
        });
        result = { lastInsertRowid: existingOrder.id };
      } else {
        result = statements.insertOrder({
          table_number: String(resolvedTableNum),
          items: JSON.stringify(mergedItems),
          notes: notes || '',
          status: 'NEW',
          customer_name: req.body.customer_name || req.body.customerName || '',
          phone: req.body.phone || req.body.customerPhone || req.body.customer_phone || '',
          gst_enabled: gst_enabled,
          gst_rate: gst_rate,
          service_charge_enabled: service_charge_enabled,
          service_charge_rate: service_charge_rate,
          covers: req.body.covers || 1
        });
      }

      order = statements.getOrderById({ id: result.lastInsertRowid });
      if (order) order.items = JSON.parse(order.items);

      const io = req.app.get('io');
      
      statements.updateTable({
        id:          targetTable.id,
        status:      'OCCUPIED',
        order_items: JSON.stringify(mergedItems),
        created_at:  newCreatedAt,
        gst_enabled: finalGstEnabled,
        gst_rate: finalGstRate,
        service_charge_enabled: finalScEnabled,
        service_charge_rate: finalScRate
      });

      if (io) {
        const fullTable = normalizeTable(statements.getTableById({ id: targetTable.id }));
        // Emit order_updated (canonical running status)
        io.emit('order_updated', {
          ...fullTable,
          id:           String(targetTable.id),
          table_id:     String(targetTable.id),
          table_number: String(targetTable.table_number),
          items:        mergedItems,
          new_items:    normalizedItems.filter(i => i.status !== 'held'),
          total:        fullTable.total,
          status:       'kot_pending',
          startedAt:    new Date().toISOString(),
          is_new_kot:   printKOT !== false // Default to true if not specified, but respect explicit false
        });
        // Also emit full table_updated
        io.emit('table_updated', statements.getAllTables().map(normalizeTable));
        // Sync with digital KDS as a new KOT card
        syncKdsTicket(targetTable ? targetTable.table_number : resolvedTableNum, normalizedItems, io, true);
      }
    } catch (tableErr) {
      console.warn('[POST /api/orders] Table update warn:', tableErr.message);
    }

    // Enqueue for cloud sync (non-blocking)
    try { statements.enqueueSyncItem({ type: 'order_created', payload: order }); } catch (e) {}

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('[POST /api/orders] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create order' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/orders/fire — Fire held items for a table
// ─────────────────────────────────────────────────────────────
router.post('/fire', (req, res) => {
  try {
    const { tableId } = req.body;
    if (!tableId) return res.status(400).json({ error: 'tableId is required' });

    const table = statements.getTableById({ id: tableId });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const activeOrders = statements.getOrdersByTable({ table_number: table.table_number });
    if (activeOrders.length === 0) return res.status(400).json({ error: 'No active orders for this table' });

    const order = activeOrders[0];
    let items = [];
    try { items = JSON.parse(order.items || '[]'); } catch (e) {}

    let firedAny = false;
    items = items.map(i => {
      if (i.status === 'held') {
        firedAny = true;
        return { ...i, status: 'fired' };
      }
      return i;
    });

    if (firedAny) {
      statements.updateOrderCart({
        id: order.id,
        items: JSON.stringify(items),
        notes: order.notes || '',
        status: order.status,
        customer_name: order.customer_name || '',
        phone: order.phone || '',
        gst_enabled: order.gst_enabled,
        gst_rate: order.gst_rate,
        service_charge_enabled: order.service_charge_enabled,
        service_charge_rate: order.service_charge_rate
      });

      statements.updateTable({
        id: table.id,
        status: table.status,
        order_items: JSON.stringify(items),
        created_at: table.created_at,
        gst_enabled: table.gst_enabled,
        gst_rate: table.gst_rate,
        service_charge_enabled: table.service_charge_enabled,
        service_charge_rate: table.service_charge_rate
      });

      const io = req.app.get('io');
      if (io) {
        const fullTable = normalizeTable(statements.getTableById({ id: table.id }));
        io.emit('order_updated', {
          ...fullTable,
          id: String(table.id),
          table_id: String(table.id),
          table_number: String(table.table_number),
          order_id: order.id,
          items: items,
          new_items: items.filter(i => i.status === 'fired'), // Re-trigger KOT for fired items
          total: fullTable.total,
          status: 'kot_pending',
          is_new_kot: true
        });
        io.emit('table_updated', statements.getAllTables().map(normalizeTable));
      }
    }

    res.json({ success: true, fired: firedAny });
  } catch (err) {
    console.error('[POST /api/orders/fire] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/orders/:tableId — POS updates a table's cart
// ─────────────────────────────────────────────────────────────
router.put('/:tableId', (req, res) => {
  try {
    const { tableId } = req.params;
    const { items, status } = req.body;
    
    console.log(`[PUT /orders/${tableId}] Received payload:`, { 
      status: status, 
      gst_enabled: req.body.gst_enabled,
      items_count: items?.length 
    });

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'items must be an array' });
    }

    const isVirtual = String(tableId).toUpperCase().startsWith('TA-') || String(tableId).toUpperCase().startsWith('DL-') || String(tableId).toUpperCase().startsWith('DEL-') || String(tableId).toUpperCase().startsWith('ONL-') || String(tableId).toUpperCase().startsWith('TAK-');

    const allTables = statements.getAllTables();
    let targetTable = findTable(allTables, tableId);
    
    if (!targetTable && !isVirtual) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Prevent duplicate orders: Find existing active order for this table
    const resolvedTableNum = targetTable ? String(targetTable.table_number) : String(tableId);
    const activeOrders = statements.getOrdersByTable({ table_number: resolvedTableNum });
    let orderResult;

    if (activeOrders.length > 0) {
      // Update the most recent active order
      const existingOrder = activeOrders[0];
      statements.updateOrderCart({
        id: existingOrder.id,
        items: JSON.stringify(items),
        notes: req.body.note || '',
        status: (status || 'OCCUPIED').toUpperCase(),
        customer_name: req.body.customer_name || req.body.customerName || '',
        phone: req.body.phone || req.body.customerPhone || '',
        gst_enabled: req.body.gst_enabled,
        gst_rate: req.body.gst_rate,
        service_charge_enabled: req.body.service_charge_enabled,
        service_charge_rate: req.body.service_charge_rate
      });
      orderResult = { lastInsertRowid: existingOrder.id };
    } else {
      // Insert new order only if no active order exists
      orderResult = statements.insertOrder({
        table_number: resolvedTableNum,
        items: JSON.stringify(items),
        notes: req.body.note || '',
        status: (status || 'OCCUPIED').toUpperCase(),
        customer_name: req.body.customer_name || req.body.customerName || '',
        phone: req.body.phone || req.body.customerPhone || '',
        gst_enabled: req.body.gst_enabled,
        gst_rate: req.body.gst_rate,
        service_charge_enabled: req.body.service_charge_enabled,
        service_charge_rate: req.body.service_charge_rate,
        covers: req.body.covers || 1
      });
    }

    const dbStatus = (status || 'OCCUPIED').toUpperCase();
    const getQty = (i) => Number(i.qty !== undefined ? i.qty : (i.quantity !== undefined ? i.quantity : 1));
    const total = items.reduce((sum, i) => sum + (Number(i.price || 0) * getQty(i)), 0);

    if (targetTable) {
      const currentStatus = String(targetTable.status || '').toUpperCase();
      const occupiedStatuses = ['DRAFT', 'KOT_PENDING', 'KOT_PRINTED', 'BILLING', 'OCCUPIED', 'RUNNING', 'PRINTED'];
      const isAlreadyOccupied = occupiedStatuses.includes(currentStatus);
      const newCreatedAt = isAlreadyOccupied && targetTable.created_at ? targetTable.created_at : new Date().toISOString();

      const custName = req.body.customer_name || req.body.customerName || '';
      const custPhone = req.body.phone || req.body.customerPhone || '';

      statements.updateTable({
        id: targetTable.id,
        status: dbStatus,
        order_items: JSON.stringify(items),
        created_at: newCreatedAt,
        gst_enabled: req.body.gst_enabled,
        gst_rate: req.body.gst_rate,
        service_charge_enabled: req.body.service_charge_enabled,
        service_charge_rate: req.body.service_charge_rate,
        customer_name: custName,
        phone: custPhone
      });

      // Auto-save customer contact to CRM database if phone is provided
      if (custPhone && custPhone.length >= 10) {
        try {
          statements.registerCustomerContact(custPhone, custName);
          console.log(`👤 Customer contact ${custName} (${custPhone}) registered in CRM`);
        } catch (crmErr) {
          console.warn("CRM auto-save warning:", crmErr.message);
        }
      }
    }

    const io = req.app.get('io');
    if (io) {
      const fullTable = targetTable ? normalizeTable(statements.getTableById({ id: targetTable.id })) : null;
      const updatedTables = statements.getAllTables().map(normalizeTable);
      io.emit('table_updated', updatedTables);
      
      // Sync KDS ticket
      syncKdsTicket(targetTable ? targetTable.table_number : tableId, items, io);

      // Only emit order_updated (which triggers KOT print) when status is explicitly KOT_PENDING or KOT_PRINTED.
      // For OCCUPIED/DRAFT/BILLING we only emit table_updated (already done above).
      const kotStatuses = ['KOT_PENDING', 'KOT_PRINTED'];
      if (kotStatuses.includes(dbStatus)) {
        const finalGstEnabled = req.body.gst_enabled !== undefined ? req.body.gst_enabled : (targetTable ? targetTable.gst_enabled : false);
        const finalGstRate = req.body.gst_rate !== undefined ? req.body.gst_rate : (targetTable ? targetTable.gst_rate : 5);
        const finalScEnabled = req.body.service_charge_enabled !== undefined ? req.body.service_charge_enabled : (targetTable ? targetTable.service_charge_enabled : false);
        const finalScRate = req.body.service_charge_rate !== undefined ? req.body.service_charge_rate : (targetTable ? targetTable.service_charge_rate : 5);

        let prevItems = [];
        try { prevItems = JSON.parse(targetTable?.order_items || '[]'); } catch(e){}
        const newItemsDelta = [];
        for (const item of items) {
          const prev = prevItems.find(p => p.name === item.name && p.price === item.price);
          const prevQty = prev ? Number(prev.qty || prev.quantity || 1) : 0;
          const currentQty = Number(item.qty || item.quantity || 1);
          if (currentQty > prevQty) {
            newItemsDelta.push({ ...item, qty: currentQty - prevQty, quantity: currentQty - prevQty });
          }
        }

        io.emit('order_updated', {
          ...(fullTable || {}),
          id: targetTable ? String(targetTable.id) : String(tableId),
          table_id: targetTable ? String(targetTable.id) : String(tableId),
          table_number: resolvedTableNum,
          items: items,
          new_items: newItemsDelta.filter(i => i.status !== 'held'),
          total: fullTable ? fullTable.total : total,
          status: 'kot_pending',
          startedAt: new Date().toISOString(),
          is_new_kot: true,
          gst_enabled: finalGstEnabled,
          gst_rate: finalGstRate,
          service_charge_enabled: finalScEnabled,
          service_charge_rate: finalScRate
        });
      }
    }

    // --- Phase 2: CRM & Payments Logic ---
    if (['COMPLETED', 'PRINTED', 'PAID'].includes(dbStatus)) {
      const phone = req.body.phone || req.body.customerPhone || '';
      const name = req.body.customer_name || req.body.customerName || '';
      
      // 1. Multi-Tender Payments
      if (req.body.tenders && Array.isArray(req.body.tenders)) {
        for (const tender of req.body.tenders) {
          statements.insertPayment(orderResult.lastInsertRowid, tender.amount, tender.method);
        }
      } else if (req.body.splitPayments && Array.isArray(req.body.splitPayments)) {
        for (const tender of req.body.splitPayments) {
          statements.insertPayment(orderResult.lastInsertRowid, tender.amount, tender.method);
        }
      } else if (req.body.paymentMethod === 'Split' && (req.body.cashAmount || req.body.upiAmount)) {
        if (req.body.cashAmount) statements.insertPayment(orderResult.lastInsertRowid, req.body.cashAmount, 'Cash');
        if (req.body.upiAmount) statements.insertPayment(orderResult.lastInsertRowid, req.body.upiAmount, 'UPI');
      } else if (req.body.paymentMethod || req.body.payment_method) {
        statements.insertPayment(orderResult.lastInsertRowid, total, req.body.paymentMethod || req.body.payment_method);
      }

      // 2. CRM Upsert & Loyalty
      if (phone && phone.length >= 10) {
        statements.upsertCustomer(phone, name, total, req.body.redeemedPoints || 0);
      }
    }

    res.json({ success: true, message: 'Order updated successfully', items });
  } catch (err) {
    console.error(`[PUT /api/orders/${req.params.tableId}] Error:`, err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update order' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/orders — List orders, optionally filtered by status
// ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, table_number, limit = 50000, offset = 0 } = req.query;

    let orders;

    if (status) {
      const validStatuses = ['NEW', 'PREPARING', 'READY', 'SERVED', 'PRINTED', 'COMPLETED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({ 
          error: 'VALIDATION_ERROR', 
          message: `status must be one of: ${validStatuses.join(', ')}` 
        });
      }
      orders = statements.getOrdersByStatus({ 
        status: status.toUpperCase(),
        limit: parseInt(limit) || 50000,
        offset: parseInt(offset) || 0
      });
    } else if (table_number) {
      orders = statements.getOrdersByTable({ table_number: String(table_number) });
    } else {
      orders = statements.getAllOrders({ 
        limit: parseInt(limit) || 50000, 
        offset: parseInt(offset) || 0 
      });
    }

    // Parse items JSON for each order
    orders = orders.map(order => ({
      ...order,
      items: JSON.parse(order.items)
    }));

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    console.error('[GET /api/orders] Error:', err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to fetch orders' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/orders/:id — Get a single order by ID
// ─────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Order ID must be a number' 
      });
    }

    const order = statements.getOrderById({ id });
    if (!order) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: `Order #${id} not found` 
      });
    }

    order.items = JSON.parse(order.items);

    res.json({
      success: true,
      order
    });
  } catch (err) {
    console.error(`[GET /api/orders/${req.params.id}] Error:`, err);
    res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: 'Failed to fetch order' 
    });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/orders/:id — Update order status (real-time)
// ─────────────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const validStatuses = ['NEW', 'PREPARING', 'READY', 'SERVED', 'PRINTED', 'COMPLETED'];

    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ 
        error: 'VALIDATION_ERROR', 
        message: `status is required and must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Verify order exists
    const existing = statements.getOrderById({ id });
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update
    statements.updateOrderStatus({ id, status: status.toUpperCase() });

    // Return updated order
    const updated = statements.getOrderById({ id });
    if (updated) updated.items = JSON.parse(updated.items);

    // 📢 Emit Socket Event
    const io = req.app.get('io');
    if (io) {
      io.emit('order_updated', updated);
    }

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error(`[PATCH /api/orders/${req.params.id}] Error:`, err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Keep PUT for backward compatibility (it calls the same logic internally)
router.put('/:id/status', (req, res) => {
  // Transfer to PATCH logic essentially
  const id = parseInt(req.params.id);
  const { status } = req.body;
  
  statements.updateOrderStatus({ id, status: status.toUpperCase() });
  const updated = statements.getOrderById({ id });
  if (updated) updated.items = JSON.parse(updated.items);
  
  const io = req.app.get('io');
  if (io) io.emit('order_updated', updated);

  res.json({ success: true, order: updated });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/orders/:id — Delete an order
// ─────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '');
    if (!rawId || String(rawId).trim() === '') {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const id = isNaN(Number(rawId)) ? rawId : Number(rawId);

    // Delete order from database (handles numeric ID, string ID, table_number, or bill_number)
    statements.deleteOrder({ id });

    // Tell all connected POS clients to refresh order history
    const io = req.app.get('io');
    if (io) {
      io.emit('order_deleted', { id: rawId });
    }

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    console.error(`[DELETE /api/orders/${req.params.id}] Error:`, err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

export default router;
