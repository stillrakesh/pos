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
    global: { marginTop: 0, marginBottom: 0, marginLeft: 5, marginRight: 5, sectionSpacing: 1, fontFamily: 'Verdana' },
    printBehavior: { autoPrint: false, copies: 1 },
    sections: [
      { id: 's1', type: 'header', visible: true, order: 1, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, layout: 'full' }, data: { showLogo: false, text: 'Tyde Cafe', address: 'Nerul Ferry Terminal', showGst: false, gstNumber: '' } },
      { id: 's3', type: 'customerInfo', visible: true, order: 2, style: { fontSize: 13, fontWeight: 'normal', textAlign: 'left', marginBottom: 5, layout: 'full' }, data: { showName: true, showMobile: false } },
      { id: 's2', type: 'orderInfo', visible: true, order: 3, style: { fontSize: 13, fontWeight: 'normal', textAlign: 'left', marginBottom: 5, layout: 'full' }, data: { showBillNo: true, showTableNo: true, showOrderType: true, showDateTime: true } },
      { id: 's4', type: 'itemList', visible: true, order: 4, style: { fontSize: 13, fontWeight: 'normal', textAlign: 'left', marginBottom: 5, layout: 'full' }, data: { showQty: true, showPrice: true, showTotal: true, colQty: 4, colPrice: 8, colTotal: 8, qtyBeforeName: false, showNotes: true, mergeDuplicates: false, headerFontSize: 13 } },
      { id: 's5', type: 'charges', visible: true, order: 5, style: { fontSize: 13, fontWeight: 'normal', textAlign: 'right', marginBottom: 5, layout: 'full' }, data: { showGst: false, showServiceCharge: true, totalQtyFontSize: 13, serviceChargeFontSize: 13 } },
      { id: 's6', type: 'totalSummary', visible: true, order: 6, style: { fontSize: 14, fontWeight: '900', textAlign: 'right', marginBottom: 10, layout: 'full' }, data: { roundOffFontSize: 11 } },
      { id: 's7', type: 'footer', visible: true, order: 7, style: { fontSize: 13, fontWeight: 'normal', textAlign: 'center', marginBottom: 0, layout: 'full' }, data: { text: 'Sea you soon — under the moon' } }
    ]
  },
  {
    id: 'builtin-compact-bill',
    name: 'Compact',
    type: 'bill',
    isBuiltIn: true,
    paperWidth: 58, // mm
    global: { marginTop: 0, marginBottom: 4, marginLeft: 0, marginRight: 0, sectionSpacing: 1, fontFamily: 'Verdana' },
    printBehavior: { autoPrint: false, copies: 1 },
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
    id: 'builtin-legacy-match',
    name: 'Classic Legacy (Screenshot Match)',
    type: 'bill',
    isBuiltIn: true,
    paperWidth: 80,
    global: { marginTop: 0, marginBottom: 4, marginLeft: 0, marginRight: 0, sectionSpacing: 1, fontFamily: 'Verdana' },
    printBehavior: { autoPrint: false, copies: 1 },
    sections: [
      { id: 's1', type: 'header', visible: true, order: 1, style: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, layout: 'full' }, data: { showLogo: false, text: 'Tyde Cafe', address: 'Nerul Ferry Terminal', showGst: false, gstNumber: '' } },
      { id: 's3', type: 'customerInfo', visible: true, order: 2, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left', marginBottom: 5, layout: 'full' }, data: { showName: true, showMobile: false } },
      { id: 's2', type: 'orderInfo', visible: true, order: 3, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left', marginBottom: 5, layout: 'half-left' }, data: { showBillNo: false, showTableNo: false, showOrderType: false, showDateTime: true } },
      { id: 's2_right', type: 'orderInfo', visible: true, order: 4, style: { fontSize: 12, fontWeight: 'bold', textAlign: 'left', marginBottom: 5, layout: 'half-right' }, data: { showBillNo: true, showTableNo: true, showOrderType: true, showDateTime: false } },
      { id: 's4', type: 'itemList', visible: true, order: 5, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'left', marginBottom: 5, layout: 'full' }, data: { showQty: true, showPrice: true, showTotal: true } },
      { id: 's5', type: 'charges', visible: true, order: 6, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'right', marginBottom: 5, layout: 'full' }, data: { showGst: false, showServiceCharge: true } },
      { id: 's6', type: 'totalSummary', visible: true, order: 7, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginBottom: 10, layout: 'full' }, data: {} },
      { id: 's7', type: 'footer', visible: true, order: 8, style: { fontSize: 12, fontWeight: 'normal', textAlign: 'center', marginBottom: 0, layout: 'full' }, data: { text: 'Sea you soon — under the moon' } }
    ]
  },
  {
    id: 'builtin-classic-kot',
    name: 'Classic KOT',
    type: 'kot',
    isBuiltIn: true,
    paperWidth: 80,
    global: { marginTop: 0, marginBottom: 4, marginLeft: 0, marginRight: 0, sectionSpacing: 1, fontFamily: 'Verdana', separatorChar: '.' },
    printBehavior: { autoPrint: false, copies: 1 },
    sections: [
      { id: 's1', type: 'header', visible: true, order: 1, style: { fontSize: 14, fontWeight: 'normal', textAlign: 'center', marginBottom: 2 }, data: { text: 'Running Table' } },
      { id: 's2', type: 'orderInfo', visible: true, order: 2, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 }, data: { showBillNo: true, showTableNo: true, showOrderType: true, showDateTime: true } },
      { id: 's4', type: 'itemList', visible: true, order: 3, style: { fontSize: 13, fontWeight: 'normal', textAlign: 'left', marginBottom: 5 }, data: { showQty: true, showPrice: false, showTotal: false, showNoteCol: true, colNote: 15, showNotes: true } },
    ]
  }
];

const BillDesigner = ({ settings, onSaveSettings }) => {
  const [templates, setTemplates] = useState([]);
  const [activeType, setActiveType] = useState('bill'); // 'bill', 'kot'
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('sections'); // 'sections', 'global'
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

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
    showNotification("Template saved successfully!");
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
    if (editingTemplate.isBuiltIn) return showNotification("Cannot delete built-in templates.", "error");
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
    showNotification(`${editingTemplate.name} is now the default template for ${activeType.toUpperCase()}.`);
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
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
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Layout</label>
                <select value={section.style.layout || 'full'} onChange={(e) => updateSectionStyle(index, 'layout', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                  <option value="full">1 Col</option>
                  <option value="half-left">Left</option>
                  <option value="half-right">Right</option>
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

            {section.type === 'orderInfo' && activeType !== 'kot' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showBillNo} onChange={(e) => updateSectionData(index, 'showBillNo', e.target.checked)} /> Show Bill No</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showTableNo} onChange={(e) => updateSectionData(index, 'showTableNo', e.target.checked)} /> Show Table No</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showOrderType} onChange={(e) => updateSectionData(index, 'showOrderType', e.target.checked)} /> Show Order Type</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showDateTime} onChange={(e) => updateSectionData(index, 'showDateTime', e.target.checked)} /> Show Date/Time</label>
              </div>
            )}
            {section.type === 'orderInfo' && activeType === 'kot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Order Type Font Size</label>
                    <input type="number" value={section.data.typeFontSize || 16} onChange={(e) => updateSectionData(index, 'typeFontSize', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Order Type Weight</label>
                    <select value={section.data.typeFontWeight || 'bold'} onChange={(e) => updateSectionData(index, 'typeFontWeight', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Table/Token Font Size</label>
                    <input type="number" value={section.data.tableFontSize || 14} onChange={(e) => updateSectionData(index, 'tableFontSize', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Table/Token Weight</label>
                    <select value={section.data.tableFontWeight || 'bold'} onChange={(e) => updateSectionData(index, 'tableFontWeight', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Time Font Size</label>
                    <input type="number" value={section.data.timeFontSize || 12} onChange={(e) => updateSectionData(index, 'timeFontSize', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Time Weight</label>
                    <select value={section.data.timeFontWeight || 'normal'} onChange={(e) => updateSectionData(index, 'timeFontWeight', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {section.type === 'customerInfo' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showName} onChange={(e) => updateSectionData(index, 'showName', e.target.checked)} /> Show Name</label>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showMobile} onChange={(e) => updateSectionData(index, 'showMobile', e.target.checked)} /> Show Mobile</label>
              </div>
            )}

            {section.type === 'itemList' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showQty} onChange={(e) => updateSectionData(index, 'showQty', e.target.checked)} /> Show Quantity</label>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showNoteCol} onChange={(e) => updateSectionData(index, 'showNoteCol', e.target.checked)} /> Show Special Note Col</label>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showPrice} onChange={(e) => updateSectionData(index, 'showPrice', e.target.checked)} /> Show Price/Unit</label>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showTotal} onChange={(e) => updateSectionData(index, 'showTotal', e.target.checked)} /> Show Item Total</label>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.qtyBeforeName} onChange={(e) => updateSectionData(index, 'qtyBeforeName', e.target.checked)} /> Qty Before Name</label>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showNotes !== false} onChange={(e) => updateSectionData(index, 'showNotes', e.target.checked)} /> Show Notes (List)</label>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.mergeDuplicates} onChange={(e) => updateSectionData(index, 'mergeDuplicates', e.target.checked)} /> Merge Duplicates</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Header Font Size</label>
                    <input type="number" value={section.data.headerFontSize || 13} onChange={(e) => updateSectionData(index, 'headerFontSize', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Header Weight</label>
                    <select value={section.data.headerFontWeight || 'bold'} onChange={(e) => updateSectionData(index, 'headerFontWeight', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}>
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="900">Black (900)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>Column Widths (chars)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                    <div><span style={{ fontSize: '10px', color: '#94a3b8' }}>Qty Width</span><input type="number" value={section.data.colQty || 4} onChange={(e) => updateSectionData(index, 'colQty', parseInt(e.target.value))} style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                    <div><span style={{ fontSize: '10px', color: '#94a3b8' }}>Note Width</span><input type="number" value={section.data.colNote || 15} onChange={(e) => updateSectionData(index, 'colNote', parseInt(e.target.value))} style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                    <div><span style={{ fontSize: '10px', color: '#94a3b8' }}>Price Width</span><input type="number" value={section.data.colPrice || 8} onChange={(e) => updateSectionData(index, 'colPrice', parseInt(e.target.value))} style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                    <div><span style={{ fontSize: '10px', color: '#94a3b8' }}>Total Width</span><input type="number" value={section.data.colTotal || 8} onChange={(e) => updateSectionData(index, 'colTotal', parseInt(e.target.value))} style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                  </div>
                </div>
              </>
            )}

            {section.type === 'charges' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showGst} onChange={(e) => updateSectionData(index, 'showGst', e.target.checked)} /> Show GST Breakdown</label>
                  <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={section.data.showServiceCharge} onChange={(e) => updateSectionData(index, 'showServiceCharge', e.target.checked)} /> Show Service Charge</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Total Qty Font Size</label>
                    <input type="number" value={section.data.totalQtyFontSize || 13} onChange={(e) => updateSectionData(index, 'totalQtyFontSize', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Service Charge Font Size</label>
                    <input type="number" value={section.data.serviceChargeFontSize || 13} onChange={(e) => updateSectionData(index, 'serviceChargeFontSize', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                  </div>
                </div>
              </>
            )}
            {section.type === 'totalSummary' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Round Off Font Size</label>
                <input type="number" value={section.data.roundOffFontSize || 11} onChange={(e) => updateSectionData(index, 'roundOffFontSize', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
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
        { name: 'Paneer Tikka Masala', qty: 1, price: 320, total: 320, note: 'Less spicy' },
        { name: 'Garlic Naan', qty: 3, price: 50, total: 150 },
        { name: 'Fresh Lime Soda', qty: 2, price: 90, total: 180 }
      ],
      subtotal: 650, gst: 32.50, serviceCharge: 32.50, total: 715
    };

    return (
      <div style={{ 
        width: `${editingTemplate.paperWidth * 4}px`, // scaled for preview
        background: 'white', 
        padding: `${(editingTemplate.global?.marginTop || 0) * 15 + 20}px ${(editingTemplate.global?.marginRight || 0) * 15 + 20}px ${(editingTemplate.global?.marginBottom || 0) * 15 + 20}px ${(editingTemplate.global?.marginLeft || 0) * 15 + 20}px`, 
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', 
        border: '1px solid #e2e8f0', 
        color: '#000', 
        fontFamily: (editingTemplate.global?.fontFamily === 'Verdana' ? 'Verdana, Geneva, sans-serif' : (editingTemplate.global?.fontFamily || 'monospace')),
        lineHeight: `${(editingTemplate.global?.lineSpacing || 30) / 24}`, // approximate mapping from dots to relative height
        margin: '0 auto',
        minHeight: '400px'
      }}>
        {editingTemplate.sections.filter(s => s.visible).sort((a,b) => a.order - b.order).map((section) => {
          const sStyle = { 
            ...section.style, 
            fontFamily: 'inherit',
            fontSize: `${section.style.fontSize || 12}px`,
            fontWeight: section.style.fontWeight || 'normal',
            display: 'inline-block',
            width: section.style.layout === 'half-left' || section.style.layout === 'half-right' ? '50%' : '100%',
            verticalAlign: 'top',
            boxSizing: 'border-box',
            paddingRight: section.style.layout === 'half-left' ? '5px' : '0',
            paddingLeft: section.style.layout === 'half-right' ? '5px' : '0',
            borderBottom: 'none',
            marginBottom: '0',
            paddingBottom: section.style.layout === 'half-left' || section.style.layout === 'half-right' ? '0' : '5px'
          };

          // Wrap content logic
          let content = null;
          switch (section.type) {
            case 'header':
              content = (
                <div style={{ 
                  paddingTop: `${editingTemplate.global?.separatorSpacing || 5}px`, 
                  paddingBottom: `${editingTemplate.global?.separatorSpacing || 5}px`, 
                  borderBottom: editingTemplate.global?.separatorChar === '.' ? '2px dotted #000' : '2px solid #000'
                }}>
                  {section.data.showLogo && <div style={{ border: '1px solid #ccc', padding: '10px', display: 'inline-block', marginBottom: '5px' }}>[LOGO]</div>}
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', fontWeight: 'bold' }}>{section.data.text}</div>
                  {section.data.address && <div style={{ fontSize: '13px', fontWeight: 'normal', whiteSpace: 'pre-wrap', marginTop: '4px' }}>{section.data.address}</div>}
                  {section.data.showGst && section.data.gstNumber && <div style={{ fontSize: '12px', marginTop: '4px' }}>GSTIN: {section.data.gstNumber}</div>}
                </div>
              );
              break;
            case 'orderInfo':
              content = (
                <div style={{ 
                  paddingTop: `${editingTemplate.global?.separatorSpacing || 5}px`, 
                  paddingBottom: `${editingTemplate.global?.separatorSpacing || 5}px`, 
                  borderBottom: editingTemplate.global?.separatorChar === '.' ? '2px dotted #000' : '2px solid #000'
                }}>
                  {activeType === 'kot' ? (
                     <div style={{ textAlign: section.style.textAlign }}>
                       <div style={{ fontWeight: section.data.typeFontWeight || section.style.fontWeight || 'bold', fontSize: `${section.data.typeFontSize || section.style.fontSize || 16}px` }}>{mockOrder.type === 'Takeaway' || mockOrder.type === 'Delivery' ? 'Takeaway' : 'Dine In'}</div>
                       {mockOrder.type === 'Takeaway' || mockOrder.type === 'Delivery' ? (
                         <div style={{ fontWeight: section.data.tableFontWeight || section.style.fontWeight || 'bold', fontSize: `${section.data.tableFontSize || section.style.fontSize || 14}px` }}>Token No: T-001 {mockOrder.customer ? `| ${mockOrder.customer}` : ''}</div>
                       ) : (
                         <div style={{ fontWeight: section.data.tableFontWeight || section.style.fontWeight || 'bold', fontSize: `${section.data.tableFontSize || section.style.fontSize || 14}px` }}>Table No: {mockOrder.table.replace('T-', '')}</div>
                       )}
                       <div style={{ fontWeight: section.data.timeFontWeight || 'normal', fontSize: `${section.data.timeFontSize || 12}px`, marginTop: '2px' }}>{mockOrder.time || '19:30'}</div>
                     </div>
                  ) : section.style.textAlign === 'center' ? (
                    <div style={{ textAlign: 'center' }}>
                      {section.data.showDateTime && (
                        <>
                          <div>{mockOrder.date}</div>
                          <div style={{ marginBottom: '2px' }}>{mockOrder.time}</div>
                        </>
                      )}
                      {section.data.showBillNo && <div style={{ fontWeight: 'bold' }}>KOT - 4021</div>}
                      <div style={{ fontWeight: '900', marginTop: '2px' }}>Dine In</div>
                      <div style={{ fontWeight: '900' }}>Table No: T-12</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        {section.data.showDateTime ? <span>Date: {mockOrder.date}</span> : <span />}
                        {(section.data.showTableNo || section.data.showOrderType) && <span style={{ fontWeight: '900' }}>{mockOrder.type}: {mockOrder.table}</span>}
                      </div>
                      {section.data.showDateTime && <div style={{ marginBottom: '2px' }}>{mockOrder.time}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cashier: biller</span>
                        {section.data.showBillNo && <span>Bill No.: {mockOrder.billNo}</span>}
                      </div>
                    </>
                  )}
                </div>
              );
              break;
            case 'customerInfo':
              content = (
                <div style={{ 
                  paddingTop: `${editingTemplate.global?.separatorSpacing || 5}px`, 
                  paddingBottom: `${editingTemplate.global?.separatorSpacing || 5}px`, 
                  borderBottom: editingTemplate.global?.separatorChar === '.' ? '2px dotted #000' : '2px solid #000'
                }}>
                  {section.data.showName && <div>Customer: {mockOrder.customer}</div>}
                  {section.data.showMobile && <div>Mobile: {mockOrder.mobile}</div>}
                </div>
              );
              break;
            case 'itemList':
              let headW = (editingTemplate.paperWidth === 58 ? 32 : 48) - (section.data.showQty?(section.data.colQty || 4):0) - (section.data.showPrice?(section.data.colPrice || 8):0) - (section.data.showTotal?(section.data.colTotal || 8):0) - (section.data.showNoteCol?(section.data.colNote || 15):0) - 1;
              if (section.style.layout === 'half-left' || section.style.layout === 'half-right') headW = Math.floor(headW / 2);

              content = (
                <div style={{ paddingTop: `${editingTemplate.global?.separatorSpacing || 5}px` }}>
                  <div style={{ display: 'flex', borderBottom: editingTemplate.global?.separatorChar === '.' ? '2px dotted #000' : '2px solid #000', paddingBottom: `${editingTemplate.global?.separatorSpacing || 5}px`, marginBottom: '0', fontSize: `${section.data.headerFontSize || 13}px`, fontWeight: section.data.headerFontWeight || 'bold' }}>
                    {section.data.qtyBeforeName && section.data.showQty && <div style={{ width: `${(section.data.colQty || 4)*8}px`, textAlign: 'right' }}>Qty</div>}
                    <div style={{ flex: 1 }}>Item</div>
                    {section.data.showNoteCol && <div style={{ width: `${(section.data.colNote || 15)*8}px`, textAlign: 'right' }}>Special Note</div>}
                    {!section.data.qtyBeforeName && section.data.showQty && <div style={{ width: `${(section.data.colQty || 4)*8}px`, textAlign: 'right' }}>Qty</div>}
                    {section.data.showPrice && <div style={{ width: `${(section.data.colPrice || 8)*8}px`, textAlign: 'right' }}>Price</div>}
                    {section.data.showTotal && <div style={{ width: `${(section.data.colTotal || 8)*8}px`, textAlign: 'right' }}>Amount</div>}
                  </div>
                  {mockOrder.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', fontWeight: activeType === 'kot' ? 'bold' : 'inherit' }}>
                        {section.data.qtyBeforeName && section.data.showQty && <div style={{ width: `${(section.data.colQty || 4)*8}px`, textAlign: 'right' }}>{item.qty}</div>}
                        <div style={{ flex: 1 }}>{item.name}</div>
                        {section.data.showNoteCol && <div style={{ width: `${(section.data.colNote || 15)*8}px`, textAlign: 'right', color: '#64748b' }}>—</div>}
                        {!section.data.qtyBeforeName && section.data.showQty && <div style={{ width: `${(section.data.colQty || 4)*8}px`, textAlign: 'right' }}>{item.qty}</div>}
                        {section.data.showPrice && <div style={{ width: `${(section.data.colPrice || 8)*8}px`, textAlign: 'right' }}>{item.price.toFixed(2)}</div>}
                        {section.data.showTotal && <div style={{ width: `${(section.data.colTotal || 8)*8}px`, textAlign: 'right' }}>{item.total.toFixed(2)}</div>}
                      </div>
                      {section.data.showNotes !== false && item.note && <div style={{ fontSize: '0.85em', color: '#4b5563', paddingLeft: '8px' }}>Note: {item.note}</div>}
                    </div>
                  ))}
                </div>
              );
              break;
            case 'charges': {
              const itemSec = editingTemplate.sections.find(s => s.type === 'itemList') || { data: {} };
              const colQtyW = (itemSec.data.colQty || 4) * 8;
              const colPriceW = (itemSec.data.colPrice || 8) * 8;
              const colTotalW = (itemSec.data.colTotal || 8) * 8;
              const qtyBefore = itemSec.data.qtyBeforeName;

              content = (
                <div style={{ paddingBottom: '5px', borderTop: editingTemplate.global?.separatorChar === '.' ? '2px dotted #000' : '2px solid #000', paddingTop: `${editingTemplate.global?.separatorSpacing || 5}px`, marginTop: '0' }}>
                  {/* Row 1: Total Qty label + Qty Value + "Sub" label in Price Col */}
                  {/* Row 1: Total Qty label + Qty Value + "Sub" label + Amount */}
                  <div style={{ display: 'flex', marginBottom: '0', fontSize: `${section.data.totalQtyFontSize || 13}px` }}>
                    {qtyBefore && <div style={{ width: `${colQtyW}px`, textAlign: 'right' }}>{mockOrder.items.reduce((s,i)=>s+i.qty,0)}</div>}
                    <div style={{ flex: 1, textAlign: 'right', paddingRight: '4px' }}>Total Qty:</div>
                    {!qtyBefore && <div style={{ width: `${colQtyW}px`, textAlign: 'right' }}>{mockOrder.items.reduce((s,i)=>s+i.qty,0)}</div>}
                    <div style={{ width: `${colPriceW}px`, textAlign: 'right' }}>Sub</div>
                    <div style={{ width: `${colTotalW}px`, textAlign: 'right' }}>{mockOrder.subtotal.toFixed(2)}</div>
                  </div>

                  {/* Row 2: "Total" label only */}
                  <div style={{ display: 'flex', marginBottom: '4px', fontSize: `${section.data.totalQtyFontSize || 13}px` }}>
                    <div style={{ flex: 1 }}></div>
                    {qtyBefore && <div style={{ width: `${colQtyW}px` }}></div>}
                    {!qtyBefore && <div style={{ width: `${colQtyW}px` }}></div>}
                    <div style={{ width: `${colPriceW}px`, textAlign: 'right' }}>Total</div>
                    <div style={{ width: `${colTotalW}px`, textAlign: 'right' }}></div>
                  </div>

                  {section.data.showServiceCharge && (
                    <>
                      <div style={{ display: 'flex', marginBottom: '0', fontSize: `${section.data.serviceChargeFontSize || 13}px` }}>
                        {qtyBefore && <div style={{ width: `${colQtyW}px` }}></div>}
                        <div style={{ flex: 1, textAlign: 'right', paddingRight: '4px' }}>Service Charge</div>
                        {!qtyBefore && <div style={{ width: `${colQtyW}px` }}></div>}
                        <div style={{ width: `${colPriceW}px` }}></div>
                        <div style={{ width: `${colTotalW}px`, textAlign: 'right' }}>{mockOrder.serviceCharge.toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'flex', marginBottom: '4px', fontSize: `${section.data.serviceChargeFontSize || 13}px` }}>
                        <div style={{ flex: 1, textAlign: 'right', paddingRight: '4px' }}>(Optional)</div>
                        {qtyBefore && <div style={{ width: `${colQtyW}px` }}></div>}
                        {!qtyBefore && <div style={{ width: `${colQtyW}px` }}></div>}
                        <div style={{ width: `${colPriceW}px` }}></div>
                        <div style={{ width: `${colTotalW}px` }}></div>
                      </div>
                    </>
                  )}

                  {section.data.showGst && (
                    <div style={{ display: 'flex', marginBottom: '4px', fontSize: `${section.data.serviceChargeFontSize || 13}px` }}>
                      {qtyBefore && <div style={{ width: `${colQtyW}px` }}></div>}
                      <div style={{ flex: 1, textAlign: 'right', paddingRight: '4px' }}>GST</div>
                      {!qtyBefore && <div style={{ width: `${colQtyW}px` }}></div>}
                      <div style={{ width: `${colPriceW}px` }}></div>
                      <div style={{ width: `${colTotalW}px`, textAlign: 'right' }}>{mockOrder.gst.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              );
              break;
            }
            case 'totalSummary': {
              const itemSec = editingTemplate.sections.find(s => s.type === 'itemList') || { data: {} };
              const colTotalW = (itemSec.data.colTotal || 8) * 8;

              content = (
                <div style={{ borderTop: editingTemplate.global?.separatorChar === '.' ? '2px dotted #000' : '2px solid #000', borderBottom: editingTemplate.global?.separatorChar === '.' ? '2px dotted #000' : '2px solid #000', paddingTop: `${editingTemplate.global?.separatorSpacing || 5}px`, paddingBottom: `${editingTemplate.global?.separatorSpacing || 5}px`, marginTop: '0', marginBottom: '0' }}>
                  <div style={{ display: 'flex', marginBottom: '4px', fontSize: `${section.data.roundOffFontSize || 11}px`, color: '#64748b' }}>
                    <span style={{ flex: 1, textAlign: 'right', paddingRight: '4px' }}>Round off</span>
                    <span style={{ width: `${colTotalW}px`, textAlign: 'right' }}>+0.00</span>
                  </div>
                  <div style={{ display: 'flex', fontWeight: '900', fontSize: `${section.style.fontSize}px`, whiteSpace: 'nowrap' }}>
                    <span style={{ flex: 1, textAlign: 'right', paddingRight: '4px' }}>Grand Total</span>
                    <span style={{ width: `${colTotalW}px`, textAlign: 'right' }}>₹{mockOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              );
              break;
            }
            case 'footer':
              content = (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {section.data.text}
                </div>
              );
              break;
              return null;
          }

          return (
            <div key={section.id} style={sStyle}>
              {content}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
      {/* Top Nav */}
      <div style={{ background: 'white', padding: '16px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['bill', 'kot'].map(type => (
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
              {type === 'kot' ? 'KOT Designer' : `Bill Designer`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={saveTemplate} style={{ padding: '10px 20px', borderRadius: '10px', background: '#10b981', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} /> Save Template
          </button>
          <button onClick={() => { 
            const newTemplates = [...templates];
            const index = newTemplates.findIndex(t => t.id === editingTemplate.id);
            if (index >= 0) {
              newTemplates[index] = editingTemplate;
            } else {
              newTemplates.push(editingTemplate);
            }
            onSaveSettings({ ...settings, printTemplates: newTemplates }); 
            showNotification("POS Settings Saved Successfully!"); 
          }} style={{ padding: '10px 20px', borderRadius: '10px', background: '#1e293b', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} /> Done
          </button>
        </div>
      </div>

      {/* In-App Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: notification.type === 'error' ? '#ef4444' : '#10b981',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10000,
          animation: 'slideUp 0.3s ease-out'
        }}>
          <CheckCircle size={18} />
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{notification.message}</span>
        </div>
      )}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {editingTemplate && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Column: Template Manager & Settings */}
          <div style={{ width: '450px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="no-scrollbar">
            
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
                  <Copy size={14} /> Save As New
                </button>
                <button onClick={setAsDefault} disabled={editingTemplate.isDefault} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: editingTemplate.isDefault ? 'not-allowed' : 'pointer', opacity: editingTemplate.isDefault ? 0.5 : 1 }}>
                  Set Default
                </button>
                <button onClick={deleteTemplate} disabled={editingTemplate.isBuiltIn} style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '6px', cursor: editingTemplate.isBuiltIn ? 'not-allowed' : 'pointer', opacity: editingTemplate.isBuiltIn ? 0.5 : 1 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Settings Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
              <button onClick={() => setActiveTab('sections')} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderBottom: activeTab === 'sections' ? '2px solid #94161c' : '2px solid transparent', color: activeTab === 'sections' ? '#94161c' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Sections</button>
              <button onClick={() => setActiveTab('global')} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', borderBottom: activeTab === 'global' ? '2px solid #94161c' : '2px solid transparent', color: activeTab === 'global' ? '#94161c' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Global Layout</button>
            </div>

            {activeTab === 'global' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="no-scrollbar">
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Settings2 size={16}/> Global Spacing & Layout</h3>
                
                <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '12px' }}>Outer Margins (Print lines)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Top Margin</label>
                      <input type="number" value={editingTemplate.global?.marginTop || 0} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, marginTop: parseInt(e.target.value)}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Bottom Margin</label>
                      <input type="number" value={editingTemplate.global?.marginBottom || 0} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, marginBottom: parseInt(e.target.value)}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Left Margin (Spaces)</label>
                      <input type="number" value={editingTemplate.global?.marginLeft || 0} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, marginLeft: parseInt(e.target.value)}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Right Margin (Spaces)</label>
                      <input type="number" value={editingTemplate.global?.marginRight || 0} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, marginRight: parseInt(e.target.value)}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>
                </div>

                <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '12px' }}>Typography & Spacing</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Section Spacing (Lines)</label>
                      <input type="number" value={editingTemplate.global?.sectionSpacing || 1} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, sectionSpacing: parseInt(e.target.value)}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Line Spacing (Dots: 0-255, Default 30)</label>
                      <input type="number" min="0" max="255" value={editingTemplate.global?.lineSpacing !== undefined ? editingTemplate.global?.lineSpacing : 30} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, lineSpacing: parseInt(e.target.value)}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Separator Vertical Gap (Pixels)</label>
                      <input type="number" value={editingTemplate.global?.separatorSpacing || 5} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, separatorSpacing: parseInt(e.target.value)}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Separator Character (Raw Print)</label>
                      <select value={editingTemplate.global?.separatorChar || '='} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, separatorChar: e.target.value}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}>
                        <option value="=">Bold (====)</option>
                        <option value="-">Thin (----)</option>
                        <option value=".">Dotted (....)</option>
                        <option value="*">Stars (****)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>Font Family (Preview / Raster Printing)</label>
                      <select value={editingTemplate.global?.fontFamily || 'monospace'} onChange={e => setEditingTemplate({...editingTemplate, global: {...editingTemplate.global, fontFamily: e.target.value}})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}>
                        <option value="monospace">Monospace (ESC/POS Default)</option>
                        <option value="Verdana">Verdana (Reference Style)</option>
                        <option value="sans-serif">Sans Serif</option>
                        <option value="serif">Serif</option>
                      </select>
                      <span style={{ fontSize: '10px', color: '#ef4444', display: 'block', marginTop: '4px' }}>*Only visible if printer supports graphical printing</span>
                    </div>
                  </div>
                </div>

            {/* Layout Options */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
               <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '12px' }}>Paper Width</label>
               <div style={{ display: 'flex', gap: '12px' }}>
                 <button onClick={() => setEditingTemplate({...editingTemplate, paperWidth: 80})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', borderColor: editingTemplate.paperWidth === 80 ? '#94161c' : '#e2e8f0', background: editingTemplate.paperWidth === 80 ? '#fdf2f2' : 'white', color: editingTemplate.paperWidth === 80 ? '#94161c' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>80 mm</button>
                 <button onClick={() => setEditingTemplate({...editingTemplate, paperWidth: 58})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid', borderColor: editingTemplate.paperWidth === 58 ? '#94161c' : '#e2e8f0', background: editingTemplate.paperWidth === 58 ? '#fdf2f2' : 'white', color: editingTemplate.paperWidth === 58 ? '#94161c' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>58 mm</button>
               </div>
            </div>

              </div>
            )}

            {/* Section Controls */}
            {activeTab === 'sections' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="no-scrollbar">
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Layout size={16}/> Section Blocks</h3>
                {editingTemplate.sections.sort((a,b) => a.order - b.order).map((section, index) => renderSectionControls(section, index))}
              </div>
            )}
          </div>

          {/* Right Column: Live Preview */}
          <div style={{ flex: 1, background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '40px 0' }} className="no-scrollbar">
             <div style={{ background: '#1e293b', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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
