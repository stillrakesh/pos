import React, { useState, useEffect } from 'react';
import { 
  FileText, Printer, Layers, Eye, Save, Settings2, ArrowUp, ArrowDown, 
  Trash2, Plus, Copy, CheckCircle, Smartphone, Layout
} from 'lucide-react';

const BUILT_IN_TEMPLATES = [
  {
    id: 'builtin-classic-bill',
    name: 'Classic',
    type: 'bill',
    isBuiltIn: true,
    paperWidth: 80, // mm
    sections: [
      { id: 's1', type: 'header', visible: true, order: 1, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 }, data: { showLogo: false, text: 'TYDE CAFE', address: 'Nerul Ferry Terminal\nContact: +91 9999999999', showGst: false, gstNumber: '' } },
      { id: 's2', type: 'orderInfo', visible: true, order: 2, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left', marginBottom: 5 }, data: { showBillNo: true, showTableNo: true, showOrderType: true, showDateTime: true } },
      { id: 's3', type: 'customerInfo', visible: true, order: 3, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left', marginBottom: 5 }, data: { showName: true, showMobile: true } },
      { id: 's4', type: 'itemList', visible: true, order: 4, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left', marginBottom: 5 }, data: { showQty: true, showPrice: true, showTotal: true } },
      { id: 's5', type: 'charges', visible: true, order: 5, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right', marginBottom: 5 }, data: { showGst: true, showServiceCharge: true } },
      { id: 's6', type: 'totalSummary', visible: true, order: 6, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 }, data: {} },
      { id: 's7', type: 'footer', visible: true, order: 7, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center', marginBottom: 0 }, data: { text: 'Thank you for visiting!\nSee you soon.' } }
    ]
  },
  {
    id: 'builtin-compact-bill',
    name: 'Compact',
    type: 'bill',
    isBuiltIn: true,
    paperWidth: 58, // mm
    sections: [
      { id: 's1', type: 'header', visible: true, order: 1, style: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 }, data: { showLogo: false, text: 'TYDE CAFE', address: 'Nerul', showGst: false, gstNumber: '' } },
      { id: 's2', type: 'orderInfo', visible: true, order: 2, style: { fontSize: 10, fontWeight: 'normal', textAlign: 'left', marginBottom: 2 }, data: { showBillNo: true, showTableNo: true, showOrderType: false, showDateTime: true } },
      { id: 's3', type: 'customerInfo', visible: false, order: 3, style: { fontSize: 10, fontWeight: 'normal', textAlign: 'left', marginBottom: 2 }, data: { showName: true, showMobile: false } },
      { id: 's4', type: 'itemList', visible: true, order: 4, style: { fontSize: 10, fontWeight: 'normal', textAlign: 'left', marginBottom: 2 }, data: { showQty: true, showPrice: false, showTotal: true } },
      { id: 's5', type: 'charges', visible: true, order: 5, style: { fontSize: 10, fontWeight: 'normal', textAlign: 'right', marginBottom: 2 }, data: { showGst: true, showServiceCharge: true } },
      { id: 's6', type: 'totalSummary', visible: true, order: 6, style: { fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 }, data: {} },
      { id: 's7', type: 'footer', visible: true, order: 7, style: { fontSize: 10, fontWeight: 'normal', textAlign: 'center', marginBottom: 0 }, data: { text: 'Thank you!' } }
    ]
  },
  {
    id: 'builtin-classic-kot',
    name: 'Classic KOT',
    type: 'kot',
    isBuiltIn: true,
    paperWidth: 80,
    sections: [
      { id: 's1', type: 'header', visible: true, order: 1, style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }, data: { text: 'KOT' } },
      { id: 's2', type: 'orderInfo', visible: true, order: 2, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'left', marginBottom: 10 }, data: { showBillNo: false, showTableNo: true, showOrderType: true, showDateTime: true } },
      { id: 's4', type: 'itemList', visible: true, order: 3, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'left', marginBottom: 5 }, data: { showQty: true, showPrice: false, showTotal: false } },
    ]
  }
];

const BillDesigner = ({ settings, onSaveSettings }) => {
  const [templates, setTemplates] = useState([]);
  const [activeType, setActiveType] = useState('bill'); // 'bill', 'takeaway', 'kot'
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Initialize templates from settings or use built-in
  useEffect(() => {
    let savedTemplates = settings.printTemplates || [];
    if (savedTemplates.length === 0) {
      savedTemplates = [...BUILT_IN_TEMPLATES];
    }
    setTemplates(savedTemplates);
    
    // Select default active template for the current type
    const defaultForType = savedTemplates.find(t => t.type === activeType && t.isDefault) || savedTemplates.find(t => t.type === activeType);
    if (defaultForType) {
      setActiveTemplateId(defaultForType.id);
      setEditingTemplate(JSON.parse(JSON.stringify(defaultForType)));
    }
  }, [settings.printTemplates, activeType]);

  const handleTypeChange = (type) => {
    setActiveType(type);
  };

  const handleTemplateChange = (e) => {
    const id = e.target.value;
    setActiveTemplateId(id);
    const tmpl = templates.find(t => t.id === id);
    if (tmpl) setEditingTemplate(JSON.parse(JSON.stringify(tmpl)));
  };

  const saveTemplate = () => {
    let newTemplates = [...templates];
    const index = newTemplates.findIndex(t => t.id === editingTemplate.id);
    if (index >= 0) {
      newTemplates[index] = editingTemplate;
    } else {
      newTemplates.push(editingTemplate);
    }
    setTemplates(newTemplates);
    onSaveSettings({ ...settings, printTemplates: newTemplates });
    alert("Template saved successfully!");
  };

  const createNewTemplate = () => {
    const name = prompt("Enter new template name:");
    if (!name) return;
    
    const newId = `custom-${Date.now()}`;
    const newTmpl = {
      ...JSON.parse(JSON.stringify(editingTemplate)),
      id: newId,
      name: name,
      isBuiltIn: false,
      isDefault: false
    };
    
    setTemplates([...templates, newTmpl]);
    setActiveTemplateId(newId);
    setEditingTemplate(newTmpl);
  };

  const deleteTemplate = () => {
    if (editingTemplate.isBuiltIn) return alert("Cannot delete built-in templates.");
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    
    const newTemplates = templates.filter(t => t.id !== editingTemplate.id);
    setTemplates(newTemplates);
    onSaveSettings({ ...settings, printTemplates: newTemplates });
    
    const fallback = newTemplates.find(t => t.type === activeType);
    if (fallback) {
      setActiveTemplateId(fallback.id);
      setEditingTemplate(JSON.parse(JSON.stringify(fallback)));
    }
  };

  const setAsDefault = () => {
    const newTemplates = templates.map(t => {
      if (t.type === activeType) {
        return { ...t, isDefault: t.id === editingTemplate.id };
      }
      return t;
    });
    setTemplates(newTemplates);
    onSaveSettings({ ...settings, printTemplates: newTemplates });
    alert(`${editingTemplate.name} is now the default template for ${activeType.toUpperCase()}.`);
  };

  const moveSection = (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === editingTemplate.sections.length - 1) return;
    
    const newSections = [...editingTemplate.sections];
    const temp = newSections[index];
    newSections[index] = newSections[index + direction];
    newSections[index + direction] = temp;
    
    // Update order property
    newSections.forEach((s, i) => s.order = i + 1);
    
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  const updateSectionStyle = (index, key, value) => {
    const newSections = [...editingTemplate.sections];
    newSections[index].style[key] = value;
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  const updateSectionData = (index, key, value) => {
    const newSections = [...editingTemplate.sections];
    newSections[index].data[key] = value;
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  const toggleSectionVisibility = (index) => {
    const newSections = [...editingTemplate.sections];
    newSections[index].visible = !newSections[index].visible;
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  // --- UI RENDERERS ---

  const renderSectionControls = (section, index) => {
    return (
      <div key={section.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => toggleSectionVisibility(index)}
              style={{ width: '40px', height: '24px', borderRadius: '12px', background: section.visible ? '#10b981' : '#e2e8f0', position: 'relative', cursor: 'pointer', border: 'none', transition: 'all 0.3s' }}
            >
              <div style={{ position: 'absolute', top: '2px', left: section.visible ? '18px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'all 0.3s' }} />
            </button>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e293b', textTransform: 'capitalize' }}>
              {section.type.replace(/([A-Z])/g, ' $1').trim()}
            </h4>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => moveSection(index, -1)} disabled={index === 0} style={{ padding: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.5 : 1 }}>
              <ArrowUp size={16} color="#64748b" />
            </button>
            <button onClick={() => moveSection(index, 1)} disabled={index === editingTemplate.sections.length - 1} style={{ padding: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: index === editingTemplate.sections.length - 1 ? 'not-allowed' : 'pointer', opacity: index === editingTemplate.sections.length - 1 ? 0.5 : 1 }}>
              <ArrowDown size={16} color="#64748b" />
            </button>
          </div>
        </div>

        {section.visible && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
            
            {/* Style Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Font Size</label>
                <input type="number" value={section.style.fontSize} onChange={(e) => updateSectionStyle(index, 'fontSize', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Weight</label>
                <select value={section.style.fontWeight} onChange={(e) => updateSectionStyle(index, 'fontWeight', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Align</label>
                <select value={section.style.textAlign} onChange={(e) => updateSectionStyle(index, 'textAlign', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            {/* Data Controls based on type */}
            {section.type === 'header' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Title Text</label>
                  <input type="text" value={section.data.text} onChange={(e) => updateSectionData(index, 'text', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Address / Contact Info</label>
                  <textarea value={section.data.address || ''} onChange={(e) => updateSectionData(index, 'address', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', minHeight: '60px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={section.data.showGst} onChange={(e) => updateSectionData(index, 'showGst', e.target.checked)} />
                  <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>Show GST Number</span>
                </div>
                {section.data.showGst && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>GST Number</label>
                    <input type="text" value={section.data.gstNumber || ''} onChange={(e) => updateSectionData(index, 'gstNumber', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                )}
              </>
            )}

            {section.type === 'orderInfo' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showBillNo} onChange={(e) => updateSectionData(index, 'showBillNo', e.target.checked)} /> Show Bill No</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showTableNo} onChange={(e) => updateSectionData(index, 'showTableNo', e.target.checked)} /> Show Table No</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showOrderType} onChange={(e) => updateSectionData(index, 'showOrderType', e.target.checked)} /> Show Order Type</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showDateTime} onChange={(e) => updateSectionData(index, 'showDateTime', e.target.checked)} /> Show Date/Time</label>
              </div>
            )}

            {section.type === 'customerInfo' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showName} onChange={(e) => updateSectionData(index, 'showName', e.target.checked)} /> Show Name</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showMobile} onChange={(e) => updateSectionData(index, 'showMobile', e.target.checked)} /> Show Mobile</label>
              </div>
            )}

            {section.type === 'itemList' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showQty} onChange={(e) => updateSectionData(index, 'showQty', e.target.checked)} /> Show Quantity</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showPrice} onChange={(e) => updateSectionData(index, 'showPrice', e.target.checked)} /> Show Price/Unit</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showTotal} onChange={(e) => updateSectionData(index, 'showTotal', e.target.checked)} /> Show Item Total</label>
              </div>
            )}

            {section.type === 'charges' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showGst} onChange={(e) => updateSectionData(index, 'showGst', e.target.checked)} /> Show GST Breakdown</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showServiceCharge} onChange={(e) => updateSectionData(index, 'showServiceCharge', e.target.checked)} /> Show Service Charge</label>
              </div>
            )}

            {section.type === 'footer' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Footer Message</label>
                <textarea value={section.data.text || ''} onChange={(e) => updateSectionData(index, 'text', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', minHeight: '60px' }} />
              </div>
            )}

          </div>
        )}
      </div>
    );
  };

  const renderLivePreview = () => {
    if (!editingTemplate) return null;

    // Sample mock data for preview
    const mockOrder = {
      billNo: 'INV-4021', table: 'T-12', type: 'Dine In', date: '21/04/24 19:30',
      customer: 'John Doe', mobile: '+91 9876543210',
      items: [
        { name: 'Paneer Tikka Masala', qty: 1, price: 320, total: 320 },
        { name: 'Garlic Naan', qty: 3, price: 50, total: 150 },
        { name: 'Fresh Lime Soda', qty: 2, price: 90, total: 180 }
      ],
      subtotal: 650, gst: 32.50, serviceCharge: 32.50, total: 715
    };

    return (
      <div style={{ 
        width: `${editingTemplate.paperWidth * 4}px`, // scaled for preview
        background: 'white', 
        padding: '20px', 
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', 
        border: '1px solid #e2e8f0', 
        color: '#000', 
        fontFamily: 'monospace',
        margin: '0 auto',
        minHeight: '400px'
      }}>
        {editingTemplate.sections.filter(s => s.visible).sort((a,b) => a.order - b.order).map((section) => {
          const sStyle = { ...section.style, fontSize: `${section.style.fontSize}px` };

          switch (section.type) {
            case 'header':
              return (
                <div key={section.id} style={{ ...sStyle, paddingBottom: '10px', borderBottom: '1px dashed #ccc', marginBottom: '10px' }}>
                  {section.data.showLogo && <div style={{ border: '1px solid #ccc', padding: '10px', display: 'inline-block', marginBottom: '5px' }}>[LOGO]</div>}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{section.data.text}</div>
                  {section.data.address && <div style={{ fontSize: '0.85em', whiteSpace: 'pre-wrap', marginTop: '4px' }}>{section.data.address}</div>}
                  {section.data.showGst && section.data.gstNumber && <div style={{ fontSize: '0.85em', marginTop: '4px' }}>GSTIN: {section.data.gstNumber}</div>}
                </div>
              );
            case 'orderInfo':
              return (
                <div key={section.id} style={{ ...sStyle, paddingBottom: '10px', borderBottom: '1px dashed #ccc', marginBottom: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    {section.data.showBillNo && <div>Bill No: {mockOrder.billNo}</div>}
                    {section.data.showTableNo && <div>Table: {mockOrder.table}</div>}
                    {section.data.showOrderType && <div>Type: {mockOrder.type}</div>}
                    {section.data.showDateTime && <div>Date: {mockOrder.date}</div>}
                  </div>
                </div>
              );
            case 'customerInfo':
              return (
                <div key={section.id} style={{ ...sStyle, paddingBottom: '10px', borderBottom: '1px dashed #ccc', marginBottom: '10px' }}>
                  {section.data.showName && <div>Customer: {mockOrder.customer}</div>}
                  {section.data.showMobile && <div>Mobile: {mockOrder.mobile}</div>}
                </div>
              );
            case 'itemList':
              return (
                <div key={section.id} style={{ ...sStyle, paddingBottom: '10px', borderBottom: '1px dashed #ccc', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '4px', fontWeight: 'bold' }}>
                    <div style={{ flex: 1 }}>ITEM</div>
                    {section.data.showQty && <div style={{ width: '40px', textAlign: 'center' }}>QTY</div>}
                    {section.data.showPrice && <div style={{ width: '60px', textAlign: 'right' }}>PRICE</div>}
                    {section.data.showTotal && <div style={{ width: '60px', textAlign: 'right' }}>AMT</div>}
                  </div>
                  {mockOrder.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', marginBottom: '4px' }}>
                      <div style={{ flex: 1 }}>{item.name}</div>
                      {section.data.showQty && <div style={{ width: '40px', textAlign: 'center' }}>{item.qty}</div>}
                      {section.data.showPrice && <div style={{ width: '60px', textAlign: 'right' }}>{item.price}</div>}
                      {section.data.showTotal && <div style={{ width: '60px', textAlign: 'right' }}>{item.total}</div>}
                    </div>
                  ))}
                </div>
              );
            case 'charges':
              return (
                <div key={section.id} style={{ ...sStyle, paddingBottom: '10px', borderBottom: '1px dashed #ccc', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Subtotal</span>
                    <span>{mockOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {section.data.showServiceCharge && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Service Charge (5%)</span>
                      <span>{mockOrder.serviceCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {section.data.showGst && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>GST (5%)</span>
                      <span>{mockOrder.gst.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            case 'totalSummary':
              return (
                <div key={section.id} style={{ ...sStyle, paddingBottom: '10px', borderBottom: '1px dashed #ccc', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', paddingTop: '5px' }}>
                    <span>GRAND TOTAL</span>
                    <span>₹{mockOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              );
            case 'footer':
              return (
                <div key={section.id} style={{ ...sStyle, whiteSpace: 'pre-wrap' }}>
                  {section.data.text}
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      {/* Top Nav */}
      <div style={{ background: 'white', padding: '16px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['bill', 'takeaway', 'kot'].map(type => (
            <button 
              key={type}
              onClick={() => handleTypeChange(type)}
              style={{
                padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', border: 'none',
                background: activeType === type ? '#94161c' : '#f1f5f9',
                color: activeType === type ? 'white' : '#64748b',
                textTransform: 'uppercase'
              }}
            >
              {type === 'kot' ? 'KOT Designer' : `${type} Designer`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={saveTemplate} style={{ padding: '10px 20px', borderRadius: '10px', background: '#10b981', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} /> Save Template
          </button>
          <button onClick={() => onSaveSettings(settings)} style={{ padding: '10px 20px', borderRadius: '10px', background: '#1e293b', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> Done
          </button>
        </div>
      </div>

      {editingTemplate && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Column: Template Manager & Settings */}
          <div style={{ width: '450px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            
            {/* Template Selector */}
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Current Template</label>
              <select value={activeTemplateId || ''} onChange={handleTemplateChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                {templates.filter(t => t.type === activeType).map(t => (
                  <option key={t.id} value={t.id}>{t.name} {t.isDefault ? '(Default)' : ''} {t.isBuiltIn ? '(Built-in)' : ''}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={createNewTemplate} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Copy size={14} /> Duplicate
                </button>
                <button onClick={setAsDefault} disabled={editingTemplate.isDefault} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: editingTemplate.isDefault ? 'not-allowed' : 'pointer', opacity: editingTemplate.isDefault ? 0.5 : 1 }}>
                  Set Default
                </button>
                <button onClick={deleteTemplate} disabled={editingTemplate.isBuiltIn} style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', cursor: editingTemplate.isBuiltIn ? 'not-allowed' : 'pointer', opacity: editingTemplate.isBuiltIn ? 0.5 : 1 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Layout Options */}
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0' }}>
               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Paper Width</label>
               <div style={{ display: 'flex', gap: '12px' }}>
                 <button onClick={() => setEditingTemplate({...editingTemplate, paperWidth: 80})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', borderColor: editingTemplate.paperWidth === 80 ? '#94161c' : '#e2e8f0', background: editingTemplate.paperWidth === 80 ? '#fdf2f2' : 'white', color: editingTemplate.paperWidth === 80 ? '#94161c' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>80 mm</button>
                 <button onClick={() => setEditingTemplate({...editingTemplate, paperWidth: 58})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', borderColor: editingTemplate.paperWidth === 58 ? '#94161c' : '#e2e8f0', background: editingTemplate.paperWidth === 58 ? '#fdf2f2' : 'white', color: editingTemplate.paperWidth === 58 ? '#94161c' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>58 mm</button>
               </div>
            </div>

            {/* Section Controls */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="no-scrollbar">
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Layout size={16}/> Section Blocks</h3>
              {editingTemplate.sections.sort((a,b) => a.order - b.order).map((section, index) => renderSectionControls(section, index))}
            </div>
          </div>

          {/* Right Column: Live Preview */}
          <div style={{ flex: 1, background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '40px 0' }} className="no-scrollbar">
             <div style={{ background: '#1e293b', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={14}/> LIVE PREVIEW
             </div>
             {renderLivePreview()}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillDesigner;
