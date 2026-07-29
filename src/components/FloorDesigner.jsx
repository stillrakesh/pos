import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  LayoutGrid, Plus, Trash2, CheckSquare, Zap, RotateCcw, RefreshCw, Maximize2
} from 'lucide-react';
import { apiService } from '../services/apiService';

/* --- FLOOR PLAN SETUP VIEW --- */
const FloorDesigner = ({ tables, setTables, sections, setSections, loadTables }) => {
  const [activeZone, setActiveZone] = useState(sections[0] || 'Main Floor');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [draggedTableId, setDraggedTableId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(100);
  const [gridSnap, setGridSnap] = useState(true);
  const [gridSize, setGridSize] = useState(15);
  const [snapToTables, setSnapToTables] = useState(true);
  const [newSectionName, setNewSectionName] = useState('');
  const [tableToDelete, setTableToDelete] = useState(null);
  const [draggingPos, setDraggingPos] = useState(null);
  const [activeSideTab, setActiveSideTab] = useState('add');
  const [guideLines, setGuideLines] = useState({ x: [], y: [] });
  const [marquee, setMarquee] = useState(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);

  // ── UNDO / REDO ──
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const MAX_HISTORY = 30;

  // ── TOAST NOTIFICATIONS ──
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((msg, type = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // ── LAYOUT TEMPLATE STATE ──
  const [templateRows, setTemplateRows] = useState(3);
  const [templateCols, setTemplateCols] = useState(3);
  const [templateSpacingX, setTemplateSpacingX] = useState(50);
  const [templateSpacingY, setTemplateSpacingY] = useState(50);

  const canvasRef = useRef(null);

  // Push current table state onto undo stack
  const pushUndo = useCallback(() => {
    const snapshot = JSON.parse(JSON.stringify(tables));
    setUndoStack(prev => {
      const next = [...prev, snapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setRedoStack([]);
  }, [tables]);

  const performUndo = useCallback(() => {
    if (undoStack.length === 0) { showToast('Nothing to undo', 'info'); return; }
    const currentSnapshot = JSON.parse(JSON.stringify(tables));
    setRedoStack(prev => {
      const next = [...prev, currentSnapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    const prevState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setTables(prevState);
    showToast('Undo', 'info');
    prevState.forEach(t => apiService.patchTable(t.id, { pos: t.pos, seats: t.seats, shape: t.shape, scale: t.scale }).catch(() => {}));
  }, [undoStack, tables, setTables, showToast]);

  const performRedo = useCallback(() => {
    if (redoStack.length === 0) { showToast('Nothing to redo', 'info'); return; }
    const currentSnapshot = JSON.parse(JSON.stringify(tables));
    setUndoStack(prev => {
      const next = [...prev, currentSnapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setTables(nextState);
    showToast('Redo', 'info');
    nextState.forEach(t => apiService.patchTable(t.id, { pos: t.pos, seats: t.seats, shape: t.shape, scale: t.scale }).catch(() => {}));
  }, [redoStack, tables, setTables, showToast]);

  // Auto-sync activeZone if sections change
  useEffect(() => {
    if (sections.length > 0 && !sections.includes(activeZone)) {
      setActiveZone(sections[0]);
    }
  }, [sections, activeZone]);

  // ── KEYBOARD SHORTCUTS ──
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      // Ctrl+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); performUndo(); return; }
      // Ctrl+Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z'))) { e.preventDefault(); performRedo(); return; }
      // Ctrl+A = Select all in zone
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set((tables || []).filter(t => t.type === activeZone).map(t => String(t.id))));
        showToast('All tables selected');
        return;
      }
      // Ctrl+D = Duplicate selected
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
      // Delete / Backspace = Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) { e.preventDefault(); deleteSelectedTable(); }
        return;
      }
      // Escape = Deselect
      if (e.key === 'Escape') { setSelectedIds(new Set()); return; }
      // Arrow keys = Nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : gridSize;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        nudgeSelected(dx, dy);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [performUndo, performRedo, selectedIds, tables, activeZone, gridSize]);

  // Derived: primary selected table
  const selectedTable = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const firstId = [...selectedIds][0];
    return (tables || []).find(t => String(t.id) === String(firstId)) || null;
  }, [tables, selectedIds]);

  const getTableDims = (table) => {
    const scale = table.scale || 1.0;
    let baseW = 90, baseH = 90;
    if (table.shape === 'rectangle') { baseW = 140; baseH = 85; }
    else if (table.shape === 'square') { baseW = 85; baseH = 85; }
    return { width: baseW * scale, height: baseH * scale };
  };

  // ── NUDGE SELECTED ──
  const nudgeSelected = async (dx, dy) => {
    pushUndo();
    const updated = tables.map(t => {
      if (!selectedIds.has(String(t.id)) || t.type !== activeZone) return t;
      return { ...t, pos: { x: Math.max(0, Math.min(1800, (t.pos?.x || 0) + dx)), y: Math.max(0, Math.min(1200, (t.pos?.y || 0) + dy)) } };
    });
    setTables(updated);
    try { await Promise.all(updated.filter(t => selectedIds.has(String(t.id))).map(t => apiService.patchTable(t.id, { pos: t.pos }))); }
    catch (err) { console.error('Nudge save failed:', err); }
  };

  // ── DUPLICATE SELECTED ──
  const duplicateSelected = async () => {
    if (selectedIds.size === 0) { showToast('Select a table to duplicate', 'warn'); return; }
    pushUndo();
    const toDup = (tables || []).filter(t => selectedIds.has(String(t.id)) && t.type === activeZone);
    const newIds = new Set();
    for (const t of toDup) {
      let count = 1; let newName = `${t.name}-copy`;
      while (tables.some(tb => String(tb.name) === newName)) { count++; newName = `${t.name}-copy${count}`; }
      const newTable = { name: newName, type: activeZone, status: 'vacant', pos: { x: (t.pos?.x || 0) + 30, y: (t.pos?.y || 0) + 30 }, seats: t.seats, shape: t.shape, scale: t.scale || 1.0, zoneLabel: '' };
      try {
        const res = await apiService.createTable(newTable);
        if (res.success && res.data) { const added = res.data.find(tb => String(tb.name) === newName); if (added) newIds.add(String(added.id)); }
      } catch (err) { console.error('Duplicate failed:', err); }
    }
    if (newIds.size > 0) { setSelectedIds(newIds); showToast(`Duplicated ${newIds.size} table(s)`); }
  };

  // ── MOUSE DOWN on a table ── (FIXED: canvas-relative coords with zoom)
  const handleTableMouseDown = (e, tableId) => {
    e.preventDefault();
    e.stopPropagation();
    const table = (tables || []).find(t => String(t.id) === String(tableId));
    if (!table) return;

    if (e.shiftKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(String(tableId))) next.delete(String(tableId));
        else next.add(String(tableId));
        return next;
      });
      return;
    }
    if (!selectedIds.has(String(tableId))) {
      setSelectedIds(new Set([String(tableId)]));
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    const scaleF = zoom / 100;
    const scrollLeft = canvasRef.current?.scrollLeft || 0;
    const scrollTop = canvasRef.current?.scrollTop || 0;
    setDragOffset({
      x: ((e.clientX - (rect?.left || 0) + scrollLeft) / scaleF) - (table.pos?.x || 0),
      y: ((e.clientY - (rect?.top || 0) + scrollTop) / scaleF) - (table.pos?.y || 0)
    });
    setDraggedTableId(tableId);
  };

  // ── MOUSE DOWN on canvas (marquee or clear)
  const handleCanvasMouseDown = (e) => {
    if (e.target !== e.currentTarget && !e.target.closest('[data-canvas-bg]')) return;
    setSelectedIds(new Set());
    setIsMarqueeSelecting(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    const scaleF = zoom / 100;
    const scrollLeft = canvasRef.current?.scrollLeft || 0;
    const scrollTop = canvasRef.current?.scrollTop || 0;
    const startX = (e.clientX - (rect?.left || 0) + scrollLeft) / scaleF;
    const startY = (e.clientY - (rect?.top || 0) + scrollTop) / scaleF;
    setMarquee({ startX, startY, endX: startX, endY: startY });
  };

  // ── MOUSE MOVE ── (FIXED: canvas-relative)
  const handleCanvasMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const scaleF = zoom / 100;
    const scrollLeft = canvasRef.current?.scrollLeft || 0;
    const scrollTop = canvasRef.current?.scrollTop || 0;

    if (isMarqueeSelecting && marquee) {
      const ex = (e.clientX - (rect?.left || 0) + scrollLeft) / scaleF;
      const ey = (e.clientY - (rect?.top || 0) + scrollTop) / scaleF;
      setMarquee(prev => ({ ...prev, endX: ex, endY: ey }));
      return;
    }
    if (!draggedTableId) return;
    e.preventDefault();

    const table = (tables || []).find(t => String(t.id) === String(draggedTableId));
    if (!table) return;
    const { width, height } = getTableDims(table);

    let newX = ((e.clientX - (rect?.left || 0) + scrollLeft) / scaleF) - dragOffset.x;
    let newY = ((e.clientY - (rect?.top || 0) + scrollTop) / scaleF) - dragOffset.y;

    if (gridSnap) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    const newGuideX = [];
    const newGuideY = [];
    const SNAP_THRESHOLD = 12;

    if (snapToTables) {
      const zoneTables = (tables || []).filter(t => t.type === activeZone && String(t.id) !== String(draggedTableId));
      for (const ot of zoneTables) {
        const { width: ow, height: oh } = getTableDims(ot);
        const ox = ot.pos?.x || 0;
        const oy = ot.pos?.y || 0;
        if (Math.abs(newX - ox) < SNAP_THRESHOLD) { newX = ox; newGuideX.push(ox); }
        if (Math.abs(newX - (ox + ow)) < SNAP_THRESHOLD) { newX = ox + ow; newGuideX.push(ox + ow); }
        if (Math.abs((newX + width) - ox) < SNAP_THRESHOLD) { newX = ox - width; newGuideX.push(ox); }
        if (Math.abs((newX + width / 2) - (ox + ow / 2)) < SNAP_THRESHOLD) { newX = ox + ow / 2 - width / 2; newGuideX.push(ox + ow / 2); }
        if (Math.abs(newY - oy) < SNAP_THRESHOLD) { newY = oy; newGuideY.push(oy); }
        if (Math.abs(newY - (oy + oh)) < SNAP_THRESHOLD) { newY = oy + oh; newGuideY.push(oy + oh); }
        if (Math.abs((newY + height) - oy) < SNAP_THRESHOLD) { newY = oy - height; newGuideY.push(oy); }
        if (Math.abs((newY + height / 2) - (oy + oh / 2)) < SNAP_THRESHOLD) { newY = oy + oh / 2 - height / 2; newGuideY.push(oy + oh / 2); }
      }
    }
    setGuideLines({ x: newGuideX, y: newGuideY });

    newX = Math.max(0, Math.min(1800 - width, newX));
    newY = Math.max(0, Math.min(1200 - height, newY));
    setDraggingPos({ x: Math.round(newX), y: Math.round(newY) });

    const draggedTable = (tables || []).find(t => String(t.id) === String(draggedTableId));
    const dx = newX - (draggedTable?.pos?.x || 0);
    const dy = newY - (draggedTable?.pos?.y || 0);

    setTables(prev => prev.map(t => {
      if (selectedIds.has(String(t.id)) && t.type === activeZone) {
        const nx = Math.max(0, Math.min(1800, (t.pos?.x || 0) + dx));
        const ny = Math.max(0, Math.min(1200, (t.pos?.y || 0) + dy));
        return { ...t, pos: { x: nx, y: ny } };
      }
      return t;
    }));
  };

  // ── MOUSE UP
  const handleCanvasMouseUp = async () => {
    setGuideLines({ x: [], y: [] });
    setDraggingPos(null);

    if (isMarqueeSelecting && marquee) {
      const minX = Math.min(marquee.startX, marquee.endX);
      const maxX = Math.max(marquee.startX, marquee.endX);
      const minY = Math.min(marquee.startY, marquee.endY);
      const maxY = Math.max(marquee.startY, marquee.endY);
      if (maxX - minX > 5 || maxY - minY > 5) {
        const newSel = new Set();
        (tables || []).filter(t => t.type === activeZone).forEach(t => {
          const tx = t.pos?.x || 0;
          const ty = t.pos?.y || 0;
          if (tx >= minX && tx <= maxX && ty >= minY && ty <= maxY) newSel.add(String(t.id));
        });
        setSelectedIds(newSel);
      }
      setIsMarqueeSelecting(false);
      setMarquee(null);
      return;
    }

    if (draggedTableId) {
      pushUndo();
      try {
        const movedTables = (tables || []).filter(t => selectedIds.has(String(t.id)));
        await Promise.all(movedTables.map(t => apiService.patchTable(t.id, { pos: t.pos })));
      } catch (err) { console.error('Failed to save table positions:', err); }
    }
    setDraggedTableId(null);
  };

  // ── ADD TABLE TEMPLATE
  const addTableTemplate = async (shape, seats) => {
    pushUndo();
    let count = 1;
    let newName = `${count}`;
    while (tables.some(t => String(t.name) === newName)) { count++; newName = `${count}`; }
    const stagger = (tables.filter(t => t.type === activeZone).length % 6) * 35;
    const newTableData = { name: newName, type: activeZone, status: 'vacant', pos: { x: 80 + stagger, y: 80 + stagger }, seats, shape, scale: 1.0, zoneLabel: '' };
    try {
      const res = await apiService.createTable(newTableData);
      if (res.success && res.data) {
        const added = res.data.find(t => String(t.name) === newName);
        if (added) setSelectedIds(new Set([String(added.id)]));
        showToast(`Table ${newName} added`);
      }
    } catch (err) { console.error('Failed to add table:', err); showToast('Error adding table', 'error'); }
  };

  // ── DELETE
  const deleteSelectedTable = () => {
    if (!selectedTable) return;
    if (selectedTable.status !== 'vacant') { showToast('Cannot delete a table with an active order', 'error'); return; }
    setTableToDelete(selectedTable);
  };

  const confirmDeleteTable = async () => {
    if (!tableToDelete) return;
    pushUndo();
    try {
      await apiService.deleteTable(tableToDelete.id);
      setSelectedIds(new Set());
      setTableToDelete(null);
      showToast('Table deleted');
    } catch (err) { console.error('Failed to delete table:', err); showToast('Error deleting table', 'error'); }
  };

  // ── PROPERTY CHANGE (single table)
  const handlePropertyChange = async (field, value) => {
    if (!selectedTable) return;
    pushUndo();
    const tableId = selectedTable.id;

    setTables(prev => prev.map(t => {
      if (String(t.id) === String(tableId)) {
        if (field === 'seats') return { ...t, seats: parseInt(value, 10) || 4 };
        if (field === 'scale') return { ...t, scale: parseFloat(value) || 1.0 };
        if (field === 'pos.x') return { ...t, pos: { ...t.pos, x: parseInt(value, 10) || 0 } };
        if (field === 'pos.y') return { ...t, pos: { ...t.pos, y: parseInt(value, 10) || 0 } };
        return { ...t, [field]: value };
      }
      return t;
    }));

    try {
      const updateData = {};
      if (field === 'name') updateData.table_number = value;
      else if (field === 'seats') updateData.seats = parseInt(value, 10) || 4;
      else if (field === 'shape') updateData.shape = value;
      else if (field === 'scale') updateData.scale = parseFloat(value) || 1.0;
      else if (field === 'type') updateData.zone = value;
      else if (field === 'pos.x') updateData.pos = { x: parseInt(value, 10) || 0, y: selectedTable.pos?.y || 0 };
      else if (field === 'pos.y') updateData.pos = { x: selectedTable.pos?.x || 0, y: parseInt(value, 10) || 0 };
      await apiService.patchTable(tableId, updateData);
    } catch (err) { console.error('Auto-save failed:', err); }
  };

  // ── ALIGNMENT (FIXED: only selected tables, never fallback to all)
  const getTargetTables = () => {
    return (tables || []).filter(t => t.type === activeZone && selectedIds.has(String(t.id)));
  };

  const alignTables = async (direction) => {
    const targets = getTargetTables();
    if (targets.length < 2) { showToast('Select 2+ tables to align', 'warn'); return; }
    pushUndo();

    const updatedTables = tables.map(t => {
      if (!targets.find(at => String(at.id) === String(t.id))) return t;
      const { width, height } = getTableDims(t);
      let nx = t.pos?.x || 0;
      let ny = t.pos?.y || 0;

      if (direction === 'left') nx = Math.min(...targets.map(at => at.pos?.x || 0));
      else if (direction === 'right') { const maxR = Math.max(...targets.map(at => (at.pos?.x || 0) + getTableDims(at).width)); nx = maxR - width; }
      else if (direction === 'centerH') { const avgX = targets.reduce((s, at) => s + (at.pos?.x || 0) + getTableDims(at).width / 2, 0) / targets.length; nx = avgX - width / 2; }
      else if (direction === 'top') ny = Math.min(...targets.map(at => at.pos?.y || 0));
      else if (direction === 'bottom') { const maxB = Math.max(...targets.map(at => (at.pos?.y || 0) + getTableDims(at).height)); ny = maxB - height; }
      else if (direction === 'centerV') { const avgY = targets.reduce((s, at) => s + (at.pos?.y || 0) + getTableDims(at).height / 2, 0) / targets.length; ny = avgY - height / 2; }

      return { ...t, pos: { x: Math.round(nx), y: Math.round(ny) } };
    });

    setTables(updatedTables);
    showToast(`Aligned ${targets.length} tables: ${direction}`);
    try { await Promise.all(updatedTables.filter(t => targets.find(at => String(at.id) === String(t.id))).map(t => apiService.patchTable(t.id, { pos: t.pos }))); }
    catch (err) { console.error('Align failed:', err); }
  };

  const distributeEqual = async (axis) => {
    const targets = getTargetTables();
    if (targets.length < 3) { showToast('Select 3+ tables to distribute', 'warn'); return; }
    pushUndo();

    const sorted = [...targets].sort((a, b) => axis === 'H' ? (a.pos?.x || 0) - (b.pos?.x || 0) : (a.pos?.y || 0) - (b.pos?.y || 0));
    const first = sorted[0];
    const dim = axis === 'H' ? 'width' : 'height';
    const posKey = axis === 'H' ? 'x' : 'y';
    const last = sorted[sorted.length - 1];
    const totalSpan = ((last.pos?.[posKey] || 0) + getTableDims(last)[dim]) - (first.pos?.[posKey] || 0);
    const totalTableSize = sorted.reduce((s, t) => s + getTableDims(t)[dim], 0);
    const gap = (totalSpan - totalTableSize) / (sorted.length - 1);

    let runPos = first.pos?.[posKey] || 0;
    const remapped = tables.map(t => {
      const idx = sorted.findIndex(at => String(at.id) === String(t.id));
      if (idx < 0) return t;
      const assignedPos = runPos;
      runPos += getTableDims(t)[dim] + gap;
      return { ...t, pos: { ...t.pos, [posKey]: Math.round(assignedPos) } };
    });

    setTables(remapped);
    showToast(`Distributed ${targets.length} tables evenly`);
    try { await Promise.all(remapped.filter(t => targets.find(at => String(at.id) === String(t.id))).map(t => apiService.patchTable(t.id, { pos: t.pos }))); }
    catch (err) { console.error('Distribute failed:', err); }
  };

  const autoArrangeGrid = async () => {
    const activeTables = (tables || []).filter(t => t.type === activeZone);
    if (activeTables.length === 0) return;
    pushUndo();
    const sorted = [...activeTables].sort((a, b) => {
      if (Math.abs((a.pos?.y || 0) - (b.pos?.y || 0)) < 60) return (a.pos?.x || 0) - (b.pos?.x || 0);
      return (a.pos?.y || 0) - (b.pos?.y || 0);
    });
    const cols = Math.min(5, activeTables.length);
    const spacingX = 180; const spacingY = 180;
    const updatedTables = tables.map(t => {
      if (t.type !== activeZone) return t;
      const idx = sorted.findIndex(at => String(at.id) === String(t.id));
      return { ...t, pos: { x: 60 + (idx % cols) * spacingX, y: 60 + Math.floor(idx / cols) * spacingY } };
    });
    setTables(updatedTables);
    showToast('Auto-arranged in grid');
    try { await Promise.all(updatedTables.filter(t => t.type === activeZone).map(t => apiService.patchTable(t.id, { pos: t.pos }))); }
    catch (err) { console.error('Auto-arrange failed:', err); }
  };

  const snapAllToGrid = async () => {
    pushUndo();
    const updatedTables = tables.map(t => {
      if (t.type !== activeZone) return t;
      return { ...t, pos: { x: Math.round((t.pos?.x || 0) / gridSize) * gridSize, y: Math.round((t.pos?.y || 0) / gridSize) * gridSize } };
    });
    setTables(updatedTables);
    showToast('Snapped all to grid');
    try { await Promise.all(updatedTables.filter(t => t.type === activeZone).map(t => apiService.patchTable(t.id, { pos: t.pos }))); }
    catch (err) { console.error('Snap-all failed:', err); }
  };

  // ── LAYOUT TEMPLATES ──
  const applyLayoutTemplate = async (rows, cols, gapX, gapY) => {
    const totalToCreate = rows * cols;
    const existingZoneTables = (tables || []).filter(t => t.type === activeZone);

    if (existingZoneTables.length > 0) {
      if (!window.confirm(`This will add ${totalToCreate} new tables to "${activeZone}". Existing ${existingZoneTables.length} tables will remain. Continue?`)) return;
    }

    pushUndo();
    showToast(`Creating ${totalToCreate} tables...`);
    const letters = 'ABCDEFGHIJ';
    const newIds = new Set();
    const baseX = 60;
    const baseY = 60;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rowLetter = letters[r] || String(r + 1);
        let newName = `${rowLetter}${c + 1}`;
        let attempt = 0;
        while (tables.some(t => String(t.name) === newName)) { attempt++; newName = `${rowLetter}${c + 1}-${attempt}`; }

        const newTable = {
          name: newName,
          type: activeZone,
          status: 'vacant',
          pos: { x: baseX + c * (90 + gapX), y: baseY + r * (90 + gapY) },
          seats: 4,
          shape: 'square',
          scale: 1.0,
          zoneLabel: ''
        };

        try {
          const res = await apiService.createTable(newTable);
          if (res.success && res.data) {
            const added = res.data.find(t => String(t.name) === newName);
            if (added) newIds.add(String(added.id));
          }
        } catch (err) { console.error('Template table create failed:', err); }
      }
    }

    showToast(`Created ${newIds.size} tables in ${rows}×${cols} grid`);
    setSelectedIds(newIds);
  };

  const addNewZone = () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    if (sections.includes(trimmed)) { showToast('Area already exists', 'warn'); return; }
    setSections([...sections, trimmed]);
    setActiveZone(trimmed);
    setNewSectionName('');
    showToast(`Zone "${trimmed}" created`);
  };

  const deleteActiveZone = () => {
    if (tables.some(t => t.type === activeZone)) { showToast('Delete or move all tables first', 'warn'); return; }
    if (window.confirm(`Delete area "${activeZone}"?`)) {
      const filtered = sections.filter(s => s !== activeZone);
      setSections(filtered);
      setActiveZone(filtered[0] || '');
    }
  };

  // ── RESET FUNCTIONS ──
  const resetView = () => {
    setZoom(100);
    if (canvasRef.current) { canvasRef.current.scrollTop = 0; canvasRef.current.scrollLeft = 0; }
    showToast('View reset');
  };

  const resetLayout = () => {
    if (window.confirm('Reset all table positions to last saved state? This will reload from server.')) {
      loadTables();
      setSelectedIds(new Set());
      setUndoStack([]);
      setRedoStack([]);
      showToast('Layout reloaded from server');
    }
  };

  // ── CHAIRS RENDERING
  const renderChairsForCircle = (seats, size) => {
    const chairs = []; const R = size / 2;
    for (let i = 0; i < Math.min(seats, 12); i++) {
      const angle = (i * 2 * Math.PI) / Math.min(seats, 12) - Math.PI / 2;
      const x = R + Math.cos(angle) * (R + 6) - 7;
      const y = R + Math.sin(angle) * (R + 6) - 7;
      chairs.push(<div key={i} style={{ position: 'absolute', left: `${x}px`, top: `${y}px`, width: '13px', height: '13px', borderRadius: '50%', background: '#fff', border: '2px solid #7c3aed', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', zIndex: 1 }} />);
    }
    return chairs;
  };

  const renderChairsForSquare = (seats, w, h) => {
    const chairs = []; const sides = { top: [], bottom: [], left: [], right: [] };
    for (let i = 0; i < Math.min(seats, 16); i++) {
      const si = i % 4;
      if (si === 0) sides.top.push(i); else if (si === 1) sides.bottom.push(i); else if (si === 2) sides.left.push(i); else sides.right.push(i);
    }
    sides.top.forEach((id, idx) => { const left = ((idx + 1) * w) / (sides.top.length + 1) - 6; chairs.push(<div key={`t-${id}`} style={{ position: 'absolute', left: `${left}px`, top: '-10px', width: '13px', height: '13px', borderRadius: '3px', background: '#fff', border: '2px solid #7c3aed', zIndex: 1 }} />); });
    sides.bottom.forEach((id, idx) => { const left = ((idx + 1) * w) / (sides.bottom.length + 1) - 6; chairs.push(<div key={`b-${id}`} style={{ position: 'absolute', left: `${left}px`, bottom: '-10px', width: '13px', height: '13px', borderRadius: '3px', background: '#fff', border: '2px solid #7c3aed', zIndex: 1 }} />); });
    sides.left.forEach((id, idx) => { const top = ((idx + 1) * h) / (sides.left.length + 1) - 6; chairs.push(<div key={`l-${id}`} style={{ position: 'absolute', left: '-10px', top: `${top}px`, width: '13px', height: '13px', borderRadius: '3px', background: '#fff', border: '2px solid #7c3aed', zIndex: 1 }} />); });
    sides.right.forEach((id, idx) => { const top = ((idx + 1) * h) / (sides.right.length + 1) - 6; chairs.push(<div key={`r-${id}`} style={{ position: 'absolute', right: '-10px', top: `${top}px`, width: '13px', height: '13px', borderRadius: '3px', background: '#fff', border: '2px solid #7c3aed', zIndex: 1 }} />); });
    return chairs;
  };

  // Style helpers
  const sTab = (id) => ({
    flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: '900', border: 'none', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.3px',
    background: activeSideTab === id ? '#7c3aed' : 'transparent',
    color: activeSideTab === id ? 'white' : '#64748b'
  });

  const AlignBtn = ({ label, title: tt, onClick: oc, icon }) => (
    <button onClick={oc} title={tt} style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: '900', border: '1px solid #e2e8f0', background: 'white', color: '#334155', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#7c3aed'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#334155'; }}
    >
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  const ToolBtn = ({ title, onClick, disabled, children }) => (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: disabled ? '#cbd5e1' : '#475569', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 75px)', background: '#f8fafc', overflow: 'hidden' }} className="animate-fade-in">

      {/* ── TOAST NOTIFICATION ── */}
      {toast && (
        <div style={{ position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#dc2626' : toast.type === 'warn' ? '#f59e0b' : '#0f172a', color: 'white', padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: '800', zIndex: 99999, boxShadow: '0 8px 30px rgba(0,0,0,0.25)', animation: 'fadeIn 0.15s ease-out', pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}

      {/* ── LEFT SIDEBAR ── */}
      <div style={{ width: '320px', background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LayoutGrid size={20} color="#7c3aed" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Floor Designer</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Advanced Layout Editor</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <button style={sTab('add')} onClick={() => setActiveSideTab('add')}>＋ Add</button>
          <button style={sTab('properties')} onClick={() => setActiveSideTab('properties')}>⚙ Props</button>
          <button style={sTab('arrange')} onClick={() => setActiveSideTab('arrange')}>⬛ Align</button>
          <button style={sTab('zones')} onClick={() => setActiveSideTab('zones')}>🗂 Zones</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }} className="no-scrollbar">

          {/* ── TAB: ADD ── */}
          {activeSideTab === 'add' && (
            <>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Quick Add Templates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { shape: 'circle', seats: 2, label: 'Couple Round', sub: '2 seats', icon: '◉' },
                    { shape: 'circle', seats: 4, label: 'Round Table', sub: '4 seats', icon: '⬤' },
                    { shape: 'square', seats: 4, label: 'Square Table', sub: '4 seats', icon: '■' },
                    { shape: 'rectangle', seats: 6, label: 'Long Table', sub: '6 seats', icon: '▬' },
                    { shape: 'rectangle', seats: 8, label: 'Banquet Table', sub: '8 seats', icon: '▬▬' },
                  ].map(({ shape, seats, label, sub, icon }) => (
                    <button key={label} onClick={() => addTableTemplate(shape, seats)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = '#f5f3ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: '22px', width: '28px', textAlign: 'center' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>{label}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{sub} · {shape}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── LAYOUT TEMPLATES ── */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Layout Templates</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px' }}>
                  {[
                    { r: 2, c: 3, label: '2 × 3' },
                    { r: 3, c: 3, label: '3 × 3' },
                    { r: 3, c: 4, label: '3 × 4' },
                    { r: 4, c: 5, label: '4 × 5' },
                  ].map(({ r, c, label }) => (
                    <button key={label} onClick={() => applyLayoutTemplate(r, c, 50, 50)}
                      style={{ padding: '10px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = '#f5f3ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: '900', color: '#7c3aed' }}>{label}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>{r * c} tables</div>
                    </button>
                  ))}
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', marginBottom: '10px' }}>Custom Grid</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Rows</label>
                      <input type="number" min="1" max="10" value={templateRows} onChange={e => setTemplateRows(Math.max(1, Math.min(10, Number(e.target.value))))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '900', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Columns</label>
                      <input type="number" min="1" max="10" value={templateCols} onChange={e => setTemplateCols(Math.max(1, Math.min(10, Number(e.target.value))))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '900', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>H-Spacing: {templateSpacingX}px</label>
                    <input type="range" min="20" max="120" step="5" value={templateSpacingX} onChange={e => setTemplateSpacingX(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }} />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>V-Spacing: {templateSpacingY}px</label>
                    <input type="range" min="20" max="120" step="5" value={templateSpacingY} onChange={e => setTemplateSpacingY(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '800', marginBottom: '8px', textAlign: 'center' }}>
                    Will create {templateRows * templateCols} tables
                  </div>
                  <button onClick={() => applyLayoutTemplate(templateRows, templateCols, templateSpacingX, templateSpacingY)}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: '#7c3aed', color: 'white', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                    Apply {templateRows}×{templateCols} Grid
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Canvas Settings</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>Grid Snap</label>
                    <button onClick={() => setGridSnap(!gridSnap)} style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', border: 'none', cursor: 'pointer', background: gridSnap ? '#ecfdf5' : '#f1f5f9', color: gridSnap ? '#059669' : '#64748b' }}>
                      {gridSnap ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>Grid Size: {gridSize}px</label>
                    <input type="range" min="5" max="50" step="5" value={gridSize} onChange={e => setGridSize(Number(e.target.value))} style={{ flex: 1, accentColor: '#7c3aed', cursor: 'pointer' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>Snap to Tables</label>
                    <button onClick={() => setSnapToTables(!snapToTables)} style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', border: 'none', cursor: 'pointer', background: snapToTables ? '#eff6ff' : '#f1f5f9', color: snapToTables ? '#2563eb' : '#64748b' }}>
                      {snapToTables ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── TAB: PROPERTIES ── */}
          {activeSideTab === 'properties' && (
            <>
              {selectedTable ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ padding: '10px 12px', background: '#f5f3ff', borderRadius: '10px', fontSize: '11px', color: '#7c3aed', fontWeight: '800' }}>
                    Table: <strong>{selectedTable.name}</strong>
                    {selectedIds.size > 1 && <span style={{ color: '#64748b', marginLeft: '8px' }}>+{selectedIds.size - 1} more selected</span>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Table Name</label>
                    <input type="text" value={selectedTable.name || ''} onChange={e => handlePropertyChange('name', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontWeight: '900', background: 'white', outline: 'none' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Position (X, Y)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>X (Left)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2px 8px' }}>
                          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '900' }}>X</span>
                          <input type="number" value={Math.round(selectedTable.pos?.x || 0)} onChange={e => handlePropertyChange('pos.x', e.target.value)}
                            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '13px', fontWeight: '900', padding: '6px 0', outline: 'none', width: '100%' }} />
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>px</span>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Y (Top)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2px 8px' }}>
                          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '900' }}>Y</span>
                          <input type="number" value={Math.round(selectedTable.pos?.y || 0)} onChange={e => handlePropertyChange('pos.y', e.target.value)}
                            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '13px', fontWeight: '900', padding: '6px 0', outline: 'none', width: '100%' }} />
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>px</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Seats ({selectedTable.seats})</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => handlePropertyChange('seats', Math.max(1, selectedTable.seats - 1))}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>−</button>
                      <span style={{ flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: '800' }}>{selectedTable.seats}</span>
                      <button onClick={() => handlePropertyChange('seats', selectedTable.seats + 1)}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>+</button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Shape</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[['circle', 'Round', '◉'], ['square', 'Square', '■'], ['rectangle', 'Long', '▬']].map(([sh, lb, ic]) => (
                        <button key={sh} onClick={() => handlePropertyChange('shape', sh)}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', border: `2px solid ${selectedTable.shape === sh ? '#7c3aed' : '#cbd5e1'}`, background: selectedTable.shape === sh ? '#f5f3ff' : 'white', color: selectedTable.shape === sh ? '#7c3aed' : '#475569' }}>
                          {ic} {lb}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Size: {(selectedTable.scale || 1.0).toFixed(1)}×</label>
                    <input type="range" min="0.6" max="2.5" step="0.1" value={selectedTable.scale || 1.0} onChange={e => handlePropertyChange('scale', e.target.value)}
                      style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginTop: '2px' }}>
                      <span>Tiny</span><span>Normal</span><span>Massive</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Move to Zone</label>
                    <select value={selectedTable.type || ''} onChange={e => handlePropertyChange('type', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '800', background: 'white' }}>
                      {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={duplicateSelected}
                      style={{ flex: 1, border: '1px solid #e2e8f0', background: '#f5f3ff', color: '#7c3aed', padding: '10px', borderRadius: '10px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Plus size={14} /> Duplicate
                    </button>
                    <button onClick={deleteSelectedTable}
                      style={{ flex: 1, border: 'none', background: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '10px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '28px 16px', border: '1.5px dashed #cbd5e1', borderRadius: '16px', color: '#94a3b8', fontSize: '12px', fontWeight: '700' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>👆</div>
                  Click any table on the canvas to inspect and edit its properties.
                  <div style={{ marginTop: '10px', fontSize: '11px', color: '#b0bec5' }}>Hold Shift to multi-select · Ctrl+D to duplicate</div>
                </div>
              )}
            </>
          )}

          {/* ── TAB: ALIGN & ARRANGE ── */}
          {activeSideTab === 'arrange' && (
            <>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                  Alignment
                  <span style={{ fontSize: '11px', color: selectedIds.size >= 2 ? '#059669' : '#ef4444', fontWeight: '700', textTransform: 'none', marginLeft: '6px' }}>
                    {selectedIds.size >= 2 ? `(${selectedIds.size} selected ✓)` : `(select 2+ tables)`}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                  <AlignBtn label="Left" title="Align left edges" icon="⬤⬜⬜" onClick={() => alignTables('left')} />
                  <AlignBtn label="Center H" title="Center horizontally" icon="⬜⬤⬜" onClick={() => alignTables('centerH')} />
                  <AlignBtn label="Right" title="Align right edges" icon="⬜⬜⬤" onClick={() => alignTables('right')} />
                  <AlignBtn label="Top" title="Align top edges" icon="⬤⬜" onClick={() => alignTables('top')} />
                  <AlignBtn label="Center V" title="Center vertically" icon="⬜⬤" onClick={() => alignTables('centerV')} />
                  <AlignBtn label="Bottom" title="Align bottom edges" icon="⬜⬤" onClick={() => alignTables('bottom')} />
                </div>

                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px', marginTop: '14px' }}>Distribute (3+ tables)</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  <AlignBtn label="Even H" title="Distribute horizontally" icon="⬤·⬤·⬤" onClick={() => distributeEqual('H')} />
                  <AlignBtn label="Even V" title="Distribute vertically" icon="⬤:⬤:⬤" onClick={() => distributeEqual('V')} />
                </div>

                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px', marginTop: '4px' }}>Bulk Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={autoArrangeGrid} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', cursor: 'pointer', fontWeight: '900', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = '#f5f3ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}>
                    <LayoutGrid size={14} /> Auto Grid Arrangement
                  </button>
                  <button onClick={snapAllToGrid} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', cursor: 'pointer', fontWeight: '900', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = '#f5f3ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}>
                    <Zap size={14} /> Snap All to Grid
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Selection</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setSelectedIds(new Set((tables || []).filter(t => t.type === activeZone).map(t => String(t.id))))}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', cursor: 'pointer', fontWeight: '800', fontSize: '11px' }}>
                    Select All
                  </button>
                  <button onClick={() => setSelectedIds(new Set())}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', cursor: 'pointer', fontWeight: '800', fontSize: '11px' }}>
                    Deselect
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Keyboard Shortcuts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#64748b' }}>
                  {[['Ctrl+Z', 'Undo'], ['Ctrl+Y', 'Redo'], ['Ctrl+A', 'Select All'], ['Ctrl+D', 'Duplicate'], ['Delete', 'Delete Table'], ['Arrows', 'Nudge'], ['Shift+↑↓←→', 'Fine Nudge (1px)'], ['Escape', 'Deselect']].map(([key, desc]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span style={{ fontWeight: '800', color: '#475569', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>{key}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── TAB: ZONES ── */}
          {activeSideTab === 'zones' && (
            <>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Floor Zones</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {sections.map(sec => (
                    <button key={sec} onClick={() => { setActiveZone(sec); setSelectedIds(new Set()); }}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: `2px solid ${activeZone === sec ? '#7c3aed' : '#e2e8f0'}`, background: activeZone === sec ? '#f5f3ff' : 'white', color: activeZone === sec ? '#7c3aed' : '#334155', cursor: 'pointer', fontWeight: '900', fontSize: '12px', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                      {sec}
                      <span style={{ background: '#e2e8f0', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', color: '#475569' }}>
                        {tables.filter(t => t.type === sec).length}
                      </span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder="New zone name..." value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNewZone()}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none' }} />
                  <button onClick={addNewZone} style={{ padding: '0 14px', borderRadius: '8px', background: '#7c3aed', border: 'none', color: 'white', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>Add</button>
                </div>
                {sections.length > 1 && (
                  <button onClick={deleteActiveZone} style={{ width: '100%', marginTop: '8px', background: 'transparent', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}>
                    Delete "{activeZone}" zone
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── CANVAS WORKSPACE ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Top toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0, gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }} className="no-scrollbar">
            {sections.map(sec => (
              <button key={sec} onClick={() => { setActiveZone(sec); setSelectedIds(new Set()); }}
                style={{ padding: '8px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '900', border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', background: activeZone === sec ? '#f5f3ff' : 'transparent', color: activeZone === sec ? '#7c3aed' : '#64748b' }}>
                {sec} ({tables.filter(t => t.type === sec).length})
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {selectedIds.size > 0 && (
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#7c3aed', background: '#f5f3ff', padding: '4px 10px', borderRadius: '20px', border: '1px solid #c4b5fd' }}>
                {selectedIds.size} selected
              </span>
            )}

            <ToolBtn title="Undo (Ctrl+Z)" onClick={performUndo} disabled={undoStack.length === 0}>
              <RotateCcw size={14} />
            </ToolBtn>
            <ToolBtn title="Redo (Ctrl+Y)" onClick={performRedo} disabled={redoStack.length === 0}>
              <RefreshCw size={14} />
            </ToolBtn>

            <div style={{ width: '1px', height: '22px', background: '#e2e8f0', margin: '0 2px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>{zoom}%</span>
              <input type="range" min="30" max="160" step="10" value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '60px', cursor: 'pointer', accentColor: '#7c3aed' }} />
            </div>

            <ToolBtn title="Reset View (zoom + scroll)" onClick={resetView}>
              <Maximize2 size={13} />
            </ToolBtn>
            <ToolBtn title="Reload layout from server" onClick={resetLayout}>
              <RotateCcw size={13} /><span style={{ fontSize: '11px' }}>Reset</span>
            </ToolBtn>

            <div style={{ width: '1px', height: '22px', background: '#e2e8f0', margin: '0 2px' }} />

            <button onClick={() => { loadTables(); }} style={{ padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckSquare size={14} /> Save & Exit
            </button>
          </div>
        </div>

        {/* Scrollable canvas */}
        <div
          ref={canvasRef}
          data-canvas-bg="true"
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseDown={handleCanvasMouseDown}
          onClick={() => { if (!draggedTableId) setSelectedIds(new Set()); }}
          style={{ flex: 1, overflow: 'scroll', background: '#f1f5f9', backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)', backgroundSize: `${gridSize * 2}px ${gridSize * 2}px`, position: 'relative', padding: '40px', cursor: isMarqueeSelecting ? 'crosshair' : 'default' }}
        >
          <div style={{ width: '1900px', height: '1300px', position: 'relative', transform: `scale(${zoom / 100})`, transformOrigin: 'top left', transition: draggedTableId ? 'none' : 'transform 0.1s ease-out' }}>

            {guideLines.x.map((gx, i) => (
              <div key={`gx-${i}`} style={{ position: 'absolute', left: `${gx}px`, top: 0, bottom: 0, width: '1.5px', borderLeft: '1.5px dashed #7c3aed', pointerEvents: 'none', zIndex: 100, opacity: 0.8 }} />
            ))}
            {guideLines.y.map((gy, i) => (
              <div key={`gy-${i}`} style={{ position: 'absolute', top: `${gy}px`, left: 0, right: 0, height: '1.5px', borderTop: '1.5px dashed #7c3aed', pointerEvents: 'none', zIndex: 100, opacity: 0.8 }} />
            ))}

            {isMarqueeSelecting && marquee && Math.abs(marquee.endX - marquee.startX) > 5 && (
              <div style={{ position: 'absolute', left: `${Math.min(marquee.startX, marquee.endX)}px`, top: `${Math.min(marquee.startY, marquee.endY)}px`, width: `${Math.abs(marquee.endX - marquee.startX)}px`, height: `${Math.abs(marquee.endY - marquee.startY)}px`, border: '1.5px dashed #7c3aed', background: 'rgba(124, 58, 237, 0.07)', pointerEvents: 'none', zIndex: 98, borderRadius: '6px' }} />
            )}

            {tables.filter(t => t.type === activeZone).map(table => {
              const { width, height } = getTableDims(table);
              const isSelected = selectedIds.has(String(table.id));
              const isPrimary = selectedTable && String(selectedTable.id) === String(table.id);

              return (
                <div
                  key={table.id}
                  onMouseDown={(e) => handleTableMouseDown(e, table.id)}
                  onClick={(e) => { e.stopPropagation(); if (!e.shiftKey) setSelectedIds(new Set([String(table.id)])); }}
                  style={{ position: 'absolute', left: `${table.pos?.x || 100}px`, top: `${table.pos?.y || 100}px`, width: `${width}px`, height: `${height}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: draggedTableId === table.id ? 'grabbing' : 'grab', userSelect: 'none', transition: draggedTableId ? 'none' : 'filter 0.15s ease', filter: isSelected ? 'none' : undefined }}
                >
                  {isSelected && (
                    <div style={{ position: 'absolute', inset: '-5px', borderRadius: table.shape === 'circle' ? '50%' : '20px', border: `2px solid ${isPrimary ? '#7c3aed' : '#a78bfa'}`, background: 'rgba(124, 58, 237, 0.06)', pointerEvents: 'none', zIndex: 10, boxShadow: isPrimary ? '0 0 16px rgba(124,58,237,0.35)' : '0 0 8px rgba(124,58,237,0.15)' }} />
                  )}

                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {table.shape === 'circle' ? renderChairsForCircle(table.seats || 4, width) : renderChairsForSquare(table.seats || 4, width, height)}
                  </div>

                  <div style={{ width: '100%', height: '100%', background: isSelected ? '#f5f3ff' : '#ffffff', border: `2.5px solid ${isSelected ? '#7c3aed' : '#1e293b'}`, borderRadius: table.shape === 'circle' ? '50%' : table.shape === 'square' ? '10px' : '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: isSelected ? '0 0 0 0 transparent' : '0 4px 10px rgba(0,0,0,0.08)', position: 'relative', zIndex: 2, boxSizing: 'border-box', padding: '4px' }}>
                    <div style={{ width: '38%', height: '38%', borderRadius: '50%', border: '1.5px dashed #e2e8f0', position: 'absolute', opacity: 0.4 }} />
                    <span style={{ fontSize: `${Math.max(10, 13 * (table.scale || 1))}px`, fontWeight: '800', color: '#0f172a', zIndex: 3, textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '88%' }}>{table.name}</span>
                    <span style={{ fontSize: `${Math.max(8, 9 * (table.scale || 1))}px`, fontWeight: '800', color: '#64748b', zIndex: 3 }}>{table.seats}p</span>
                  </div>

                  {draggedTableId === table.id && draggingPos && (
                    <div style={{ position: 'absolute', bottom: '-26px', left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', fontSize: '11px', fontWeight: '900', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', zIndex: 200, pointerEvents: 'none' }}>
                      {draggingPos.x}, {draggingPos.y}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── DELETE MODAL ── */}
      {tableToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="animate-fade-in" style={{ background: 'white', padding: '32px', borderRadius: '20px', width: '360px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Trash2 size={26} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Delete {tableToDelete.name}?</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '22px', lineHeight: '1.5' }}>This permanently removes the table from the floor layout.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setTableToDelete(null)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', color: '#475569', borderRadius: '10px', fontWeight: '900', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteTable} style={{ flex: 1, padding: '12px', background: '#dc2626', border: 'none', color: 'white', borderRadius: '10px', fontWeight: '900', cursor: 'pointer' }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloorDesigner;
