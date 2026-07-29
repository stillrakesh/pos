import React, { useState, useEffect } from 'react';
import { Package, Settings, Plus, Edit2, Trash2, AlertTriangle, Link as LinkIcon, Check, X, Search } from 'lucide-react';
import apiService from '../../services/apiService';
import { formatCurrency } from '../../utils/formatters';

const InventoryManager = ({ menuItems = [] }) => {
  const [tab, setTab] = useState('materials'); // materials, recipes
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Forms
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [selectedMenuItem, setSelectedMenuItem] = useState('');
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, recRes] = await Promise.all([
        apiService.fetchInventoryItems(),
        apiService.fetchRecipes()
      ]);
      if (invRes.success) setItems(invRes.items || []);
      if (recRes.success) setRecipes(recRes.recipes || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // --- RAW MATERIALS ---
  const handleSaveItem = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      unit: formData.get('unit'),
      current_stock: parseFloat(formData.get('current_stock')) || 0,
      low_stock_threshold: parseFloat(formData.get('low_stock_threshold')) || 0,
      cost_per_unit: parseFloat(formData.get('cost_per_unit')) || 0
    };

    try {
      if (editingItem) {
        await apiService.updateInventoryItem(editingItem.id, data);
      } else {
        await apiService.createInventoryItem(data);
      }
      setShowItemModal(false);
      setEditingItem(null);
      loadData();
    } catch (e) {
      alert("Failed to save inventory item.");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Delete this inventory item? It will also remove it from any recipes.")) return;
    await apiService.deleteInventoryItem(id);
    loadData();
  };

  // --- RECIPES ---
  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    if (!selectedMenuItem) return alert("Select a menu item first.");
    const formData = new FormData(e.target);
    const inventoryItemId = formData.get('inventory_item_id');
    const quantity = parseFloat(formData.get('quantity_required'));
    
    if (!inventoryItemId || !quantity) return;

    try {
      await apiService.upsertRecipe(selectedMenuItem, inventoryItemId, quantity);
      setShowRecipeModal(false);
      loadData();
    } catch (e) {
      alert("Failed to save recipe link.");
    }
  };

  const handleRemoveRecipe = async (menuItemId, inventoryItemId) => {
    if (!window.confirm("Remove this ingredient from the recipe?")) return;
    await apiService.removeRecipeItem(menuItemId, inventoryItemId);
    loadData();
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  // Low stock alerts
  const lowStockItems = items.filter(i => i.current_stock <= i.low_stock_threshold);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', padding: 24, overflow: 'auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>Inventory & Recipes</h2>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Manage raw materials and track recipe costing.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {lowStockItems.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontWeight: 800 }}>
              <AlertTriangle size={18} />
              {lowStockItems.length} Items Low on Stock
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>
        <button 
          onClick={() => setTab('materials')}
          style={{ padding: '8px 16px', borderRadius: 8, background: tab === 'materials' ? '#0f172a' : 'transparent', color: tab === 'materials' ? 'white' : '#64748b', fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Package size={16} /> Raw Materials
        </button>
        <button 
          onClick={() => setTab('recipes')}
          style={{ padding: '8px 16px', borderRadius: 8, background: tab === 'recipes' ? '#0f172a' : 'transparent', color: tab === 'recipes' ? 'white' : '#64748b', fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <LinkIcon size={16} /> Recipe Builder
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
      ) : (
        <>
          {/* TAB 1: RAW MATERIALS */}
          {tab === 'materials' && (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ position: 'relative', width: 300 }}>
                  <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 10 }} />
                  <input 
                    placeholder="Search materials..." 
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
                <button 
                  onClick={() => { setEditingItem(null); setShowItemModal(true); }}
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={16} /> Add Material
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: 12 }}>Name</th>
                    <th style={{ padding: 12 }}>In Stock</th>
                    <th style={{ padding: 12 }}>Unit</th>
                    <th style={{ padding: 12 }}>Cost/Unit</th>
                    <th style={{ padding: 12 }}>Status</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const isLow = item.current_stock <= item.low_stock_threshold;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: 12, fontWeight: 700 }}>{item.name}</td>
                        <td style={{ padding: 12, fontWeight: 900, color: isLow ? '#ef4444' : '#1e293b' }}>
                          {item.current_stock}
                        </td>
                        <td style={{ padding: 12, color: '#64748b' }}>{item.unit}</td>
                        <td style={{ padding: 12, fontWeight: 700 }}>{formatCurrency(item.cost_per_unit)}</td>
                        <td style={{ padding: 12 }}>
                          {isLow ? (
                            <span style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>Low Stock</span>
                          ) : (
                            <span style={{ background: '#f0fdf4', color: '#10b981', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>Healthy</span>
                          )}
                        </td>
                        <td style={{ padding: 12, textAlign: 'right' }}>
                          <button onClick={() => { setEditingItem(item); setShowItemModal(true); }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginRight: 12 }}><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredItems.length === 0 && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No materials found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: RECIPE BUILDER */}
          {tab === 'recipes' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
              {/* Menu Item Selector */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 16 }}>Select Menu Item</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
                  {menuItems.map(mi => {
                    const ingCount = recipes.filter(r => r.menu_item_id === mi.id).length;
                    const isSelected = selectedMenuItem === mi.id;
                    return (
                      <div 
                        key={mi.id} 
                        onClick={() => setSelectedMenuItem(mi.id)}
                        style={{ padding: 12, borderRadius: 10, cursor: 'pointer', border: `2px solid ${isSelected ? '#3b82f6' : '#f1f5f9'}`, background: isSelected ? '#eff6ff' : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{mi.name}</span>
                        {ingCount > 0 && <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{ingCount} INGREDIENTS</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recipe View */}
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
                {selectedMenuItem ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 900 }}>Recipe: {menuItems.find(m => m.id === selectedMenuItem)?.name}</h3>
                      <button 
                        onClick={() => setShowRecipeModal(true)}
                        style={{ background: '#0f172a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Plus size={16} /> Link Ingredient
                      </button>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: 12 }}>Ingredient</th>
                          <th style={{ padding: 12 }}>Quantity Required</th>
                          <th style={{ padding: 12 }}>Cost Contribution</th>
                          <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipes.filter(r => r.menu_item_id === selectedMenuItem).map(r => {
                          const ing = items.find(i => i.id === r.inventory_item_id);
                          if (!ing) return null;
                          const cost = r.quantity_required * ing.cost_per_unit;
                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: 12, fontWeight: 700 }}>{ing.name}</td>
                              <td style={{ padding: 12, fontWeight: 900 }}>{r.quantity_required} {ing.unit}</td>
                              <td style={{ padding: 12, fontWeight: 700, color: '#ef4444' }}>{formatCurrency(cost)}</td>
                              <td style={{ padding: 12, textAlign: 'right' }}>
                                <button onClick={() => handleRemoveRecipe(selectedMenuItem, ing.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          )
                        })}
                        {recipes.filter(r => r.menu_item_id === selectedMenuItem).length === 0 && (
                          <tr><td colSpan="4" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No ingredients linked to this item.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <LinkIcon size={48} style={{ marginBottom: 16 }} />
                    <h3 style={{ fontSize: 18, fontWeight: 900 }}>Select a menu item</h3>
                    <p style={{ color: '#64748b', marginTop: 8 }}>Click a menu item on the left to view and build its recipe.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* --- MODALS --- */}

      {/* Raw Material Modal */}
      {showItemModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'white', padding: 32, borderRadius: 24, width: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>{editingItem ? 'Edit Material' : 'Add Material'}</h3>
            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>NAME</label>
                <input name="name" defaultValue={editingItem?.name} required placeholder="e.g. Tomato Sauce" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>UNIT (e.g. Kg, L, Pcs)</label>
                  <input name="unit" defaultValue={editingItem?.unit} required placeholder="kg" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>COST PER UNIT (₹)</label>
                  <input name="cost_per_unit" type="number" step="0.01" defaultValue={editingItem?.cost_per_unit} required style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>CURRENT STOCK</label>
                  <input name="current_stock" type="number" step="0.01" defaultValue={editingItem?.current_stock} required style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>LOW STOCK THRESHOLD</label>
                  <input name="low_stock_threshold" type="number" step="0.01" defaultValue={editingItem?.low_stock_threshold} required style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowItemModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#10b981', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Save Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {showRecipeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'white', padding: 32, borderRadius: 24, width: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>Link Ingredient</h3>
            <form onSubmit={handleSaveRecipe} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>SELECT MATERIAL</label>
                <select name="inventory_item_id" required style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}>
                  <option value="">-- Choose Material --</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>QUANTITY REQUIRED PER PORTION</label>
                <input name="quantity_required" type="number" step="0.001" required placeholder="e.g. 0.15 for 150g" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }} />
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Must match the unit of the material.</p>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowRecipeModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Link to Recipe</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default InventoryManager;
