export const formatCurrency = (value = 0) => 
  `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

export const getOrderTotal = (order = []) => 
  order.reduce((acc, item) => {
    const price = Number(item.price || 0);
    const qty = Number(item.qty || item.quantity || 0);
    return acc + (price * qty);
  }, 0);

export const getMinutesElapsed = (createdAt) => {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
};

export const getChannelLabel = (order = {}) => {
  if (order.type === 'Delivery' || String(order.id || order.tableId || '').startsWith('DEL-')) return 'Delivery';
  if (order.type === 'Takeaway' || String(order.id || order.tableId || '').startsWith('TA-')) return 'Takeaway';
  return 'Dine In';
};
