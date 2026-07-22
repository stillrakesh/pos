/**
 * migrate-pickup-data.mjs - v2
 * Reads Chromium LevelDB localStorage (UTF-16LE values) and migrates
 * Pickup/Takeaway/Delivery orders into pos_orders.db
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import os from 'os';
import initSqlJs from 'sql.js';

// ── 1. Locate paths ──────────────────────────────────────────────────────────
const userData = join(os.homedir(), 'Library', 'Application Support', 'Restaurant POS');
const lvlDbDir = join(userData, 'Local Storage', 'leveldb');
const dbPath   = join(userData, 'data', 'pos_orders.db');

console.log('📂 LevelDB:', lvlDbDir);
console.log('🗄️  DB:     ', dbPath);

// ── 2. Read all LDB files as raw buffers ─────────────────────────────────────
const files = readdirSync(lvlDbDir).filter(f => f.endsWith('.ldb') || f.endsWith('.log'));

// ── 3. Chromium localStorage key/value extraction ────────────────────────────
// Keys are UTF-8, Values are length-prefixed UTF-16LE (preceded by 0x01 byte)
function extractFromBuffer(buf) {
  const results = {};
  // Scan for known keys encoded as UTF-8
  const keysToFind = ['pos_order_history', 'pos_nontable_orders'];
  
  for (const key of keysToFind) {
    const keyBuf = Buffer.from(key, 'utf8');
    let offset = 0;
    while (offset < buf.length - keyBuf.length) {
      // Find the key
      const idx = buf.indexOf(keyBuf, offset);
      if (idx === -1) break;
      offset = idx + keyBuf.length;
      
      // After the key, Chromium stores: some bytes then 0x01 then UTF-16LE value
      // Look for 0x01 then '[' encoded as UTF-16LE (0x5b 0x00) within next 30 bytes
      const searchEnd = Math.min(offset + 30, buf.length);
      for (let i = offset; i < searchEnd; i++) {
        // UTF-16LE '[' = 0x5b 0x00
        if (buf[i] === 0x5b && buf[i+1] === 0x00) {
          // Found start of UTF-16LE JSON array
          // Find end: ']' UTF-16LE = 0x5d 0x00
          let depth = 0;
          let end = i;
          while (end < buf.length - 1) {
            const ch = buf[end];
            const next = buf[end+1];
            if (next === 0x00) { // likely UTF-16LE char
              if (ch === 0x5b) depth++;      // [
              else if (ch === 0x7b) depth++; // {
              else if (ch === 0x5d) { depth--; if (depth <= 0) { end += 2; break; } } // ]
              else if (ch === 0x7d && depth > 0) depth--; // }
            }
            end++;
          }
          const utf16Slice = buf.slice(i, end);
          try {
            const str = utf16Slice.toString('utf16le');
            const parsed = JSON.parse(str);
            if (!results[key]) results[key] = [];
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            results[key].push(...arr);
            console.log(`   Found ${arr.length} items for key "${key}" at offset ${idx}`);
          } catch (_) {}
          break;
        }
        // Also try plain ASCII '[' (for log files)
        if (buf[i] === 0x5b && buf[i+1] !== 0x00) {
          let depth = 0;
          let end = i;
          while (end < buf.length) {
            if (buf[end] === 0x5b || buf[end] === 0x7b) depth++;
            else if (buf[end] === 0x5d || buf[end] === 0x7d) { depth--; if (depth <= 0) { end++; break; } }
            end++;
          }
          const jsonStr = buf.slice(i, end).toString('utf8');
          try {
            const parsed = JSON.parse(jsonStr);
            if (!results[key]) results[key] = [];
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            results[key].push(...arr);
            console.log(`   Found ${arr.length} items (ASCII) for key "${key}" at offset ${idx}`);
          } catch (_) {}
          break;
        }
      }
    }
  }
  return results;
}

console.log('\n🔍 Scanning LevelDB files…');
const allResults = {};
for (const f of files) {
  console.log(`   Reading ${f}…`);
  const buf = readFileSync(join(lvlDbDir, f));
  const found = extractFromBuffer(buf);
  for (const [k, v] of Object.entries(found)) {
    if (!allResults[k]) allResults[k] = [];
    allResults[k].push(...v);
  }
}

const orderHistory   = allResults['pos_order_history']   || [];
const nontableOrders = allResults['pos_nontable_orders'] || [];

console.log(`\n📊 pos_order_history:   ${orderHistory.length} records`);
console.log(`   pos_nontable_orders: ${nontableOrders.length} records`);

// ── 4. Filter pickup orders ───────────────────────────────────────────────────
const allOrders = [...orderHistory, ...nontableOrders];
const pickupOrders = [];
const seen = new Set();
for (const o of allOrders) {
  const id   = String(o.id || o.table_number || '').toUpperCase();
  const type = String(o.type || o.orderType || '').toLowerCase();
  const isPickup = id.startsWith('TA-') || id.startsWith('DL-') || 
                   id.startsWith('TAK-') || id.startsWith('DEL-') ||
                   type.includes('takeaway') || type.includes('delivery') || type.includes('pickup');
  if (isPickup && !seen.has(id)) {
    seen.add(id);
    pickupOrders.push(o);
  }
}

console.log(`\n📦 Unique pickup/takeaway/delivery orders: ${pickupOrders.length}`);
if (pickupOrders.length === 0) {
  // Print what we DID find for debugging
  console.log('\n🔎 Debug: first 3 orders from order history:');
  orderHistory.slice(0, 3).forEach((o, i) => {
    console.log(`   [${i}] id=${o.id} type=${o.type || o.orderType} tableNum=${o.table_number}`);
  });
  process.exit(0);
}

// ── 5. Open SQLite and insert ─────────────────────────────────────────────────
const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(dbPath));

let inserted = 0, skipped = 0;
for (const o of pickupOrders) {
  const tableNum  = String(o.id || o.table_number || '').toUpperCase();
  const items     = o.cart || o.orders || o.items || [];
  const grandTotal    = o.grandTotal || o.grand_total || items.reduce((a, i) => a + (i.price * (i.qty || 1)), 0);
  const paymentMethod = o.paymentMethod || o.payment_method || 'Cash';
  const gstAmount     = o.gstAmount || 0;
  const serviceCharge = o.serviceCharge || 0;
  const discountAmt   = o.discountAmt || 0;
  const rawTs = o.timestamp || o.createdAt;
  const createdAt = rawTs ? new Date(rawTs).toISOString() : new Date().toISOString();

  try {
    db.run(`
      INSERT OR IGNORE INTO orders
        (table_number, items, notes, status, payment_method, grand_total,
         gst_amount, service_charge, discount_amount, created_at)
      VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)
    `, [tableNum, JSON.stringify(items), o.note || '', paymentMethod,
        grandTotal, gstAmount, serviceCharge, discountAmt, createdAt]);
    inserted++;
    console.log(`   ✅ ${tableNum}  — ${items.length} item(s), ₹${grandTotal}, ${paymentMethod}`);
  } catch (err) {
    console.error(`   ❌ ${tableNum}: ${err.message}`);
    skipped++;
  }
}

const exported = db.export();
writeFileSync(dbPath, Buffer.from(exported));
console.log(`\n🎉 Done! Inserted: ${inserted}  Skipped: ${skipped}`);
console.log('👉 Now restart the POS app — your pickup data will appear in Order History.');
