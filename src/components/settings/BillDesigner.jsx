import React, { useState } from 'react';
import { 
  FileText, Printer, Layers, Monitor, Percent, Image as ImageIcon, 
  Check, X, Type, Maximize2, Hash, Smartphone, CreditCard, Clock, 
  ChevronRight, ArrowRight, Save, Layout, Bold, Trash2
} from 'lucide-react';

const BillDesigner = ({ settings, onSaveSettings }) => {
  const [activeMode, setActiveMode] = useState('bill'); // 'bill' is Bill Designer, 'kot' is KOT Designer
  const [activeTab, setActiveTab] = useState('content'); // Sub-tabs for each designer

  const updateSetting = (key, value) => {
    onSaveSettings({ ...settings, [key]: value });
  };

  const InputField = ({ label, value, field, type = 'text' }) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '8px' }}>{label}</label>
      <input 
        type={type} value={value} 
        onChange={(e) => updateSetting(field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
        style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: '700', outline: 'none', transition: 'all 0.2s', background: '#f8fafc' }}
      />
    </div>
  );

  const CheckboxField = ({ label, value, field }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', marginBottom: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: '800', color: '#334155' }}>{label}</span>
      <button 
        onClick={() => updateSetting(field, !value)} 
        style={{ width: '46px', height: '26px', borderRadius: '13px', background: value ? '#94161c' : '#e2e8f0', position: 'relative', cursor: 'pointer', border: 'none', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div style={{ position: 'absolute', top: '4px', left: value ? '24px' : '4px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'all 0.3s' }} />
      </button>
    </div>
  );

  const RadioGroup = ({ label, value, field, options }) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '10px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {options.map(opt => (
          <button
            key={opt.val}
            onClick={() => updateSetting(field, opt.val)}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px', fontSize: '12px', fontWeight: '900', border: '2px solid',
              borderColor: value === opt.val ? '#94161c' : '#f1f5f9',
              background: value === opt.val ? '#94161c08' : 'white',
              color: value === opt.val ? '#94161c' : '#64748b',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  // --- BILL PREVIEW COMPONENT ---
  const BillPreview = () => (
    <div style={{ width: settings.billMainWidth + 'px', background: 'white', padding: `${settings.billMarginTop}px ${settings.billMarginRight}px ${settings.billMarginBottom}px ${settings.billMarginLeft}px`, color: '#000', fontFamily: 'monospace', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        {settings.printLogo && <div style={{ border: '1px dashed #ccc', padding: '10px', marginBottom: '10px', fontSize: '10px', color: '#999' }}>[ RESTAURANT LOGO ]</div>}
        {settings.showRetailOnTop && <div style={{ fontSize: '11px', fontWeight: 'bold' }}>RETAIL INVOICE</div>}
        {settings.showResName && <div style={{ fontWeight: settings.showResNameBold ? 'bold' : 'normal', fontSize: settings.resFont + 'px', textTransform: 'uppercase' }}>{settings.resName}</div>}
        <div style={{ fontSize: settings.headFootFont + 'px', fontWeight: settings.showHeadlineBold ? 'bold' : 'normal', whiteSpace: 'pre-wrap' }}>{settings.headerText}</div>
      </div>
      
      <div style={{ borderTop: '1px solid #000', margin: '10px 0' }}></div>
      
      <div style={{ fontSize: settings.dateBillFont + 'px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{settings.showDateTime === 'both' ? '12/04/24 15:12' : '12/04/24'}</span>
          <span style={{ fontWeight: 'bold' }}>TABLE: B3</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>ID: #5591</span>
          <span>Bill No: 0042</span>
        </div>
        {settings.showBillerName && <div>Cashier: TYDE_STAFF</div>}
      </div>

      <div style={{ borderTop: '1.5px solid #000', margin: '10px 0' }}></div>
      
      <div style={{ fontSize: settings.itemListFont + 'px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '4fr 1fr 1fr 1fr', fontWeight: 'bold', marginBottom: '5px' }}>
          <span>ITEM</span>
          <span style={{ textAlign: 'center' }}>QTY</span>
          <span style={{ textAlign: 'right' }}>PRICE</span>
          <span style={{ textAlign: 'right' }}>AMT</span>
        </div>
        <div style={{ borderBottom: '1px solid #eee', marginBottom: '5px' }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '4fr 1fr 1fr 1fr' }}>
              <span>Paneer Tikka</span>
              <span style={{ textAlign: 'center' }}>2</span>
              <span style={{ textAlign: 'right' }}>280</span>
              <span style={{ textAlign: 'right' }}>560</span>
            </div>
            {settings.showAddonSeparateRow && (
              <div style={{ fontSize: '10px', fontStyle: 'italic', paddingLeft: '8px' }}>
                + Extra Cheese {settings.showAddonMultiplication ? '(2 x 30)' : ''} {settings.showAddonPrice ? '60.00' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #000', margin: '15px 0 10px' }}></div>

      <div style={{ fontSize: settings.itemListFont + 'px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Total Qty: 2</span>
          <div style={{ textAlign: 'right', display: 'flex', gap: '20px' }}>
            <span>{settings.subTotalLbl}</span>
            <span>620.00</span>
          </div>
        </div>
        {settings.showNetTotalMsg && <div style={{ fontSize: '9px', textAlign: 'center', margin: '4px 0' }}>* Net Total inclusive of GST</div>}
        <div style={{ borderTop: '2px solid #000', margin: '5px 0', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', fontSize: settings.grandTotalFont + 'px', fontWeight: 'bold' }}>
          <span>GRAND TOTAL</span>
          <span>₹620.00</span>
        </div>
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: settings.headFootFont + 'px', fontWeight: settings.showFooterBold ? 'bold' : 'normal' }}>
        {settings.footerText}
      </div>
      
      {settings.showFssaiLoc === 'footer' && <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '10px' }}>FSSAI: 12345678901234</div>}
    </div>
  );

  // --- KOT PREVIEW COMPONENT ---
  const KOTPreview = () => (
    <div style={{ width: settings.kotWidth + 'px', background: 'white', padding: `${settings.kotMarginTop}px ${settings.kotMarginRight}px ${settings.kotMarginBottom}px ${settings.kotMarginLeft}px`, color: '#000', fontFamily: 'monospace', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', border: '2px solid #000', display: 'inline-block', padding: '4px 12px', marginBottom: '10px' }}>{settings.kotHeader}</div>
        <div style={{ fontSize: '11px' }}>12/04/24 15:12</div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', margin: '5px 0' }}>DINE IN • TABLE B3</div>
      </div>
      <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }}></div>
      <div style={{ fontSize: settings.kotFontSize + 'px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px', fontWeight: 'bold' }}>
          <span>ITEM NAME</span>
          <span style={{ textAlign: 'right' }}>QTY</span>
        </div>
        <div style={{ borderTop: '1px solid #000', margin: '4px 0' }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px', fontWeight: 'bold', fontSize: (settings.kotFontSize + 2) + 'px' }}>
              <span>PANEER TIKKA</span>
              <span style={{ textAlign: 'right' }}>2</span>
            </div>
            {settings.showAddonGroup && <div style={{ fontSize: (settings.kotFontSize - 2) + 'px', paddingLeft: '8px' }}>- EXTRA CHEESE</div>}
          </div>
        </div>
      </div>
      <div style={{ borderTop: '2px dashed #000', margin: '15px 0 10px' }}></div>
      {settings.showCustNote && <div style={{ fontSize: '11px', fontStyle: 'italic' }}>Note: Spicy well done.</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fcfcfd' }}>
      {/* Top Selector Bar */}
      <div style={{ background: 'white', padding: '16px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => setActiveMode('bill')}
            style={{ 
              padding: '12px 24px', borderRadius: '16px', fontSize: '14px', fontWeight: '950', cursor: 'pointer', border: 'none',
              background: activeMode === 'bill' ? '#94161c' : 'transparent',
              color: activeMode === 'bill' ? 'white' : '#64748b',
              display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.3s'
            }}
          >
            <FileText size={18} /> Bill Designer
          </button>
          <button 
            onClick={() => setActiveMode('kot')}
            style={{ 
              padding: '12px 24px', borderRadius: '16px', fontSize: '14px', fontWeight: '950', cursor: 'pointer', border: 'none',
              background: activeMode === 'kot' ? '#94161c' : 'transparent',
              color: activeMode === 'kot' ? 'white' : '#64748b',
              display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.3s'
            }}
          >
            <Printer size={18} /> KOT Designer
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button style={{ padding: '10px 20px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', color: '#1e293b', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>Reset Default</button>
           <button style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: '#1e293b', color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Save size={16} /> Save Changes
           </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(450px, 1fr) 1.2fr', gap: '0', overflow: 'hidden' }}>
        {/* CONFIGURATION PANEL */}
        <div style={{ borderRight: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: 'white', overflowY: 'auto' }} className="no-scrollbar">
          <div style={{ padding: '32px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '950', color: '#0f172a', marginBottom: '24px' }}>
              {activeMode === 'bill' ? 'Receipt Configuration' : 'Kitchen Order Logic'}
            </h4>

            {activeMode === 'bill' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '24px' }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: '950', color: '#64748b', marginBottom: '20px', textTransform: 'uppercase' }}>Header & Branding</span>
                  <InputField label="Restaurant Name" value={settings.resName} field="resName" />
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '8px' }}>Store Address / Contacts</label>
                    <textarea value={settings.headerText} onChange={(e) => updateSetting('headerText', e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: '700', outline: 'none', minHeight: '80px', background: 'white' }} />
                  </div>
                  <CheckboxField label="Restaurant Name (Bold)" value={settings.showResNameBold} field="showResNameBold" />
                  <CheckboxField label="Headline (Bold)" value={settings.showHeadlineBold} field="showHeadlineBold" />
                  <CheckboxField label="Print Company Logo" value={settings.printLogo} field="printLogo" />
                </div>

                <div style={{ border: '1.5px solid #f1f5f9', padding: '24px', borderRadius: '24px' }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: '950', color: '#64748b', marginBottom: '20px', textTransform: 'uppercase' }}>Item Logic</span>
                  <CheckboxField label="Show Addon multiplication" value={settings.showAddonMultiplication} field="showAddonMultiplication" />
                  <CheckboxField label="Show Addon Price" value={settings.showAddonPrice} field="showAddonPrice" />
                  <CheckboxField label="Separate Row for Addons" value={settings.showAddonSeparateRow} field="showAddonSeparateRow" />
                  <CheckboxField label="Net Total inclusive of GST msg" value={settings.showNetTotalMsg} field="showNetTotalMsg" />
                </div>

                <div style={{ border: '1.5px solid #f1f5f9', padding: '24px', borderRadius: '24px' }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: '950', color: '#64748b', marginBottom: '20px', textTransform: 'uppercase' }}>Visual & Font</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <InputField label="Width (mm)" value={settings.billMainWidth} field="billMainWidth" type="number" />
                    <InputField label="Res Font Size" value={settings.resFont} field="resFont" type="number" />
                  </div>
                  <InputField label="Font Family" value={settings.billFontFamily} field="billFontFamily" />
                </div>
              </div>
            )}

            {activeMode === 'kot' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '24px' }}>
                   <InputField label="KOT Main Title" value={settings.kotHeader} field="kotHeader" />
                   <CheckboxField label="Show Addon Group Names" value={settings.showAddonGroup} field="showAddonGroup" />
                   <CheckboxField label="Bold Addon Items" value={settings.kotBoldAddons} field="kotBoldAddons" />
                   <CheckboxField label="Show Kitchen Notes" value={settings.showCustNote} field="showCustNote" />
                 </div>
                 <div style={{ border: '1.5px solid #f1f5f9', padding: '24px', borderRadius: '24px' }}>
                    <InputField label="KOT Font Size" value={settings.kotFontSize} field="kotFontSize" type="number" />
                    <InputField label="KOT Paper Width" value={settings.kotWidth} field="kotWidth" type="number" />
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* DYNAMIC LIVE PREVIEW */}
        <div style={{ padding: '60px', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }} className="no-scrollbar">
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: '8px 20px', borderRadius: '40px', fontSize: '11px', fontWeight: '950', letterSpacing: '2px', display: 'inline-block' }}>
              LIVE {activeMode.toUpperCase()} PREVIEW
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', marginTop: '12px' }}>This accurately represents the printed thermal output.</p>
          </div>

          <div style={{ position: 'relative' }}>
             {/* Realistic Paper Shadow Effect */}
             <div style={{ position: 'absolute', top: '10px', left: '10px', right: '-10px', bottom: '-10px', background: '#e2e8f0', borderRadius: '4px', filter: 'blur(20px)', opacity: '0.4' }}></div>
             
             {activeMode === 'bill' ? <BillPreview /> : <KOTPreview />}
          </div>

          <div style={{ marginTop: '48px', display: 'flex', gap: '16px', color: '#94a3b8' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '800' }}>
               <Monitor size={14} /> Responsive Scaling
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '800' }}>
               <Check size={14} color="#10b981" /> ESC/POS Compatible
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillDesigner;
