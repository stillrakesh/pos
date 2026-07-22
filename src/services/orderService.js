import { apiService } from './apiService';
import { BASE_URL } from '../constants';

/**
 * OrderService: Core business logic for POS orders and menu management.
 * This module isolates API calls and complex state transformations from the UI.
 */

// --- MENU / INVENTORY LOGIC ---

export async function addMenuItem(newItem, categories) {
  if (!newItem.name || !newItem.price || !newItem.category) {
    throw new Error("Please fill in Name, Price, and Category.");
  }

  const itemData = {
    ...newItem,
    price: parseFloat(newItem.price),
    available: true,
    inStock: true
  };

  try {
    const data = await apiService.createMenuItem(itemData);
    return { success: true, item: data.item };
  } catch (err) {
    console.warn("⚠️ Server sync failed, returning local item only.", err);
    return { success: true, item: { ...itemData, id: Date.now().toString() }, isOffline: true };
  }
}

export async function removeMenuItem(id) {
  try {
    await apiService.deleteMenuItem(id);
    return { success: true };
  } catch (err) {
    console.warn("⚠️ Server sync failed for deletion.", err);
    return { success: true, isOffline: true };
  }
}

export async function updateMenuStock(id, updates) {
  try {
    await apiService.updateMenuItem(id, updates);
    return { success: true };
  } catch (err) {
    console.warn("⚠️ Server sync failed for stock update.", err);
    return { success: true, isOffline: true };
  }
}

// --- CART / ORDERING LOGIC ---

/**
 * Pure function to calculate new cart state when adding an item.
 */
export function calculateAddToCart(item, currentCart, tables, nonTableOrders, currentTable, selectedModifier = null) {
  if (!item.inStock) return currentCart;

  // Stock check for retail items
  if (item.type === 'retail') {
    const currentCartQty = currentCart.reduce((acc, c) => c.id === item.id ? acc + c.qty : acc, 0);
    const otherReservedQty = getReservedStock(item.id, tables, nonTableOrders, currentTable?.id);
    const totalAvailable = item.stockQuantity - otherReservedQty;

    if (currentCartQty >= totalAvailable) {
      throw new Error(`Only ${totalAvailable} units available across all active orders.`);
    }
  }

  let finalPrice = item.price;
  let nameNote = '';
  let modIdStr = '';
  
  if (selectedModifier) {
    if (typeof selectedModifier === 'string') {
      nameNote = ` - ${selectedModifier}`;
      modIdStr = `-${selectedModifier}`;
      const priceMatch = selectedModifier.match(/\(\+₹(\d+)\)/);
      if (priceMatch) finalPrice += parseInt(priceMatch[1], 10);
    } else {
      // Rich modifier object { nameNote, priceDelta, modId }
      nameNote = selectedModifier.nameNote || '';
      modIdStr = selectedModifier.modId || '';
      finalPrice += (selectedModifier.priceDelta || 0);
    }
  }

  const cartItemId = `${item.id}${modIdStr}`;
  const existing = currentCart.find(i => i.cartItemId === cartItemId) 
    || (!selectedModifier && currentCart.find(i => i.name === (item.name + nameNote) && !i.cartItemId?.includes('-')));

  if (existing) {
    return currentCart.map(i => (i.cartItemId === existing.cartItemId || i.name === existing.name)
      ? { ...i, qty: i.qty + 1 } : i);
  } else {
    return [...currentCart, { ...item, cartItemId, name: item.name + nameNote, price: finalPrice, qty: 1 }];
  }
}

/**
 * Pure function to calculate new cart state when undoing last action.
 */
export function calculateUndo(currentCart) {
  if (currentCart.length === 0) return currentCart;
  
  const lastItem = currentCart[currentCart.length - 1];
  const unprintedQty = lastItem.qty - (lastItem.printedQty || 0);

  if (unprintedQty <= 0) {
    throw new Error("Cannot undo items already sent to kitchen (KOT).");
  }

  if (lastItem.qty > 1) {
    return currentCart.map((item, index) => 
      index === currentCart.length - 1 ? { ...item, qty: item.qty - 1 } : item
    );
  } else {
    return currentCart.slice(0, -1);
  }
}

/**
 * Background KOT sync handler.
 */
export async function syncKOT(tableId, cart, metadata) {
  try {
    await apiService.updateOrder(tableId, {
      items: cart,
      status: 'KOT_PENDING',
      ...metadata
    });
    return { success: true };
  } catch (err) {
    console.error("❌ Background KOT failed:", err);
    throw err;
  }
}

// --- HELPERS ---

function getReservedStock(itemId, tables, nonTableOrders, currentTableId) {
  let reserved = 0;
  (tables || []).forEach(t => {
    if (t.id !== currentTableId) {
      (t.orders || []).forEach(i => {
        if (i.id === itemId) reserved += i.qty;
      });
    }
  });
  (nonTableOrders || []).forEach(o => {
    if (o.id !== currentTableId) {
      (o.orders || []).forEach(i => {
        if (i.id === itemId) reserved += i.qty;
      });
    }
  });
  return reserved;
}
