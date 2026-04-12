import sys

file_path = r'c:\Users\mrrak\Desktop\restaurant-pos\src\App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target block for the header in Map and Grid views
# We'll replace the old "Table" header logic
old_header = """                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Table</div>
                        <div style={{ fontSize: '22px', fontWeight: '950', color: '#1e293b', marginTop: '-4px' }}>{table.name.replace('Table ', '')}</div>
                      </div>
                      {isRunning && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#fef3c7', padding: '2px 6px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', color: '#b45309' }}>
                            <TimeElapsed createdAt={table.createdAt} />
                          </span>
                        </div>
                      )}
                    </div>"""

new_header = """                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '4px' }}>
                      <div style={{ fontSize: '18px', fontWeight: '950', color: '#1e293b', letterSpacing: '-0.4px' }}>
                        Table {table.name.replace('Table ', '')}
                      </div>
                      {isRunning && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef3c7', padding: '4px 8px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                           <Clock size={10} color="#b45309" />
                           <span style={{ fontSize: '10px', fontWeight: '900', color: '#b45309' }}>
                             <TimeElapsed createdAt={table.createdAt} />
                           </span>
                        </div>
                      )}
                    </div>"""

content = content.replace(old_header, new_header)

# Target block for the body (Price and Items)
old_body = """                    <div style={{ textAlign: 'left', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: '900', color: isRunning ? (isPrinted ? '#10b981' : '#f97316') : '#94a3b8', textTransform: 'uppercase' }}>
                        {isPrinted ? 'READY' : (isRunning ? 'RUNNING' : 'VACANT')}
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: isRunning ? '#991b1b' : '#cbd5e1', margin: '2px 0' }}>
                        {tableTotal > 0 ? `₹${tableTotal}` : '--'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                        {table.order?.length || 0} items
                      </div>
                    </div>"""

new_body = """                    <div style={{ textAlign: 'left', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'center' }}>
                      <div style={{ fontSize: '10px', fontWeight: '900', color: isRunning ? (isPrinted ? '#10b981' : '#64748b') : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {isPrinted ? 'READY' : (isRunning ? 'RUNNING' : 'VACANT')}
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '950', color: isRunning ? '#c2410c' : '#cbd5e1', margin: '2px 0', lineHeight: 1 }}>
                        {tableTotal > 0 ? `₹${tableTotal}` : '--'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', fontWeight: '700' }}>
                        {table.order?.length || 0} items
                      </div>
                    </div>"""

content = content.replace(old_body, new_body)

# Target block for the footer (Buttons)
old_footer = """                    {isRunning && (
                       <div style={{ display: 'flex', gap: '6px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', width: '100%', justifyContent: 'center' }}>
                         <button onClick={(e) => { e.stopPropagation(); onQuickPrint(table); }} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px', borderRadius: '10px', cursor: 'pointer' }}><Printer size={14} color="#64748b" /></button>
                         <button onClick={(e) => { e.stopPropagation(); onQuickSettle(table); }} style={{ background: '#111827', border: 'none', padding: '6px', borderRadius: '10px', cursor: 'pointer' }}><CheckSquare size={14} color="white" /></button>
                         <button onClick={(e) => { e.stopPropagation(); setTableToClear(table.id); }} style={{ background: '#fff1f2', border: 'none', padding: '6px', borderRadius: '10px', cursor: 'pointer' }}><Trash2 size={14} color="#ef4444" /></button>
                       </div>
                    )}"""

new_footer = """                    {isRunning && (
                       <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', width: '100%' }}>
                         <button onClick={(e) => { e.stopPropagation(); onQuickPrint(table); }} style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Printer size={16} color="#64748b" /></button>
                         <button onClick={(e) => { e.stopPropagation(); onQuickSettle(table); }} style={{ flex: 1, background: '#111827', border: 'none', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckSquare size={16} color="white" /></button>
                         <button onClick={(e) => { e.stopPropagation(); setTableToClear(table.id); }} style={{ flex: 1, background: '#fff1f2', border: '1px solid #fecaca', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} color="#ef4444" /></button>
                       </div>
                    )}"""

content = content.replace(old_footer, new_footer)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Transformation Complete")
