import React, { useState, useRef } from 'react';
import { 
  Camera, Upload, Sparkles, AlertCircle, CheckCircle2, 
  Trash2, Plus, Edit3, X, RefreshCw, Check, Search, Filter, ShieldCheck
} from 'lucide-react';
import { apiService } from '../../services/apiService';

/**
 * AIMenuScannerModal
 * ─────────────────────────────────────────────────────────────
 * Standalone modal component for uploading menu photos, parsing items via AI,
 * presenting an interactive typo-editing grid, and bulk-importing into the POS.
 */
export default function AIMenuScannerModal({ isOpen, onClose, onImportComplete, existingCategories = [] }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'scanning' | 'review' | 'importing' | 'success'
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('pos_gemini_api_key') || '');

  const handleApiKeyChange = (val) => {
    setCustomApiKey(val);
    try { localStorage.setItem('pos_gemini_api_key', val); } catch (e) {}
  };
  const [scanError, setScanError] = useState(null);
  const [extractedItems, setExtractedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('All');
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // ── Handle File Selection ──
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScanError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setScanError('File size is too large. Please select an image under 10MB.');
      return;
    }

    setScanError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ── Handle Drag and Drop ──
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileChange({ target: { files: [file] } });
    }
  };

  // ── Trigger AI Scan ──
  const handleScanMenu = async () => {
    if (!imagePreview) return;

    setStep('scanning');
    setScanError(null);

    try {
      // Send base64 payload (strip data URL prefix)
      const base64Data = imagePreview.split(',')[1] || imagePreview;
      const response = await apiService.scanMenuImage(base64Data, customApiKey);

      if (response && response.items && response.items.length > 0) {
        // Tag items with unique IDs for inline key tracking
        const tagged = response.items.map((item, idx) => ({
          id: `scan_${Date.now()}_${idx}`,
          category: item.category || 'Uncategorised',
          name: item.name || 'Untitled Item',
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
          type: String(item.type || 'Veg').toLowerCase().includes('non') ? 'Non-Veg' : 'Veg',
          short_code: item.short_code || (item.name ? item.name.substring(0, 3).toUpperCase() : 'ITM'),
          selected: true
        }));
        setExtractedItems(tagged);
        setStep('review');
      } else {
        throw new Error(response?.error || 'No menu items detected in photo. Please ensure image is clear.');
      }
    } catch (err) {
      console.error('AI Menu Scan Failed:', err);
      setScanError(err.message || 'Failed to scan image. Please try again with a clearer photo.');
      setStep('upload');
    }
  };

  // ── Inline Editing Handlers ──
  const handleUpdateItem = (id, field, value) => {
    setExtractedItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, [field]: value };
    }));
  };

  const handleToggleSelect = (id) => {
    setExtractedItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, selected: !item.selected };
    }));
  };

  const handleToggleSelectAll = (select) => {
    setExtractedItems(prev => prev.map(item => ({ ...item, selected: select })));
  };

  const handleDeleteItem = (id) => {
    setExtractedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddCustomRow = () => {
    const newItem = {
      id: `scan_${Date.now()}_new`,
      category: existingCategories[0] || 'Main Course',
      name: '',
      price: 100,
      type: 'Veg',
      short_code: 'NEW',
      selected: true
    };
    setExtractedItems(prev => [...prev, newItem]);
  };

  // ── Final Import Execution ──
  const handleConfirmImport = async () => {
    const selectedItems = extractedItems.filter(i => i.selected && i.name.trim().length > 0);
    if (selectedItems.length === 0) {
      alert('Please select at least one item to import.');
      return;
    }

    setStep('importing');
    try {
      // 1. Gather all unique categories
      const detectedCategories = [...new Set(selectedItems.map(i => i.category.trim()).filter(Boolean))];
      const combinedCategories = [...new Set([...existingCategories, ...detectedCategories])].sort();

      // 2. Save categories via API
      await apiService.saveCategories(combinedCategories);

      // 3. Import each menu item via API
      let successCount = 0;
      for (const item of selectedItems) {
        try {
          await apiService.createMenuItem({
            name: item.name.trim(),
            category: item.category.trim() || 'Uncategorised',
            price: parseFloat(item.price) || 0,
            type: item.type,
            short_code: item.short_code.toUpperCase(),
            available: true,
            inStock: true
          });
          successCount++;
        } catch (e) {
          console.warn(`Failed to import item ${item.name}:`, e.message);
        }
      }

      setImportSummary({
        totalItems: successCount,
        categoriesCount: detectedCategories.length,
        categoriesList: detectedCategories
      });

      setStep('success');

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      console.error('Import Failed:', err);
      alert(`Import error: ${err.message}`);
      setStep('review');
    }
  };

  // ── Reset Modal State ──
  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setImagePreview(null);
    setScanError(null);
    setExtractedItems([]);
    setImportSummary(null);
  };

  // ── Derived Data for Review Step ──
  const categoriesList = ['All', ...new Set(extractedItems.map(i => i.category).filter(Boolean))];
  const filteredItems = extractedItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCatFilter === 'All' || item.category === selectedCatFilter;
    return matchesSearch && matchesCat;
  });

  const selectedCount = extractedItems.filter(i => i.selected).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: '#ffffff', width: '100%', maxWidth: step === 'review' ? '920px' : '560px',
        maxHeight: '90vh', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
            }}>
              <Sparkles size={22} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'white', letterSpacing: '-0.3px' }}>
                AI Menu Photo Scanner
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, marginTop: '2px' }}>
                {step === 'upload' && 'Upload a photo of your paper menu to auto-extract items'}
                {step === 'scanning' && 'AI is reading items, categories, and prices...'}
                {step === 'review' && 'Review extracted items — edit any typos before importing'}
                {step === 'importing' && 'Saving items to your POS database...'}
                {step === 'success' && 'Menu imported successfully!'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: '#cbd5e1',
              width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', background: '#fafafa' }}>

          {/* ERROR ALERT */}
          {scanError && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px',
              padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px'
            }}>
              <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#991b1b' }}>Scan Failed</div>
                <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px' }}>{scanError}</div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 1: UPLOAD PHOTO */}
          {/* ───────────────────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div>
              {/* Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                style={{
                  border: '2px dashed #cbd5e1', borderRadius: '20px', padding: '36px 20px',
                  textAlign: 'center', cursor: 'pointer', background: 'white',
                  transition: 'all 0.2s', position: 'relative'
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/jpeg,image/png,image/webp" 
                  style={{ display: 'none' }} 
                />

                {imagePreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '100%', maxHeight: '240px', borderRadius: '14px', overflow: 'hidden',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.08)', marginBottom: '16px', border: '1px solid #e2e8f0'
                    }}>
                      <img src={imagePreview} alt="Menu preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8fafc' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '600', fontSize: '13px' }}>
                      <CheckCircle2 size={16} /> Photo loaded: {selectedFile?.name}
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      style={{ marginTop: '8px', fontSize: '12px', color: '#64748b', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Choose a different photo
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '60px', height: '60px', borderRadius: '50%', background: '#ecfdf5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
                    }}>
                      <Upload size={28} color="#10b981" />
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' }}>
                      Drop menu photo here or browse
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0, maxWidth: '320px' }}>
                      Supports clear photos of printed menus, menu cards, or chalkboard menus (JPG, PNG, WEBP up to 10MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Optional Custom API Key */}
              <details style={{ marginTop: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px 16px' }}>
                <summary style={{ fontSize: '12px', fontWeight: '600', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color="#10b981" /> Advanced: Use Custom Gemini API Key (Optional)
                </summary>
                <div style={{ marginTop: '10px' }}>
                  <input 
                    type="password"
                    value={customApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="AIZASy..."
                    style={{
                      width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px',
                      padding: '8px 12px', fontSize: '12px', outline: 'none'
                    }}
                  />
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
                    Leave blank to use the built-in server AI key.
                  </p>
                </div>
              </details>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 2: SCANNING SPINNER */}
          {/* ───────────────────────────────────────────────────────────── */}
          {step === 'scanning' && (
            <div style={{ padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
                animation: 'pulse 1.5s infinite'
              }}>
                <RefreshCw size={36} color="#10b981" style={{ animation: 'spin 2s linear infinite' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>
                AI Vision is Scanning Your Menu...
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '380px', margin: 0, lineHeight: '1.5' }}>
                Extracting items, identifying categories, parsing prices, and classifying Veg/Non-Veg items. This usually takes 5-10 seconds.
              </p>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 3: INTERACTIVE REVIEW & TYPO EDITING GRID */}
          {/* ───────────────────────────────────────────────────────────── */}
          {step === 'review' && (
            <div>
              {/* Top Controls Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative', width: '240px' }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search extracted items..."
                      style={{
                        width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px',
                        border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', background: 'white'
                      }}
                    />
                  </div>

                  {/* Category Filter */}
                  <select
                    value={selectedCatFilter}
                    onChange={(e) => setSelectedCatFilter(e.target.value)}
                    style={{
                      padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '10px',
                      fontSize: '12px', background: 'white', color: '#334155', fontWeight: '500'
                    }}
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat} ({cat === 'All' ? extractedItems.length : extractedItems.filter(i => i.category === cat).length})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => handleToggleSelectAll(true)}
                    style={{ fontSize: '11px', fontWeight: '600', color: '#10b981', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Select All ({extractedItems.length})
                  </button>
                  <button 
                    onClick={handleAddCustomRow}
                    style={{ fontSize: '11px', fontWeight: '600', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> Add Item Row
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 5, borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '10px 12px', width: '36px' }}>Import</th>
                        <th style={{ padding: '10px 12px', width: '160px', color: '#475569', fontWeight: '600' }}>Category</th>
                        <th style={{ padding: '10px 12px', color: '#475569', fontWeight: '600' }}>Item Name (Fix Typos Here)</th>
                        <th style={{ padding: '10px 12px', width: '90px', color: '#475569', fontWeight: '600' }}>Price (₹)</th>
                        <th style={{ padding: '10px 12px', width: '95px', color: '#475569', fontWeight: '600' }}>Type</th>
                        <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                            No matching items found. Click "+ Add Item Row" to insert manually.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: item.selected ? 'white' : '#f8fafc' }}>
                            {/* Select Checkbox */}
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <input 
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleSelect(item.id)}
                                style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
                              />
                            </td>

                            {/* Category Input */}
                            <td style={{ padding: '8px 12px' }}>
                              <input 
                                type="text"
                                value={item.category}
                                onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                                placeholder="Category"
                                style={{
                                  width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1',
                                  borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#334155'
                                }}
                              />
                            </td>

                            {/* Item Name Input */}
                            <td style={{ padding: '8px 12px' }}>
                              <input 
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                placeholder="Item name"
                                style={{
                                  width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1',
                                  borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: '#0f172a'
                                }}
                              />
                            </td>

                            {/* Price Input */}
                            <td style={{ padding: '8px 12px' }}>
                              <input 
                                type="number"
                                value={item.price}
                                onChange={(e) => handleUpdateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                style={{
                                  width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1',
                                  borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: '#047857'
                                }}
                              />
                            </td>

                            {/* Veg / Non-Veg Toggle */}
                            <td style={{ padding: '8px 12px' }}>
                              <button 
                                type="button"
                                onClick={() => handleUpdateItem(item.id, 'type', item.type === 'Veg' ? 'Non-Veg' : 'Veg')}
                                style={{
                                  padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                  border: '1px solid', cursor: 'pointer', width: '100%',
                                  borderColor: item.type === 'Veg' ? '#a7f3d0' : '#fecaca',
                                  background: item.type === 'Veg' ? '#ecfdf5' : '#fef2f2',
                                  color: item.type === 'Veg' ? '#047857' : '#b91c1c'
                                }}
                              >
                                {item.type === 'Veg' ? '🌱 Veg' : '🍗 Non-Veg'}
                              </button>
                            </td>

                            {/* Delete Action */}
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button 
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                                title="Remove item"
                              >
                                <Trash2 size={15} color="#ef4444" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 4: IMPORTING SPINNER */}
          {/* ───────────────────────────────────────────────────────────── */}
          {step === 'importing' && (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <RefreshCw size={36} color="#10b981" style={{ animation: 'spin 2s linear infinite', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>
                Importing Selected Items into POS Database...
              </h3>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STEP 5: SUCCESS STATE */}
          {/* ───────────────────────────────────────────────────────────── */}
          {step === 'success' && importSummary && (
            <div style={{ padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%', background: '#ecfdf5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <CheckCircle2 size={36} color="#10b981" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px' }}>
                Import Complete!
              </h3>
              <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 20px' }}>
                Successfully added <b>{importSummary.totalItems} items</b> across <b>{importSummary.categoriesCount} categories</b> to your POS menu.
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '360px', marginBottom: '24px' }}>
                {importSummary.categoriesList.map(cat => (
                  <span key={cat} style={{ background: '#f1f5f9', color: '#334155', fontSize: '12px', fontWeight: '500', padding: '4px 10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    {cat}
                  </span>
                ))}
              </div>

              <button 
                onClick={onClose}
                style={{
                  padding: '12px 28px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', fontSize: '14px',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                }}
              >
                Done & View Menu
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px', background: '#ffffff', borderTop: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          {step === 'upload' && (
            <>
              <button 
                type="button" 
                onClick={onClose}
                style={{ padding: '10px 18px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleScanMenu}
                disabled={!imagePreview}
                style={{
                  padding: '10px 22px', background: imagePreview ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                  color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                  cursor: imagePreview ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: imagePreview ? '0 4px 12px rgba(16,185,129,0.25)' : 'none'
                }}
              >
                <Sparkles size={16} /> Scan Menu with AI
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button 
                type="button" 
                onClick={handleReset}
                style={{ padding: '10px 18px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Scan Different Photo
              </button>
              <button 
                type="button" 
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                style={{
                  padding: '10px 24px', background: selectedCount > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
                  color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                  cursor: selectedCount > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: selectedCount > 0 ? '0 4px 12px rgba(16,185,129,0.25)' : 'none'
                }}
              >
                <Check size={16} /> Confirm & Import {selectedCount} Selected Items
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
